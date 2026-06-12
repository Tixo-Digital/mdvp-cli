import puppeteer from 'puppeteer'
import { readFileSync, existsSync, unlinkSync } from 'fs'

const API = process.env.API_URL || 'https://api.mdvp.dev'
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined
const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-ipc-flooding-protection', '--memory-pressure-off', '--disable-features=TranslateUI', '--no-zygote']
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000')
const NODE_ID = process.env.NODE_ID || `worker-${Math.random().toString(36).slice(2, 8)}`
const TABS = parseInt(process.env.TABS || '2')

const EXTRACT_SCRIPT = readFileSync(new URL('./extract.js', import.meta.url), 'utf-8').trim()

function isConnectionClosedError(err) {
  return !!(err && typeof err.message === 'string' && err.message.includes('Connection closed'))
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: LAUNCH_ARGS,
  })
}

async function ensureBrowser(browserState) {
  if (browserState.current) return browserState.current
  browserState.current = await launchBrowser()
  return browserState.current
}

async function relaunchBrowser(browserState, reason) {
  if (browserState.relaunching) return browserState.relaunching
  browserState.relaunching = (async () => {
    if (reason) console.error(`[${NODE_ID}] ${reason}`)
    const stale = browserState.current
    browserState.current = null
    if (stale) await stale.close().catch(() => {})
    browserState.current = await launchBrowser()
    return browserState.current
  })().finally(() => {
    browserState.relaunching = null
  })
  return browserState.relaunching
}

async function claimJob() {
  try {
    const res = await fetch(`${API}/crawl/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: NODE_ID }),
    })
    if (!res.ok) return null
    const job = await res.json()
    return job.id ? job : null
  } catch {
    return null
  }
}

async function reportResult(jobId, result) {
  try {
    await fetch(`${API}/crawl/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, ...result }),
    })
  } catch (e) {
    console.error(`[${NODE_ID}] Failed to report result:`, e.message)
  }
}

