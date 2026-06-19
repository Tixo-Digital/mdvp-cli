import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dir, '..')
const PKG = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'))
const MANIFEST = join(ROOT_DIR, 'native', 'mdvp-static', 'Cargo.toml')
const NATIVE_SOURCE_FILES = [
  MANIFEST,
  join(ROOT_DIR, 'native', 'mdvp-static', 'src', 'main.rs'),
]
const CACHE_DIR = join(homedir(), '.mdvp', 'native', 'mdvp-static', `v${PKG.version}`)
const BIN_NAME = process.platform === 'win32' ? 'mdvp-static.exe' : 'mdvp-static'
const BUILT_BIN = join(CACHE_DIR, 'release', BIN_NAME)

export async function analyzeStaticUrl(url, opts = {}) {
  const fetched = await fetchStaticHtml(url, opts)
  const html = await inlineSameOriginCss(fetched.html, fetched.url, opts)
  const native = runNativeAnalyzer(html, fetched.url)
  if (native) {
    return {
      metrics: normalizeStaticMetrics(native, 'rust'),
      analysis: {
        mode: 'static',
        analyzer: 'rust',
        url: fetched.url,
        confidence: 'medium',
        limitations: STATIC_LIMITATIONS,
      },
    }
  }

  return {
    metrics: normalizeStaticMetrics(analyzeStaticHtmlFallback(html), 'js-fallback'),
    analysis: {
      mode: 'static',
      analyzer: 'js-fallback',
      url: fetched.url,
      confidence: 'low',
      limitations: STATIC_LIMITATIONS,
    },
  }
}

const STATIC_LIMITATIONS = [
  'no browser layout',
  'no computed styles',
  'no client-side rendered DOM after JavaScript',
  'no screenshots or motion artifacts',
]

async function fetchStaticHtml(url, opts) {
  const timeoutMs = Number(opts.timeout || process.env.MDVP_STATIC_TIMEOUT_MS || 8000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'text/html,application/xhtml+xml',
        'user-agent': 'mdvp-cli static audit',
      },
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return { url: response.url || url, html: await response.text() }
  } finally {
    clearTimeout(timer)
  }
}

async function inlineSameOriginCss(html, baseUrl, opts) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\brel\s*=\s*["'][^"']*stylesheet/i.test(tag) || /\brel\s*=\s*stylesheet\b/i.test(tag))
    .map((tag) => attr(tag, 'href'))
    .filter(Boolean)
    .slice(0, Number(opts.maxStylesheets || 6))

  if (links.length === 0) return html

  const origin = new URL(baseUrl).origin
  const cssUrls = []
  for (const href of links) {
    try {
      const cssUrl = new URL(href, baseUrl)
      if (cssUrl.origin === origin) cssUrls.push(cssUrl)
    } catch {
      continue
    }
  }

  const styles = (await Promise.all(cssUrls.map((cssUrl) => fetchStylesheet(cssUrl)))).filter(Boolean)
  if (styles.length === 0) return html
  return `${html}\n<style data-mdvp-static-css>\n${styles.join('\n')}\n</style>`
}

async function fetchStylesheet(cssUrl) {
  try {
    const response = await fetch(cssUrl, {
      headers: { 'accept': 'text/css,*/*;q=0.1', 'user-agent': 'mdvp-cli static audit' },
      signal: AbortSignal.timeout(Number(process.env.MDVP_STATIC_CSS_TIMEOUT_MS || 4000)),
    })
    if (!response.ok) return null
    const css = (await response.text()).slice(0, 500_000)
    return `/* ${cssUrl.href} */\n${css}`
  } catch {
    return null
  }
}

function runNativeAnalyzer(html, url) {
  const bin = findNativeBinary()
  if (!bin) return null
  const result = spawnSync(bin, [url], {
    input: html,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10_000,
  })
  if (result.status !== 0 || !result.stdout.trim()) return null
  try {
    return JSON.parse(result.stdout)
  } catch {
    return null
  }
}

function findNativeBinary() {
  if (process.env.MDVP_STATIC_ANALYZER && existsSync(process.env.MDVP_STATIC_ANALYZER)) {
    return process.env.MDVP_STATIC_ANALYZER
  }
  if (existsSync(BUILT_BIN) && nativeBinaryIsFresh()) return BUILT_BIN
  if (!existsSync(MANIFEST) || !commandExists('cargo')) return null

  mkdirSync(CACHE_DIR, { recursive: true })
  const build = spawnSync('cargo', ['build', '--release', '--manifest-path', MANIFEST], {
    env: { ...process.env, CARGO_TARGET_DIR: CACHE_DIR },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  })
  return build.status === 0 && existsSync(BUILT_BIN) ? BUILT_BIN : null
}

function nativeBinaryIsFresh() {
  try {
    const builtAt = statSync(BUILT_BIN).mtimeMs
    return NATIVE_SOURCE_FILES.every((file) => !existsSync(file) || statSync(file).mtimeMs <= builtAt)
  } catch {
    return false
  }
}

function commandExists(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [command] : ['-v', command], {
    shell: process.platform !== 'win32',
    stdio: 'ignore',
  })
  return result.status === 0
}