async function extractCSSDesignDNA(page) {
  try {
    const client = await page.createCDPSession()
    await client.send('DOM.enable')
    await client.send('CSS.enable')

    const styleSheetIds = []
    client.on('CSS.styleSheetAdded', (e) => {
      if (e.header.origin !== 'injected') styleSheetIds.push(e.header.styleSheetId)
    })

    await new Promise(r => setTimeout(r, 500))

    let rawCSS = ''
    const MAX_CSS_BYTES = 2_000_000
    for (const id of styleSheetIds) {
      try {
        const { text } = await client.send('CSS.getStyleSheetText', { styleSheetId: id })
        if (text && rawCSS.length + text.length < MAX_CSS_BYTES) rawCSS += text + '\n'
      } catch {}
    }

    await client.send('CSS.disable').catch(() => {})
    await client.send('DOM.disable').catch(() => {})
    await client.detach().catch(() => {})

    if (!rawCSS) return null

    const count = (re) => (rawCSS.match(re) || []).length

    const cssVarsCount = count(/--[a-zA-Z0-9_-]+\s*:/g)
    const semanticVarsCount = count(/--(color|bg|background|text|border|spacing|space|radius|elevation|shadow|surface|on-|sys-|ref-|md-)[a-zA-Z0-9_-]+\s*:/gi)
    const twVarsCount = count(/--tw-[a-zA-Z0-9_-]+\s*:/g)
    const nonTwCssVars = Math.max(0, cssVarsCount - twVarsCount)
    const semanticTokenRatio = cssVarsCount > 0 ? Math.round(semanticVarsCount / cssVarsCount * 100) / 100 : 0

    const oklchCount = count(/oklch\(/gi)
    const colorMixCount = count(/color-mix\(/gi)
    const displayP3Count = count(/color\(\s*display-p3/gi)
    const containerQueriesCount = count(/@container/gi)
    const hasSelectorCount = count(/:has\(/gi)
    const backdropFilterCount = count(/backdrop-filter\s*:/gi)
    const multiLayerShadowCount = count(/box-shadow\s*:[^;]{30,};/g)
    const fontFeatureCount = count(/font-feature-settings\s*:/gi)
    const variableFontCount = count(/font-variation-settings\s*:/gi)
    const letterSpacingCount = count(/letter-spacing\s*:\s*(?!0\b|normal)[^;]+;/gi)
    const clampCount = count(/clamp\(/gi)
    const calcCount = count(/calc\(/gi)

    const modernityIndex = Math.min(100, Math.round(
      oklchCount * 4 + colorMixCount * 3 + displayP3Count * 5 +
      containerQueriesCount * 6 + hasSelectorCount * 4 +
      clampCount * 0.5 + variableFontCount * 3
    ))

    const designSystemScore = Math.min(100, Math.round(
      semanticVarsCount * 2 + nonTwCssVars * 0.3 +
      backdropFilterCount * 5 + multiLayerShadowCount * 3 +
      oklchCount * 2 + variableFontCount * 4 +
      fontFeatureCount * 2 + letterSpacingCount * 0.3 +
      modernityIndex * 0.3
    ))

    return {
      cssVarsCount, semanticVarsCount, nonTwCssVars, semanticTokenRatio,
      oklchCount, colorMixCount, displayP3Count,
      containerQueriesCount, hasSelectorCount,
      backdropFilterCount, multiLayerShadowCount,
      fontFeatureCount, variableFontCount, letterSpacingCount,
      clampCount, modernityIndex, designSystemScore,
    }
  } catch {
    return null
  }
}

async function crawlUrl(browser, url, options = {}) {
  const artifacts = options.artifacts !== false
  const fast = options.fast === true || !artifacts
  const page = await browser.newPage()
  page.setDefaultTimeout(20000)
  const consoleMessages = []
  const networkRequests = []
  page.on('console', msg => {
    if (consoleMessages.length < 100) consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 200) })
  })
  page.on('response', res => {
    if (networkRequests.length < 150) networkRequests.push({ url: res.url().slice(0, 150), status: res.status(), type: res.request().resourceType() })
  })

  try {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })

    if (fast) {
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        const type = request.resourceType()
        if (type === 'image' || type === 'media' || type === 'font') {
          request.abort().catch(() => {})
        } else {
          request.continue().catch(() => {})
        }
      })
    }

    const cdpClient = await page.createCDPSession()
    await cdpClient.send('DOM.enable')
    await cdpClient.send('CSS.enable')
    const styleSheetIds = []
    cdpClient.on('CSS.styleSheetAdded', (e) => {
      if (e.header.origin !== 'injected') styleSheetIds.push(e.header.styleSheetId)
    })

    if (fast) {
      const timeout = parseInt(process.env.CRAWL_FAST_TIMEOUT_MS || '6000')
      const settle = parseInt(process.env.CRAWL_FAST_SETTLE_MS || '150')
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() =>
        page.goto(url, { waitUntil: 'load', timeout }).catch(() => {})
      )
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {})
      if (settle > 0) await new Promise(r => setTimeout(r, settle))
    } else {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: 'load', timeout: 15000 }).catch(() => {})
      )

      // Wait for JS-rendered content: CSS vars, dark mode toggle, animations, canvas/WebGL
      // Sample body bg color twice — if it changed between samples, JS is still mutating styles
      await new Promise(r => setTimeout(r, 1500))
      const bgSample1 = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background') ||
               getComputedStyle(document.body).backgroundColor ||
               'rgb(255,255,255)'
      }).catch(() => '')

      await new Promise(r => setTimeout(r, 1500))
      const bgSample2 = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background') ||
               getComputedStyle(document.body).backgroundColor ||
               'rgb(255,255,255)'
      }).catch(() => '')

      // If background is still changing — wait longer (JS dark mode, animations)
      if (bgSample1 !== bgSample2) {
        await new Promise(r => setTimeout(r, 2000))
      }

      // Hook into rAF to ensure we sample after paint completes
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {})
    }

    let rawCSS = ''
    const MAX_CSS = 2_000_000
    for (const id of styleSheetIds) {
      try {
        const { text } = await cdpClient.send('CSS.getStyleSheetText', { styleSheetId: id })
        if (text && rawCSS.length + text.length < MAX_CSS) rawCSS += text + '\n'
      } catch {}
    }
    await cdpClient.send('CSS.disable').catch(() => {})
    await cdpClient.detach().catch(() => {})

    const cssDesignDNA = rawCSS ? (() => {
      const count = (re) => (rawCSS.match(re) || []).length
      const cssVarsCount = count(/--[a-zA-Z0-9_-]+\s*:/g)
      const semanticVarsCount = count(/--(color|bg|background|text|border|spacing|space|radius|elevation|shadow|surface)[a-zA-Z0-9_-]+\s*:/gi)
      const twVarsCount = count(/--tw-[a-zA-Z0-9_-]+\s*:/g)
      const nonTwCssVars = Math.max(0, cssVarsCount - twVarsCount)
      const oklchCount = count(/oklch\(/gi)
      const colorMixCount = count(/color-mix\(/gi)
      const containerQueriesCount = count(/@container/gi)
      const hasSelectorCount = count(/:has\(/gi)
      const backdropFilterCount = count(/backdrop-filter\s*:/gi)
      const multiLayerShadowCount = count(/box-shadow\s*:[^;]{30,};/g)
      const variableFontCount = count(/font-variation-settings\s*:/gi)
      const letterSpacingCount = count(/letter-spacing\s*:\s*(?!0\b|normal)[^;]+;/gi)
      const clampCount = count(/clamp\(/gi)
      const modernityIndex = Math.min(100, oklchCount*4 + colorMixCount*3 + containerQueriesCount*6 + hasSelectorCount*4 + clampCount*0.5)
      const designSystemScore = Math.min(100, Math.round(semanticVarsCount*2 + nonTwCssVars*0.3 + backdropFilterCount*5 + oklchCount*2 + variableFontCount*4 + modernityIndex*0.3))
      const semanticTokenRatio = cssVarsCount > 0 ? Math.round(semanticVarsCount/cssVarsCount*100)/100 : 0
      return { cssVarsCount, semanticVarsCount, nonTwCssVars, semanticTokenRatio, oklchCount, colorMixCount, containerQueriesCount, hasSelectorCount, backdropFilterCount, multiLayerShadowCount, variableFontCount, letterSpacingCount, clampCount, modernityIndex, designSystemScore }
    })() : null

    const elCount = await page.evaluate('document.querySelectorAll("*").length').catch(() => 0)
    if (!fast && elCount < 100) await new Promise(r => setTimeout(r, 4000))

    // Scroll to top and ensure full paint before DOM sampling
    await page.evaluate('window.scrollTo(0,0)').catch(() => {})
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {})

    let metrics = null
    let htmlContent = null
    let videoResult = null
    if (artifacts) {
      ;[metrics, htmlContent, videoResult] = await Promise.all([
        page.evaluate(EXTRACT_SCRIPT).catch(() => null),
        page.content().catch(() => null),
        (async () => {
        const vp = `/tmp/v_${Date.now()}_${Math.random().toString(36).slice(2, 5)}.webm`
        try {
          const rec = await page.screencast({ path: vp })
          await new Promise(r => setTimeout(r, 500))
          const sh = await page.evaluate('document.body.scrollHeight')
          const steps = Math.min(Math.ceil(sh / 900), 8)
          for (let i = 1; i <= steps; i++) {
            await page.evaluate(`window.scrollTo({top:${Math.min(i * 900, sh)},behavior:"smooth"})`)
            await new Promise(r => setTimeout(r, 400))
          }
          await new Promise(r => setTimeout(r, 300))
          for (let i = steps - 1; i >= 0; i--) {
            await page.evaluate(`window.scrollTo({top:${i * 900},behavior:"smooth"})`)
            await new Promise(r => setTimeout(r, 250))
          }
          await rec.stop()
          if (existsSync(vp)) { const b = readFileSync(vp).toString('base64'); unlinkSync(vp); return b }
        } catch { try { unlinkSync(vp) } catch {} }
        return null
        })(),
      ])
    } else {
      metrics = await page.evaluate(EXTRACT_SCRIPT).catch(() => null)
    }

    if (!metrics) throw new Error('No metrics')

    if (cssDesignDNA) Object.assign(metrics, cssDesignDNA)

    const generatorInfo = await page.evaluate(() => {
      const m = document.querySelector('meta[name="generator"]')
      const gen = m ? m.getAttribute('content') || '' : ''
      const hasLovable = !!(document.querySelector('[data-lovable],[class*="lovable-"]') || document.querySelector('#lovable-badge'))
      const hasV0 = !!(document.querySelector('[data-v0-component]') || document.querySelector('[class*="v0-"]'))
      const hasBolt = !!document.querySelector('[data-bolt]')
      const hasShadcnBadge = document.querySelectorAll('[data-radix-popper-content-wrapper],[data-radix-scroll-area-viewport]').length > 3
      const commentNodes = []
      const walker = document.createTreeWalker(document.documentElement, 0x80)
      let node; let i = 0
      while ((node = walker.nextNode()) && i++ < 20) commentNodes.push(node.nodeValue || '')
      const hasV0Comment = commentNodes.some(c => c.includes('v0.dev') || c.includes('generated by v0'))
      const isAiGen = hasLovable || hasV0 || hasBolt || hasV0Comment
      const twCustomProps = [...document.styleSheets].reduce((n, ss) => {
        try { return n + [...ss.cssRules].filter(r => r.cssText && r.cssText.includes('--tw-')).length } catch { return n }
      }, 0)
      return { gen, hasLovable, hasV0: hasV0 || hasV0Comment, hasBolt, hasShadcn: hasShadcnBadge, isAiGen, twCustomProps }
    }).catch(() => null)



    if (generatorInfo && metrics) {
      metrics.generatorMeta = generatorInfo.gen
      metrics.isAiGenerated = generatorInfo.isAiGen
      metrics.hasLovable = generatorInfo.hasLovable
      metrics.hasV0 = generatorInfo.hasV0
      metrics.twCustomProps = generatorInfo.twCustomProps
    }

    if (!artifacts) {
      metrics.consoleErrors = consoleMessages.filter(m => m.type === 'error').length
      metrics.consoleWarnings = consoleMessages.filter(m => m.type === 'warning').length
      return { success: true, metrics, screenshots: {}, video: null, html: null, network: networkRequests }
    }

    const screenshots = {}
    await page.evaluate('window.scrollTo(0,0)')
    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
      { name: 'tablet-768', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: false, hasTouch: true },
      { name: 'iphone-390', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    ]
    for (const v of viewports) {
      await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: v.deviceScaleFactor, isMobile: v.isMobile, hasTouch: v.hasTouch })
      await new Promise(r => setTimeout(r, 200))
      screenshots[v.name] = await page.screenshot({ type: 'jpeg', quality: 65, encoding: 'base64' })

      if (v.name === 'desktop-1440') {
        await page.evaluate(() => {
          const vw = window.innerWidth, vh = window.innerHeight
          const COLORS = ['#FF3B30','#007AFF','#34C759','#FF9500','#AF52DE','#FF2D55','#00C7BE','#FF6B00']

          const overlay = document.createElement('div')
          overlay.id = '__mdvp_overlay__'
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999999;font-family:monospace'
          document.body.appendChild(overlay)

          const pct = (v, total) => Math.round(v / total * 100)
          const frac = (v, total) => { const p = v/total; const fracs = [[1,'1'],[3/4,'3/4'],[2/3,'2/3'],[1/2,'1/2'],[1/3,'1/3'],[1/4,'1/4']]; return (fracs.find(([f])=>Math.abs(p-f)<0.05)||[null,pct(v,total)+'%'])[1] }

          const labeled = new Set()
          const regions = []

          const SEMANTIC = [
            ['nav', 'nav,[role="navigation"]'],
            ['header', 'header'],
            ['main', 'main,[role="main"]'],
            ['aside', 'aside'],
            ['footer', 'footer'],
            ['section', 'section'],
            ['article', 'article'],
            ['form', 'form'],
          ]
          for (const [label, sel] of SEMANTIC) {
            for (const el of document.querySelectorAll(sel)) {
              const r = el.getBoundingClientRect()
              if (r.width > vw * 0.1 && r.height > 20 && r.top < vh && r.bottom > 0) {
                regions.push({ label, el, r })
                labeled.add(el)
              }
            }
          }

          const MIN_W = vw * 0.15, MIN_H = 40
          for (const el of document.querySelectorAll('div,section,article,header,footer,main,aside')) {
            if (labeled.has(el)) continue
            const r = el.getBoundingClientRect()
            if (r.width < MIN_W || r.height < MIN_H || r.top >= vh || r.bottom <= 0) continue
            const style = getComputedStyle(el)
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
            const children = el.querySelectorAll('div,section,p,h1,h2,h3,img,button,a,input')
            if (children.length < 2) continue
            const parent = el.parentElement
            if (parent && regions.some(reg => reg.el === parent)) continue
            const isChild = regions.some(reg => reg.el.contains(el) && reg.el !== el && reg.r.width * 0.9 < r.width)
            if (isChild) continue

            const elTag = el.tagName.toLowerCase()
            const elCls = (typeof el.className === 'string' ? el.className : '').toLowerCase()
            const elId = (el.id || '').toLowerCase()
            const elRole = (el.getAttribute('role') || '').toLowerCase()
            const elPosition = style.position

            // ARIA-first detection
            let label = 'block'
            if (elRole === 'navigation') label = 'nav'
            else if (elRole === 'banner') label = 'header'
            else if (elRole === 'contentinfo') label = 'footer'
            else if (elRole === 'main') label = 'main'
            else if (elRole === 'complementary') label = 'sidebar'
            else if (elRole === 'dialog' || elRole === 'alertdialog') label = 'modal'
            else if (elRole === 'search') label = 'search'
            // Sticky/fixed detection
            else if ((elPosition === 'fixed' || elPosition === 'sticky') && r.top < 20 && r.width > vw * 0.8) label = 'sticky-header'
            else if ((elPosition === 'fixed' || elPosition === 'sticky') && r.bottom > vh - 20 && r.width > vw * 0.5) label = 'sticky-footer'
            else if ((elPosition === 'fixed' || elPosition === 'sticky') && r.width < vw * 0.3) label = 'floating-widget'
            else {
              // Content heuristics
              const hasH = el.querySelector('h1,h2,h3,h4')
              const hasBtn = el.querySelector('button,a[class*="btn"],a[class*="cta"],[role="button"]')
              const hasImg = el.querySelector('img,svg')
              const hasCode = el.querySelector('code,pre,[class*="code"],[class*="terminal"]')
              const hasInput = el.querySelector('input,textarea,select')
              const hasCards = el.querySelectorAll('[class*="card"],[class*="feature"],[class*="item"]').length >= 3
              const isAboveFold = r.top < vh * 0.8 && r.bottom > 0
              const hasTestimonial = elCls.includes('testimonial') || elCls.includes('review') || elCls.includes('quote')
              const hasPricing = elCls.includes('pricing') || elCls.includes('price') || elCls.includes('plan')

              if (hasCode) label = 'code'
              else if (hasInput) label = 'form'
              else if (hasTestimonial) label = 'testimonials'
              else if (hasPricing) label = 'pricing'
              else if (isAboveFold && hasH && hasBtn && r.height > vh * 0.3) label = 'hero'
              else if (hasCards && hasH) label = 'features'
              else if (hasH && r.width > vw * 0.4) label = 'section'
              else if (hasBtn && r.width < vw * 0.4) label = 'cta'
              else if (hasImg && !hasH) label = 'media'
              else if (r.width < vw * 0.35) label = 'sidebar'
              else if (elCls.includes('hero') || elId.includes('hero')) label = 'hero'
              else if (elCls.includes('feature') || elId.includes('feature')) label = 'features'
              else if (elCls.includes('modal') || elCls.includes('dialog')) label = 'modal'
              else if (elCls.includes('nav') || elId.includes('nav')) label = 'nav'
            }

            regions.push({ label, el, r })
            labeled.add(el)
          }

          regions.slice(0, 12).forEach(({ label, r }, i) => {
            const color = COLORS[i % COLORS.length]
            const box = document.createElement('div')
            const x = Math.max(0, r.left), y = Math.max(0, r.top)
            const w = Math.min(r.width, vw - x), h = Math.min(r.height, vh - y)
            box.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:2px solid ${color};box-sizing:border-box;pointer-events:none`
            const tag = document.createElement('div')
            const xF = frac(x, vw), yF = frac(y, vh), wF = frac(w, vw), hF = frac(h, vh)
            tag.textContent = `${label} x:${xF} y:${yF} w:${wF} h:${hF}`
            tag.style.cssText = `background:${color};color:#fff;font:bold 10px/1.3 monospace;padding:1px 5px;position:absolute;top:0;left:0;white-space:nowrap;max-width:220px`
            box.appendChild(tag)
            overlay.appendChild(box)
          })

          for (const pct of [25, 50, 75]) {
            const vl = document.createElement('div')
            vl.style.cssText = `position:absolute;left:${pct}%;top:0;width:1px;height:100%;border-left:1px dashed rgba(128,128,128,0.4)`
            const vt = document.createElement('div')
            vt.textContent = `${pct}%`
            vt.style.cssText = `position:absolute;left:${pct}%;top:2px;font:9px monospace;color:rgba(128,128,128,0.7);transform:translateX(-50%)`
            const hl = document.createElement('div')
            hl.style.cssText = `position:absolute;top:${pct}%;left:0;height:1px;width:100%;border-top:1px dashed rgba(128,128,128,0.4)`
            const ht = document.createElement('div')
            ht.textContent = `${pct}%`
            ht.style.cssText = `position:absolute;top:${pct}%;left:2px;font:9px monospace;color:rgba(128,128,128,0.7);transform:translateY(-50%)`
            overlay.appendChild(vl); overlay.appendChild(vt); overlay.appendChild(hl); overlay.appendChild(ht)
          }
        })
        await new Promise(r => setTimeout(r, 150))
        screenshots['desktop-1440-annotated'] = await page.screenshot({ type: 'jpeg', quality: 85, encoding: 'base64' })

        const viewportMatrix = await page.evaluate(() => {
          const COLS = 12, ROWS = 8
          const vw = window.innerWidth, vh = window.innerHeight
          const cw = Math.round(vw / COLS), ch = Math.round(vh / ROWS)

          const classifyEl = (el) => {
            if (!el || el === document.body || el === document.documentElement) return 'blank'
            const tag = el.tagName.toLowerCase()
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase()
            const id = (el.id || '').toLowerCase()
            const vw = window.innerWidth, vh = window.innerHeight
            const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }

            // 1. ARIA-first detection — authoritative
            const role = (el.getAttribute ? el.getAttribute('role') || '' : '').toLowerCase()

            if (role === 'navigation') return 'nav'
            if (role === 'banner') return 'header'
            if (role === 'contentinfo') return 'footer'
            if (role === 'main') return 'main'
            if (role === 'complementary') return 'sidebar'
            if (role === 'dialog' || role === 'alertdialog') return 'modal'
            if (role === 'button') return 'cta'
            if (role === 'search') return 'search'
            if (role === 'tab' || role === 'tablist') return 'tabs'
            if (role === 'menu' || role === 'menubar') return 'menu'

            // 2. Sticky/fixed element detection
            const position = getComputedStyle(el).position
            if (position === 'fixed' || position === 'sticky') {
              if (r.top < 20 && r.width > vw * 0.8) return 'sticky-header'
              if (r.bottom > vh - 20 && r.width > vw * 0.5) return 'sticky-footer'
              if (r.width < vw * 0.3) return 'floating-widget'
            }

            // 3. Semantic HTML tags
            if (tag === 'nav' || cls.includes('navbar') || cls.includes('nav-bar') || id.includes('nav')) return 'nav'
            if (tag === 'header' || id === 'header' || cls.includes('header')) return 'header'
            if (tag === 'footer' || cls.includes('footer') || id.includes('footer')) return 'footer'
            if (tag === 'main') return 'main'
            if (tag === 'aside' || cls.includes('sidebar') || cls.includes('side-panel') || cls.includes('side-bar')) return 'sidebar'
            if (tag === 'pre' || tag === 'code' || cls.includes('code') || cls.includes('terminal') || cls.includes('console') || cls.includes('prism') || cls.includes('hljs')) return 'code'
            if (tag === 'table') return 'table'
            if (tag === 'img' || tag === 'video' || tag === 'picture') return 'media'
            if (tag === 'svg') return 'icon'
            if (tag.match(/^h[1-6]$/)) return 'heading'
            if (el.closest && el.closest('h1,h2,h3,h4,h5,h6')) return 'heading'
            if (tag === 'p') return 'text'
            if (tag === 'ul' || tag === 'ol') return 'list'

            // 4. Text intent classification for links/buttons
            if (tag === 'a' || tag === 'button' || cls.includes('btn') || cls.includes('cta') || cls.includes('button')) {
              const text = (el.innerText || '').trim()
              const CTA_WORDS = /^(buy|sign.?up|get.?started|try|start|subscribe|join|register|download|install|order|book|reserve|add.?to.?cart|checkout|donate|apply|claim|request|contact|schedule)/i
              const NAV_WORDS = /^(home|about|pricing|features|blog|docs|faq|help|support|login|sign.?in|portfolio|services|products|team|careers|news)/i
              if (CTA_WORDS.test(text)) return 'cta'
              if (NAV_WORDS.test(text) && tag === 'a') return 'nav-link'
              if (tag === 'button' || cls.includes('btn') || cls.includes('cta') || cls.includes('button')) return 'cta'
              if (tag === 'a') return 'link'
            }

            // 5. Landmark/section detection by heuristics
            if (el.querySelector) {
              const isAboveFold = r.top < vh * 0.8 && r.bottom > 0
              const hasHeading = !!el.querySelector('h1,h2,h3')
              const hasCTA = !!el.querySelector('button,a[class*="btn"],a[class*="cta"],[role="button"]')
              const hasTestimonial = cls.includes('testimonial') || cls.includes('review') || cls.includes('quote') || id.includes('testimonial')
              const hasPricing = cls.includes('pricing') || cls.includes('price') || cls.includes('plan') || id.includes('pricing')
              const hasForm = !!el.querySelector('form,input,textarea')
              const hasCards = el.querySelectorAll('[class*="card"],[class*="feature"],[class*="item"]').length >= 3

              if (tag === 'form' || (hasForm && !hasCTA)) return 'form'
              if (hasTestimonial) return 'testimonials'
              if (hasPricing) return 'pricing'
              if (isAboveFold && hasHeading && hasCTA && r.height > vh * 0.3) return 'hero'
              if (hasCards && hasHeading) return 'features'
              if (tag === 'section' || tag === 'article') return 'section'
            } else {
              if (tag === 'form') return 'form'
              if (tag === 'section' || tag === 'article') return 'section'
            }

            // 6. Class/id heuristics for remaining cases
            if (cls.includes('hero') || id.includes('hero')) return 'hero'
            if (cls.includes('feature') || id.includes('feature')) return 'features'
            if (cls.includes('testimonial') || cls.includes('review')) return 'testimonials'
            if (cls.includes('pricing') || cls.includes('price')) return 'pricing'
            if (cls.includes('modal') || cls.includes('dialog') || cls.includes('overlay')) return 'modal'
            if (cls.includes('search') || id.includes('search')) return 'search'
            if (cls.includes('tab') || id.includes('tab')) return 'tabs'
            if (cls.includes('menu') || id.includes('menu')) return 'menu'
            if (cls.includes('nav') || id.includes('nav')) return 'nav'

            return 'block'
          }

          const resolvedBg = (el) => {
            let node = el
            while (node && node !== document.documentElement) {
              const bg = getComputedStyle(node).backgroundColor
              if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
              node = node.parentElement
            }
            return 'rgb(255,255,255)'
          }

          const ancestorChain = (el) => {
            const chain = []
            let node = el
            let depth = 0
            while (node && node !== document.documentElement && depth < 6) {
              const s = getComputedStyle(node)
              const bg = s.backgroundColor
              const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
              const tag2 = node.tagName.toLowerCase()
              const fill = (tag2 === 'svg' || tag2 === 'path' || tag2 === 'circle' || tag2 === 'rect')
                ? (s.fill && s.fill !== 'none' && s.fill !== 'rgba(0, 0, 0, 0)' ? s.fill : null)
                : null
              const fgResolved = s.color === 'rgb(0, 0, 238)' ? (fill || s.color) : s.color
              chain.unshift({
                tag: tag2,
                type: classifyEl(node),
                bg: hasBg ? bg : null,
                fg: fgResolved,
                fill,
                fontSize: s.fontSize,
                fontFamily: s.fontFamily.split(',')[0].trim().replace(/"/g,''),
                display: s.display,
              })
              node = node.parentElement
              depth++
            }
            return chain
          }

          const cells = []
          for (let r = 0; r < ROWS; r++) {
            for (let col = 0; col < COLS; col++) {
              const px = Math.round(col * cw + cw / 2)
              const py = Math.round(r * ch + ch / 2)
              const el = document.elementFromPoint(px, py)
              if (!el || el === document.body || el === document.documentElement) {
                cells.push({ row: r, col, type: 'blank', bg: 'rgb(255,255,255)', fg: 'rgb(0,0,0)', text: '', fontSize: null, fontFamily: null, fontWeight: null, chain: [] })
                continue
              }

              const s = getComputedStyle(el)
              const type = classifyEl(el)
              const bg = resolvedBg(el)
              const chain = ancestorChain(el)
              const rawText = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)

              const svgEl = el.closest('svg') || (el.tagName === 'SVG' ? el : null)
              const svgFill = svgEl ? (() => {
                for (const child of svgEl.querySelectorAll('[fill],[stroke]')) {
                  const f = child.getAttribute('fill') || getComputedStyle(child).fill
                  if (f && f !== 'none' && f !== 'rgba(0, 0, 0, 0)') return f
                }
                return null
              })() : null

              const fgColor = (s.color === 'rgb(0, 0, 238)' && svgFill) ? svgFill : s.color

              cells.push({
                row: r, col,
                xPct: Math.round(col / COLS * 100),
                yPct: Math.round(r / ROWS * 100),
                type,
                bg,
                fg: fgColor,
                text: rawText,
                fontSize: s.fontSize,
                fontFamily: s.fontFamily.split(',')[0].trim().replace(/"/g, ''),
                fontWeight: s.fontWeight,
                tag: el.tagName.toLowerCase(),
                chain,
              })
            }
          }

          const TYPE_CHAR = { nav:'N', 'nav-link':'n', header:'H', 'sticky-header':'Ĥ', hero:'★', main:'M', sidebar:'S', footer:'F', 'sticky-footer':'Ḟ', cta:'B', form:'I', search:'?', modal:'◈', tabs:'⊞', menu:'≡', features:'⊕', pricing:'$', testimonials:'"', 'floating-widget':'◉', code:'C', media:'P', icon:'V', heading:'h', text:'T', list:'L', link:'A', section:'#', table:'=', block:'▒', blank:' ' }
          const ascii = Array.from({length: ROWS}, (_, r) => {
            const row = cells.filter(c => c.row === r).sort((a,b) => a.col - b.col)
            return `[${String(r).padStart(2)}] ` + row.map(c => TYPE_CHAR[c.type] || '?').join(' ')
          }).join('\n')

          return { cols: COLS, rows: ROWS, cellW: cw, cellH: ch, vw, vh, cells, ascii }
        }).catch(() => null)

        if (viewportMatrix) screenshots['viewport-matrix'] = viewportMatrix

        const cleanB64 = screenshots['desktop-1440']
        if (cleanB64 && viewportMatrix) {
          const regionFragments = await page.evaluate((b64, matrix) => {
            return new Promise(resolve => {
              const img = new Image()
              img.onload = () => {
                const scaleX = img.width / matrix.vw
                const scaleY = img.height / matrix.vh
                const cells = matrix.cells

                const regionMap = {}
                for (const cell of cells) {
                  if (cell.type === 'blank') continue
                  const k = cell.type
                  if (!regionMap[k]) regionMap[k] = { type: k, cols: [], rows: [], bg: cell.bg, fg: cell.fg, text: cell.text, fontSize: cell.fontSize, fontFamily: cell.fontFamily }
                  regionMap[k].cols.push(cell.col)
                  regionMap[k].rows.push(cell.row)
                }

                const fragments = {}
                for (const [type, reg] of Object.entries(regionMap)) {
                  const c1 = Math.min(...reg.cols), c2 = Math.max(...reg.cols)
                  const r1 = Math.min(...reg.rows), r2 = Math.max(...reg.rows)
                  const x = Math.round(c1 * matrix.cellW * scaleX)
                  const y = Math.round(r1 * matrix.cellH * scaleY)
                  const w = Math.round((c2 - c1 + 1) * matrix.cellW * scaleX)
                  const h = Math.round((r2 - r1 + 1) * matrix.cellH * scaleY)
                  if (w < 10 || h < 10) continue
                  const canvas = document.createElement('canvas')
                  canvas.width = Math.min(w, 480)
                  canvas.height = Math.min(h, 300)
                  const ctx = canvas.getContext('2d')
                  ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height)
                  fragments[type] = {
                    b64: canvas.toDataURL('image/jpeg', 0.7).split(',')[1],
                    xPct: Math.round(c1 / matrix.cols * 100),
                    yPct: Math.round(r1 / matrix.rows * 100),
                    wPct: Math.round((c2 - c1 + 1) / matrix.cols * 100),
                    hPct: Math.round((r2 - r1 + 1) / matrix.rows * 100),
                    bg: reg.bg, fg: reg.fg, text: reg.text,
                    fontSize: reg.fontSize, fontFamily: reg.fontFamily,
                  }
                }
                resolve(fragments)
              }
              img.onerror = () => resolve({})
              img.src = 'data:image/jpeg;base64,' + b64
            })
          }, cleanB64, viewportMatrix).catch(() => ({}))

          if (Object.keys(regionFragments).length > 0) {
            screenshots['region-fragments'] = regionFragments
          }
        }

        const temporalData = await (async () => {
          try {
            await page.evaluate('window.scrollTo(0,0)')
            await new Promise(r => setTimeout(r, 1500))

            const COLS = 12, ROWS = 8

            const captureFrame = async () => {
              const shot = await page.screenshot({ type: 'jpeg', quality: 40, encoding: 'base64' })
              return page.evaluate((b64, cols, rows) => {
                return new Promise(resolve => {
                  const img = new Image()
                  img.onload = () => {
                    const canvas = document.createElement('canvas')
                    canvas.width = cols; canvas.height = rows
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, cols, rows)
                    const data = ctx.getImageData(0, 0, cols, rows).data
                    const cells = []
                    for (let i = 0; i < data.length; i += 4) cells.push([data[i], data[i+1], data[i+2]])
                    resolve(cells)
                  }
                  img.onerror = () => resolve([])
                  img.src = 'data:image/jpeg;base64,' + b64
                })
              }, shot, COLS, ROWS)
            }

            const staticFrames = []
            for (let i = 0; i < 5; i++) {
              staticFrames.push(await captureFrame())
              await new Promise(r => setTimeout(r, 400))
            }

            let totalChanged = 0, totalCells = 0
            const cellChangeCounts = new Array(COLS * ROWS).fill(0)
            for (let f = 1; f < staticFrames.length; f++) {
              const prev = staticFrames[f-1], curr = staticFrames[f]
              for (let i = 0; i < Math.min(prev.length, curr.length); i++) {
                totalCells++
                const delta = Math.sqrt((prev[i][0]-curr[i][0])**2 + (prev[i][1]-curr[i][1])**2 + (prev[i][2]-curr[i][2])**2)
                if (delta > 15) { totalChanged++; cellChangeCounts[i]++ }
              }
            }
            const motionNoiseRatio = totalCells > 0 ? totalChanged / totalCells : 0
            const persistentNoiseCells = cellChangeCounts.filter(c => c >= 3).length
            const motionToxicityScore = Math.min(
              motionNoiseRatio * 2 + (persistentNoiseCells / (COLS * ROWS)) * 0.5,
              1
            )

            const frames = []
            const scrollSteps = [0, 200, 400, 600, 900]

            for (const scrollY of scrollSteps) {
              await page.evaluate(y => window.scrollTo(0, y), scrollY)
              await new Promise(r => setTimeout(r, 180))

              const frameShot = await page.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' })
              const cellColors = await page.evaluate((b64, cols, rows) => {
                return new Promise(resolve => {
                  const img = new Image()
                  img.onload = () => {
                    const cw = img.width / cols, ch = img.height / rows
                    const canvas = document.createElement('canvas')
                    canvas.width = cols; canvas.height = rows
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, cols, rows)
                    const data = ctx.getImageData(0, 0, cols, rows).data
                    const cells = []
                    for (let i = 0; i < data.length; i += 4) {
                      cells.push([data[i], data[i+1], data[i+2]])
                    }
                    resolve(cells)
                  }
                  img.onerror = () => resolve([])
                  img.src = 'data:image/jpeg;base64,' + b64
                })
              }, frameShot, COLS, ROWS)

              frames.push({ scrollY, cells: cellColors })
            }

            await page.evaluate('window.scrollTo(0,0)')

            const diffs = []
            for (let f = 1; f < frames.length; f++) {
              const prev = frames[f-1].cells
              const curr = frames[f].cells
              let changed = 0
              const scrollDelta = frames[f].scrollY - frames[f-1].scrollY
              for (let i = 0; i < Math.min(prev.length, curr.length); i++) {
                const [r1,g1,b1] = prev[i], [r2,g2,b2] = curr[i]
                const delta = Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
                if (delta > 30) changed++
              }
              const cellCount = prev.length || 1
              const changeRatio = changed / cellCount
              diffs.push({ scrollDelta, changeRatio, changed, total: cellCount })
            }

            const avgChange = diffs.reduce((s, d) => s + d.changeRatio, 0) / diffs.length
            const maxChange = Math.max(...diffs.map(d => d.changeRatio))
            const temporalEntropy = Math.min(avgChange * 2, 1)
            const layoutShift = diffs.filter(d => d.changeRatio > 0.3).length > 0

            // Motion taxonomy classification
            const motionTaxonomyResult = await page.evaluate(() => {
              const vw = window.innerWidth, vh = window.innerHeight

              function classifyMotion(el) {
                const s = getComputedStyle(el)
                const r = el.getBoundingClientRect()
                const tag = el.tagName.toLowerCase()
                const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase()

                const isLooping = s.animationIterationCount === 'infinite'
                const isInteractive = ['button', 'a', 'input', 'select'].includes(tag) || el.getAttribute('role') === 'button'
                const isFullscreen = (r.width / vw > 0.8 && r.height / vh > 0.8)
                const areaRatio = (r.width * r.height) / (vw * vh)
                const centerX = (r.left + r.width / 2) / vw
                const centerY = (r.top + r.height / 2) / vh
                const isPeripheral = centerX < 0.15 || centerX > 0.85 || centerY < 0.1 || centerY > 0.9
                const isCentral = centerX > 0.25 && centerX < 0.75 && centerY > 0.15 && centerY < 0.85
                const hasTransitionOnly = s.transitionDuration !== '0s' && s.animationName === 'none'
                const isPulse = s.animationName.includes('pulse') || s.animationName.includes('bounce') || s.animationName.includes('wiggle')
                const isSkeleton = cls.includes('skeleton') || cls.includes('shimmer') || cls.includes('loading') || cls.includes('spinner')
                const isVideo = tag === 'video' || cls.includes('video-bg')

                if (isSkeleton) return 'loading'
                if (isVideo || (isFullscreen && isLooping)) return 'background'
                if (isInteractive && hasTransitionOnly) return 'feedback'
                if (isInteractive && isPulse && isCentral) return 'persuasive'
                if (isPeripheral && isLooping && areaRatio > 0.01) return 'hijacking'
                if (isPeripheral && isLooping && areaRatio <= 0.01) return 'decorative'
                if (isFullscreen && !isLooping) return 'navigational'
                if (isCentral && isLooping && areaRatio > 0.05) return 'persuasive'
                if (isLooping) return 'decorative'
                return 'navigational'
              }

              const taxonomy = {
                decorative: 0, feedback: 0, navigational: 0, persuasive: 0,
                hijacking: 0, loading: 0, unstable: 0, background: 0,
              }

              const zones = {
                header: { y: [0, 0.12], motionEnergy: 0, elements: [] },
                hero:   { y: [0.12, 0.50], motionEnergy: 0, elements: [] },
                main:   { y: [0.50, 0.85], motionEnergy: 0, elements: [] },
                footer: { y: [0.85, 1.0], motionEnergy: 0, elements: [] },
                left:   { x: [0, 0.15], motionEnergy: 0, elements: [] },
                right:  { x: [0.85, 1.0], motionEnergy: 0, elements: [] },
              }

              const classified = []

              document.querySelectorAll('*').forEach(el => {
                const s = getComputedStyle(el)
                const hasAnim = s.animationName !== 'none' && s.animationDuration !== '0s'
                const hasTrans = s.transitionDuration !== '0s' && s.transitionProperty !== 'none'
                if (!hasAnim && !hasTrans) return
                const r = el.getBoundingClientRect()
                if (r.width <= 0 || r.height <= 0) return

                const motionType = classifyMotion(el)
                taxonomy[motionType] = (taxonomy[motionType] || 0) + 1

                const isLooping = s.animationIterationCount === 'infinite'
                const areaRatio = (r.width * r.height) / (vw * vh)
                const centerX = (r.left + r.width / 2) / vw
                const centerY = (r.top + r.height / 2) / vh
                const energyWeight = areaRatio * (isLooping ? 2 : 1)

                const tag = el.tagName.toLowerCase()
                const entry = {
                  tag,
                  motionType,
                  areaRatio: Math.round(areaRatio * 10000) / 10000,
                  centerX: Math.round(centerX * 100) / 100,
                  centerY: Math.round(centerY * 100) / 100,
                  isLooping,
                  animationName: s.animationName,
                  duration: s.animationDuration || s.transitionDuration,
                }
                classified.push(entry)

                // Assign to vertical zones
                for (const [zoneName, zone] of Object.entries(zones)) {
                  if (zone.y) {
                    if (centerY >= zone.y[0] && centerY < zone.y[1]) {
                      zone.motionEnergy += energyWeight
                      if (zone.elements.length < 10) zone.elements.push(entry)
                    }
                  } else if (zone.x) {
                    if (centerX >= zone.x[0] && centerX < zone.x[1]) {
                      zone.motionEnergy += energyWeight
                      if (zone.elements.length < 10) zone.elements.push(entry)
                    }
                  }
                }
              })

              // Build zoneMotion output
              const zoneMotion = {}
              for (const [zoneName, zone] of Object.entries(zones)) {
                zoneMotion[zoneName] = {
                  energy: Math.round(zone.motionEnergy * 10000) / 10000,
                  elements: zone.elements,
                }
              }

              // attentionCaptureRatio: peripheral (hijacking) energy / CTA (persuasive) energy
              const peripheralEnergy = classified
                .filter(e => e.motionType === 'hijacking')
                .reduce((s, e) => s + e.areaRatio * (e.isLooping ? 2 : 1), 0)
              const ctaEnergy = classified
                .filter(e => e.motionType === 'persuasive')
                .reduce((s, e) => s + e.areaRatio * (e.isLooping ? 2 : 1), 0)
              const attentionCaptureRatio = ctaEnergy > 0
                ? Math.round(peripheralEnergy / ctaEnergy * 100) / 100
                : (peripheralEnergy > 0 ? 99 : 0)

              // motionComplexityScore: weighted sum of all motion energy, capped at 1
              const totalEnergy = classified.reduce((s, e) => s + e.areaRatio * (e.isLooping ? 2 : 1), 0)
              const motionComplexityScore = Math.round(Math.min(totalEnergy, 1) * 100) / 100

              // dominantMotionType: type with highest count (excluding unstable)
              const dominantMotionType = Object.entries(taxonomy)
                .filter(([k]) => k !== 'unstable')
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'

              return {
                motionTaxonomy: taxonomy,
                zoneMotion,
                attentionCaptureRatio,
                motionComplexityScore,
                dominantMotionType,
                _classified: classified.slice(0, 40),
              }
            }).catch(() => null)

            const motionCells = motionTaxonomyResult?._classified || []

            const peripheralMotion = motionCells.filter(m => m.motionType === 'hijacking')
            const centralMotion = motionCells.filter(m => ['persuasive', 'feedback', 'navigational'].includes(m.motionType))
            const toxicMotion = motionCells.filter(m => m.motionType === 'hijacking')
            const feedbackMotion = motionCells.filter(m => m.motionType === 'feedback')

            const toxicArea = toxicMotion.reduce((s, m) => s + m.areaRatio, 0)
            const centralSaliency = centralMotion.reduce((s, m) => s + m.areaRatio, 0)

            const attentionHijacking = toxicMotion.length > 0 && toxicArea > 0.05
            const hijackingScore = centralSaliency > 0
              ? Math.min(toxicArea / Math.max(centralSaliency, 0.01), 3)
              : (toxicMotion.length > 0 ? 2 : 0)

            const persistentCells = []
            if (frames.length >= 3) {
              const THRESHOLD = 30
              for (let i = 0; i < COLS * ROWS; i++) {
                let changeCount = 0
                for (let f = 1; f < frames.length; f++) {
                  const prev = frames[f-1].cells[i], curr = frames[f].cells[i]
                  if (!prev || !curr) continue
                  const delta = Math.sqrt((prev[0]-curr[0])**2 + (prev[1]-curr[1])**2 + (prev[2]-curr[2])**2)
                  if (delta > THRESHOLD) changeCount++
                }
                if (changeCount >= frames.length - 1) {
                  persistentCells.push(i)
                }
              }
            }
            const cyclicAnimations = persistentCells.length

            return {
              temporalEntropy,
              layoutShift,
              maxChangeRatio: maxChange,
              diffs,
              motionElements: motionCells,
              attentionHijacking,
              hijackingScore: Math.round(hijackingScore * 100) / 100,
              peripheralMotionCount: peripheralMotion.length,
              centralMotionCount: centralMotion.length,
              toxicMotionCount: toxicMotion.length,
              feedbackMotionCount: feedbackMotion.length,
              cyclicAnimations,
              motionNoiseRatio: Math.round(motionNoiseRatio * 100) / 100,
              motionToxicityScore: Math.round(motionToxicityScore * 100) / 100,
              persistentNoiseCells,
              // Motion taxonomy
              motionTaxonomy: motionTaxonomyResult?.motionTaxonomy || null,
              zoneMotion: motionTaxonomyResult?.zoneMotion || null,
              attentionCaptureRatio: motionTaxonomyResult?.attentionCaptureRatio ?? null,
              motionComplexityScore: motionTaxonomyResult?.motionComplexityScore ?? null,
              dominantMotionType: motionTaxonomyResult?.dominantMotionType || null,
            }
          } catch (e) {
            return { error: String(e && e.message || e), temporalFailed: true }
          }
        })()

        if (temporalData) screenshots['temporal'] = temporalData

        const interactionResult = await (async () => {
          try {
            // Reset to desktop viewport and scroll to top
            await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false })
            await page.evaluate('window.scrollTo(0,0)')
            await new Promise(r => setTimeout(r, 500))

            const interactives = await page.evaluate(() => {
              return [...document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]')]
                .filter(el => {
                  const r = el.getBoundingClientRect()
                  return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.top > 0
                })
                .slice(0, 20)
                .map((el, i) => ({
                  index: i,
                  tag: el.tagName.toLowerCase(),
                  type: el.type || '',
                  text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 50),
                  role: el.getAttribute('role') || '',
                  x: Math.round(el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
                  y: Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2),
                  w: Math.round(el.getBoundingClientRect().width),
                  h: Math.round(el.getBoundingClientRect().height),
                }))
            }).catch(() => [])

            const getComputedStyleProps = async (x, y) => {
              return page.evaluate((px, py) => {
                const el = document.elementFromPoint(px, py)
                if (!el) return null
                const s = getComputedStyle(el)
                return {
                  bg: s.backgroundColor,
                  fg: s.color,
                  borderColor: s.borderColor,
                  boxShadow: s.boxShadow,
                  transform: s.transform,
                  opacity: s.opacity,
                }
              }, x, y).catch(() => null)
            }

            const pixelDiff = async (clipBefore, clipAfter, x, y, w, h) => {
              return page.evaluate((b1, b2, cx, cy, cw, ch) => {
                return new Promise(resolve => {
                  const load = (b64) => new Promise((res, rej) => {
                    const img = new Image()
                    img.onload = () => res(img)
                    img.onerror = rej
                    img.src = 'data:image/jpeg;base64,' + b64
                  })
                  Promise.all([load(b1), load(b2)]).then(([img1, img2]) => {
                    const canvas = document.createElement('canvas')
                    canvas.width = img1.width; canvas.height = img1.height
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img1, 0, 0)
                    const d1 = ctx.getImageData(0, 0, canvas.width, canvas.height).data
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    ctx.drawImage(img2, 0, 0)
                    const d2 = ctx.getImageData(0, 0, canvas.width, canvas.height).data
                    let diff = 0
                    const total = d1.length / 4
                    for (let i = 0; i < d1.length; i += 4) {
                      const dr = Math.abs(d1[i] - d2[i])
                      const dg = Math.abs(d1[i+1] - d2[i+1])
                      const db = Math.abs(d1[i+2] - d2[i+2])
                      if (dr + dg + db > 30) diff++
                    }
                    resolve(total > 0 ? Math.round(diff / total * 10000) / 10000 : 0)
                  }).catch(() => resolve(0))
                })
              }, clipBefore, clipAfter, x, y, w, h).catch(() => 0)
            }

            const classifyFeedback = (before, after) => {
              if (!before || !after) return 'none'
              if (before.bg !== after.bg) return 'color-change'
              if (before.boxShadow !== after.boxShadow && after.boxShadow !== 'none') return 'shadow'
              if (before.transform !== after.transform && after.transform !== 'none' && after.transform !== 'matrix(1, 0, 0, 1, 0, 0)') return 'transform'
              if (before.opacity !== after.opacity) return 'opacity'
              if (before.borderColor !== after.borderColor) return 'color-change'
              return 'none'
            }

            const elements = []
            const deadline = Date.now() + 14000

            for (const el of interactives) {
              if (Date.now() > deadline) break
              try {
                // Clip region with padding
                const pad = 4
                const clipX = Math.max(0, el.x - el.w / 2 - pad)
                const clipY = Math.max(0, el.y - el.h / 2 - pad)
                const clipW = Math.min(el.w + pad * 2, 1440 - clipX)
                const clipH = Math.min(el.h + pad * 2, 900 - clipY)

                if (clipW < 2 || clipH < 2) continue

                // Move mouse away first to ensure clean default state
                await page.mouse.move(0, 0)
                await new Promise(r => setTimeout(r, 150))

                const styleBefore = await getComputedStyleProps(el.x, el.y)
                const shotBefore = await page.screenshot({
                  type: 'jpeg', quality: 60, encoding: 'base64',
                  clip: { x: clipX, y: clipY, width: clipW, height: clipH },
                }).catch(() => null)

                // Hover
                await page.mouse.move(el.x, el.y)
                await new Promise(r => setTimeout(r, 300))

                const styleAfter = await getComputedStyleProps(el.x, el.y)
                const shotAfter = await page.screenshot({
                  type: 'jpeg', quality: 60, encoding: 'base64',
                  clip: { x: clipX, y: clipY, width: clipW, height: clipH },
                }).catch(() => null)

                // Move away to reset
                await page.mouse.move(0, 0)
                await new Promise(r => setTimeout(r, 200))

                const hoverDiffPercent = (shotBefore && shotAfter)
                  ? await pixelDiff(shotBefore, shotAfter, clipX, clipY, clipW, clipH)
                  : 0

                const feedbackType = classifyFeedback(styleBefore, styleAfter)
                const hasHoverFeedback = hoverDiffPercent > 0.01 || feedbackType !== 'none'

                elements.push({
                  element: { tag: el.tag, text: el.text, role: el.role, x: el.x, y: el.y, w: el.w, h: el.h },
                  states: {
                    default: styleBefore,
                    hover: styleAfter,
                  },
                  hasHoverFeedback,
                  hoverDiffPercent,
                  feedbackType,
                })
              } catch {
                // skip element on error
              }
            }

            // Reset mouse
            await page.mouse.move(0, 0).catch(() => {})

            const withFeedback = elements.filter(e => e.hasHoverFeedback).length
            const withoutFeedback = elements.length - withFeedback
            const feedbackRatio = elements.length > 0 ? Math.round(withFeedback / elements.length * 100) / 100 : 0

            const feedbackTypes = {}
            for (const e of elements) {
              feedbackTypes[e.feedbackType] = (feedbackTypes[e.feedbackType] || 0) + 1
            }

            return {
              interactiveCount: elements.length,
              withFeedback,
              withoutFeedback,
              feedbackRatio,
              elements,
              feedbackTypes,
            }
          } catch {
            return null
          }
        })()

        if (interactionResult) screenshots['interaction-replay'] = interactionResult

        const annotatedB64 = screenshots['desktop-1440-annotated']
        const asciiArt = annotatedB64 ? await page.evaluate((b64) => {
          return new Promise(resolve => {
            const COLS = 120, ROWS = 40
            const GRADIENT = " .'`^,:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = COLS; canvas.height = ROWS
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, 0, 0, COLS, ROWS)
              const data = ctx.getImageData(0, 0, COLS, ROWS).data
              let out = ''
              for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                  const i = (y * COLS + x) * 4
                  const r = data[i], g = data[i+1], b = data[i+2]
                  const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255
                  const v = max
                  const idx = Math.min(Math.floor(v * (GRADIENT.length - 1)), GRADIENT.length - 1)
                  const ch = GRADIENT[idx]
                  out += `\x1b[38;2;${r};${g};${b}m${ch}`
                }
                out += '\x1b[0m\n'
              }
              out += '\x1b[0m'
              resolve(out)
            }
            img.onerror = () => resolve(null)
            img.src = 'data:image/jpeg;base64,' + b64
          })
        }, annotatedB64).catch(() => null) : null

        if (asciiArt) screenshots['desktop-ascii'] = asciiArt

        await page.evaluate(() => { const el = document.getElementById('__mdvp_overlay__'); if (el) el.remove() })
      }
    }

    metrics.consoleErrors = consoleMessages.filter(m => m.type === 'error').length
    metrics.consoleWarnings = consoleMessages.filter(m => m.type === 'warning').length

    return { success: true, metrics, screenshots, video: videoResult, html: htmlContent, network: networkRequests }
  } finally {
    await page.close()
  }
}

async function processJob(browserState, job, prefetchedResult = null) {
  console.log(`[${NODE_ID}] crawling ${job.url}`)
  try {
    let result = prefetchedResult
    try {
      if (!result) {
        const browser = await ensureBrowser(browserState)
        result = await crawlUrl(browser, job.url)
      }
    } catch (crawlErr) {
      if (isConnectionClosedError(crawlErr)) {
        const browser = await relaunchBrowser(browserState, `browser crashed for ${job.url}, retrying with minimal crawl`)
        const page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
        await page.goto(job.url, { waitUntil: 'load', timeout: 20000 }).catch(() => {})
        await new Promise(r => setTimeout(r, 1000))
        const EXTRACT_SCRIPT_MIN = `(function(){try{const d=document;return {totalElements:d.querySelectorAll('*').length,colors:[],fontSizes:[],fontFamilies:[],fontWeights:[],paddings:[],borderRadii:[],gaps:[],shadows:[],divSpanCount:0,backdropBlurs:0,animations:0,gradients:0,scripts:d.querySelectorAll('script').length,cssCustomProps:0,totalElements2:0}}catch(e){return null}})()`
        const minMetrics = await page.evaluate(EXTRACT_SCRIPT_MIN).catch(() => null)
        await page.close().catch(() => {})
        if (!minMetrics) throw crawlErr
        result = { metrics: minMetrics, screenshots: {} }
      } else {
        throw crawlErr
      }
    }
    const metrics = { ...result.metrics }
    const screenshots = result.screenshots || {}
    const imageScreenshots = {}

    for (const [key, value] of Object.entries(screenshots)) {
      const isImageBase64 = typeof value === 'string' && !key.endsWith('ascii') && /^(desktop|tablet|iphone)-/.test(key)
      if (isImageBase64) {
        imageScreenshots[key] = value
        continue
      }

      if (key === 'viewport-matrix') metrics._viewportMatrix = value
      else if (key === 'desktop-ascii') metrics._asciiArt = value
      else if (key === 'region-fragments') metrics._regionFragments = value
      else if (key === 'temporal') metrics._temporal = value
      else if (key === 'interaction-replay') metrics._interactionReplay = value
    }

    const storeRes = await fetch(`${API}/dataset/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: job.url,
        domain: job.domain || new URL(job.url).hostname.replace(/^www\./, ''),
        category: job.category || 'submitted',
        label: job.label || 'good',
        metrics,
        screenshots: imageScreenshots,
      }),
    })
    const stored = await storeRes.json()

    const uploads = []
    const upload = (filename, data, isBase64 = false) => {
      const body = isBase64 ? { filename, dataBase64: data } : { filename, data: typeof data === 'string' ? data : JSON.stringify(data) }
      return fetch(`${API}/dataset/${stored.id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {})
    }

    if (result.video) uploads.push(upload('scroll.webm', result.video, true))
    if (result.html) uploads.push(upload('page.html', result.html))
    if (result.network?.length) uploads.push(upload('network.json', { total: result.network.length, requests: result.network.slice(0, 80) }))
    if (metrics._viewportMatrix) uploads.push(upload('viewport-matrix.json', metrics._viewportMatrix))
    if (metrics._temporal) uploads.push(upload('temporal.json', metrics._temporal))
    if (metrics._interactionReplay) uploads.push(upload('interaction-replay.json', metrics._interactionReplay))
    if (metrics._regionFragments) uploads.push(upload('region-fragments.json', metrics._regionFragments))
    if (metrics._asciiArt) uploads.push(upload('desktop-ascii.txt', metrics._asciiArt))
    await Promise.all(uploads)

    await reportResult(job.id, { status: 'done', site_id: stored.id, score: stored.score })
    console.log(`[${NODE_ID}] done ${job.url}: ${stored.score} (${stored.grade})`)
  } catch (err) {
    console.error(`[${NODE_ID}] failed ${job.url}:`, err.message)
    await reportResult(job.id, { status: 'failed', error: err.message })
  }
}