function normalizeStaticMetrics(metrics, analyzer) {
  return {
    totalElements: 0,
    colors: [],
    fontSizes: [],
    fontFamilies: [],
    fontWeights: [],
    paddings: [],
    margins: [],
    borderRadii: [],
    gaps: [],
    lineHeights: [],
    shadows: [],
    overflows: 0,
    emojiCount: 0,
    divRatio: 0,
    landmarkCount: 0,
    h1Count: 0,
    emptyLinks: 0,
    imagesWithoutAlt: 0,
    externalScripts: 0,
    hasViewportMeta: false,
    hasLangAttr: false,
    metaDescription: null,
    titleTag: null,
    backdropBlurCount: 0,
    animationCount: 0,
    gradientCount: 0,
    gradientBackgroundCount: 0,
    gradientBackgroundLayerCount: 0,
    maxLineLength: 0,
    genericTextCount: 0,
    customProperties: 0,
    hasDarkMode: false,
    hasContainerQueries: false,
    hasSrcset: false,
    unicodeSymbols: 0,
    rasterLogos: 0,
    svgIcons: 0,
    rasterIcons: 0,
    genericButtonTexts: 0,
    textOverflows: 0,
    lineHeightIssues: 0,
    lineLengthIssues: 0,
    letterSpacingAllCaps: 0,
    ctaCount: 0,
    navItemCount: 0,
    pulseAnimationCount: 0,
    gradientTextCount: 0,
    statusDotCount: 0,
    eyebrowCount: 0,
    ...metrics,
    analysisMode: 'static',
    staticAnalyzer: analyzer,
  }
}

function analyzeStaticHtmlFallback(html) {
  const lower = html.toLowerCase()
  const tags = [...html.matchAll(/<([a-z][a-z0-9-]*)(?:\s[^>]*)?>/gi)].map((match) => match[0].toLowerCase())
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n')
  const cssLower = css.toLowerCase()
  const total = tags.length
  const countTag = (name) => tags.filter((tag) => tag.startsWith(`<${name}`)).length
  const landmarks = ['nav', 'main', 'article', 'aside', 'header', 'footer', 'section'].reduce((n, tag) => n + countTag(tag), 0)
  const divSpan = countTag('div') + countTag('span')
  const gradientLayers = (cssLower.match(/-gradient\(/g) || []).length
  const gradientBackgrounds = countGradientBackgroundDeclarations(cssLower)
  return {
    totalElements: total,
    colors: extractCssValues(css, /#[0-9a-f]{6}\b|rgba?\([^)]+\)/gi),
    fontSizes: declarationValues(css, 'font-size'),
    fontFamilies: declarationValues(css, 'font-family').map(([v, c]) => [v.split(',')[0].replace(/["']/g, '').trim(), c]),
    fontWeights: declarationValues(css, 'font-weight'),
    paddings: declarationValues(css, 'padding'),
    margins: declarationValues(css, 'margin'),
    borderRadii: declarationValues(css, 'border-radius'),
    gaps: declarationValues(css, 'gap'),
    lineHeights: declarationValues(css, 'line-height'),
    shadows: declarationValues(css, 'box-shadow'),
    divRatio: total > 0 ? Math.round(divSpan / total * 100) / 100 : 0,
    landmarkCount: landmarks,
    h1Count: countTag('h1'),
    emptyLinks: (lower.match(/<a\b[^>]*href=["'](?:#|javascript:void\(0\)|javascript:;)["']/g) || []).length,
    imagesWithoutAlt: tags.filter((tag) => tag.startsWith('<img') && !/\salt=/.test(tag)).length,
    hasViewportMeta: /<meta\b[^>]*name=["']viewport/i.test(html),
    hasLangAttr: /<html\b[^>]*\slang=/i.test(html),
    metaDescription: attr((html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i) || [])[0] || '', 'content'),
    titleTag: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || null,
    customProperties: (css.match(/--[\w-]+\s*:/g) || []).length,
    hasDarkMode: cssLower.includes('prefers-color-scheme'),
    hasContainerQueries: cssLower.includes('@container'),
    hasSrcset: /\ssrcset=/.test(lower),
    gradientCount: gradientLayers,
    gradientBackgroundCount: gradientBackgrounds,
    gradientBackgroundLayerCount: gradientLayers,
    ctaCount: (lower.match(/get started|sign up|try|buy|contact|book|start/g) || []).length,
    navItemCount: ((lower.match(/<nav[\s\S]*?<\/nav>/) || [''])[0].match(/<(a|button)\b/g) || []).length,
  }
}

function countGradientBackgroundDeclarations(css) {
  return [...css.matchAll(/\bbackground(?:-image)?\s*:\s*([^;}{]+)/g)]
    .filter((match) => match[1].includes('gradient('))
    .length
}

function declarationValues(css, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return extractCssValues(css, new RegExp(`${escaped}\\s*:\\s*([^;}{]+)`, 'gi'), 1)
}

function extractCssValues(css, pattern, group = 0) {
  const counts = new Map()
  for (const match of css.matchAll(pattern)) {
    const raw = String(match[group] || '').trim().split(/\s+/)[0]
    if (!raw || raw === '0' || raw === '0px' || raw === 'none' || raw === 'normal') continue
    counts.set(raw, (counts.get(raw) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1] || null
}