async function main() {
  const CRAWL_ONCE = process.env.CRAWL_ONCE
  const browserState = { current: null, relaunching: null }

  if (CRAWL_ONCE) {
    const stdoutMode = process.env.CRAWL_ONCE_STDOUT === '1'
    const exactMode = process.env.CRAWL_ONCE_EXACT === '1'
    const forceFast = process.env.CRAWL_ONCE_FAST === '1'
    process.stderr.write(`[${NODE_ID}] launching browser...\n`)
    const browser = await ensureBrowser(browserState)
    try {
      const includeScreenshots = process.env.CRAWL_ONCE_SCREENSHOTS === '1'
      const result = await crawlUrl(browser, CRAWL_ONCE, {
        artifacts: !stdoutMode || includeScreenshots,
        fast: !exactMode && (forceFast || (stdoutMode && !includeScreenshots)),
      })
      if (stdoutMode) {
        process.stdout.write(JSON.stringify({
          metrics: result.metrics,
          ...(includeScreenshots ? { screenshots: result.screenshots } : {})
        }) + '\n')
      } else {
        await processJob(browserState, { id: 0, url: CRAWL_ONCE, domain: new URL(CRAWL_ONCE).hostname.replace(/^www\./, ''), category: 'submitted', label: 'good' }, result)
        process.stderr.write(`[${NODE_ID}] done. Check: npx @mdvp/cli audit ${new URL(CRAWL_ONCE).hostname.replace(/^www\./, '')}\n`)
      }
    } catch (e) {
      if (!stdoutMode && isConnectionClosedError(e)) {
        await processJob(browserState, { id: 0, url: CRAWL_ONCE, domain: new URL(CRAWL_ONCE).hostname.replace(/^www\./, ''), category: 'submitted', label: 'good' })
        process.stderr.write(`[${NODE_ID}] done. Check: npx @mdvp/cli audit ${new URL(CRAWL_ONCE).hostname.replace(/^www\./, '')}\n`)
      } else {
        process.stderr.write(`[${NODE_ID}] error: ${e.message}\n`)
        process.exit(1)
      }
    }
    await browserState.current?.close().catch(() => {})
    process.exit(0)
  }

  console.log(`[${NODE_ID}] starting (${TABS} tabs, polling every ${POLL_INTERVAL}ms)`)
  await ensureBrowser(browserState)

  let running = 0

  async function worker() {
    while (true) {
      if (running >= TABS) { await new Promise(r => setTimeout(r, 1000)); continue }
      const job = await claimJob()
      if (!job) { await new Promise(r => setTimeout(r, POLL_INTERVAL)); continue }
      running++
      processJob(browserState, job).finally(() => running--)
    }
  }

  const workers = Array.from({ length: TABS }, () => worker())
  await Promise.all(workers)
}

process.on('SIGINT', () => { console.log(`[${NODE_ID}] shutting down`); process.exit(0) })
main().catch(console.error)
