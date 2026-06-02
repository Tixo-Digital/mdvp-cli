import { apiGet, apiPost, API } from '../lib/http.mjs'
import { loadConfig } from '../lib/config.mjs'
import { DIM, BOLD, RED, scoreColor, bar, parseDomain, toTextFormat } from '../lib/format.mjs'
import { R } from '../lib/constants.mjs'
import { CATS } from '../lib/constants.mjs'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
// Bundled engine — lives at engine/ relative to the CLI root (one level up from commands/)
const ENGINE_DIR = join(__dir, '..', 'engine')
const CRAWLER_WORKER = join(ENGINE_DIR, 'crawler-worker.mjs')
const EXTRACT_JS = join(ENGINE_DIR, 'extract.js')

async function cmdAuditLocal(domain, opts) {
  const { json, raw, text } = opts
  const { spawn } = await import("child_process")
  const { existsSync, writeFileSync, mkdirSync } = await import("fs")
  const dir = `${homedir()}/.mdvp/crawler`

  // Use bundled engine files — no cloud download needed
  if (!existsSync(`${dir}/crawler-worker.mjs`)) {
    mkdirSync(dir, { recursive: true })
    // Symlink or copy bundled files into the puppeteer working dir
    const { copyFileSync } = await import("fs")
    copyFileSync(CRAWLER_WORKER, `${dir}/crawler-worker.mjs`)
    copyFileSync(EXTRACT_JS, `${dir}/extract.js`)
    writeFileSync(`${dir}/package.json`, '{"type":"module","dependencies":{"puppeteer":"*"}}')
  } else {
    // Keep bundled files in sync with installed package version
    const { copyFileSync } = await import("fs")
    copyFileSync(CRAWLER_WORKER, `${dir}/crawler-worker.mjs`)
    copyFileSync(EXTRACT_JS, `${dir}/extract.js`)
  }

  if (!existsSync(`${dir}/node_modules/puppeteer`)) {
    process.stderr.write(`${DIM}installing puppeteer (first run ~30s)...${R}\n`)
    await new Promise((res, rej) => {
      const child = spawn("npm", ["install", "--prefer-offline"], { cwd: dir, stdio: "inherit" })
      child.on("exit", (code) => code === 0 ? res() : rej(new Error(`npm install failed`)))
    })
  }

  const isLinux = process.platform === "linux"
  let chromiumPath = undefined
  if (isLinux) {
    const { execSync } = await import("child_process")
    const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"]
    for (const p of candidates) {
      try { execSync(`test -x ${p}`, { stdio: "ignore" }); chromiumPath = p; break } catch {}
    }
    if (!chromiumPath) {
      process.stderr.write(`${DIM}installing chromium...${R}\n`)
      execSync("apt-get install -y chromium-browser 2>/dev/null || snap install chromium 2>/dev/null || true", { stdio: "inherit" })
      for (const p of candidates) {
        try { execSync(`test -x ${p}`, { stdio: "ignore" }); chromiumPath = p; break } catch {}
      }
    }
  }

  process.stderr.write(`${DIM}crawling https://${domain} locally...${R}\n`)

  const { spawn: spawnChild } = await import("child_process")
  const result = await new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CRAWL_ONCE: `https://${domain}`,
      CRAWL_ONCE_STDOUT: "1",
      TABS: "1",
      // No API_URL needed — local scoring is done in-process after crawl
      ...(chromiumPath ? { PUPPETEER_EXECUTABLE_PATH: chromiumPath } : {}),
    }
    const child = spawnChild("node", [`${dir}/crawler-worker.mjs`], { env, cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let errOut = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => { errOut += d; process.stderr.write(d) })
    child.on("exit", () => {
      try { resolve(JSON.parse(out)) }
      catch { reject(new Error(errOut.slice(-300) || "crawler returned no data")) }
    })
  })

  if (!result || !result.metrics) {
    console.error(`${RED}Crawl failed — no metrics returned${R}`)
    process.exit(1)
  }

  // Score locally — no cloud call needed
  const { scoreDOMMetrics } = await import(`${ENGINE_DIR}/scorer.mjs`)
  const score = scoreDOMMetrics(result.metrics)
  const bd = score.breakdown.map((b) => ({ c: b.category, s: b.score }))
  const sorted = [...bd].sort((a, b) => a.s - b.s)

  const site = { id: domain, url: `https://${domain}`, overall_score: score.overall, grade: score.grade, label: null, scores: { breakdown: bd } }

  if (json) {
    console.log(JSON.stringify({ id: site.id, url: site.url, grade: score.grade, overall_score: score.overall, scores: { overall: score.overall, grade: score.grade, breakdown: Object.fromEntries(bd.map((b) => [b.c, b.s])), worst: sorted.slice(0, 3).map((b) => ({ key: b.c, score: b.s })) } }, null, 2))
    return
  }

  if (text) { console.log(toTextFormat(site, bd)); return }

  console.log(`\n${BOLD}${domain}${R}  ${scoreColor(score.overall)}${score.grade}  ${score.overall}/100${R}  ${DIM}local crawl${R}\n`)
  for (const cat of Object.keys(CATS)) {
    const s = bd.find((b) => b.c === cat)?.s ?? 0
    console.log(`  ${CATS[cat].padEnd(16)}  ${scoreColor(s)}${bar(s)}${R}  ${s}`)
  }
  console.log(`\n${DIM}Lowest: ${sorted.slice(0, 3).map((i) => `${CATS[i.c] ?? i.c} (${i.s})`).join(" · ")}${R}\n`)
}

async function cmdAudit(domain, opts) {
  const { json, raw, text, apiKey, local } = opts
  domain = parseDomain(domain)

  if (local) return cmdAuditLocal(domain, opts)

  if ((json || raw || text) && !apiKey) {
    console.error(`${RED}--json and --raw require an API key (costs 1 credit).${R}`)
    console.error(`${DIM}Run: npx @mdvp/cli login  or  npx @mdvp/cli balance${R}`)
    process.exit(1)
  }

  process.stderr.write(`${DIM}fetching ${domain}...${R}\n`)
  const headers = apiKey ? { "x-api-key": apiKey } : {}

  let site = null
  try {
    const direct = await apiGet(`/dataset/${domain}`, API, headers)
    if (direct?.error && /api key/i.test(direct.error)) {
      console.error(`${RED}${direct.error}${R}`)
      console.error(`${DIM}Run: npx @mdvp/cli login${R}`)
      process.exit(1)
    }
    if (direct && direct.id) site = direct
  } catch (_) {}

  if (!site) {
    const data = await apiGet(`/dataset?limit=1000`, API, headers)
    if (data?.error && /api key/i.test(data.error)) {
      console.error(`${RED}${data.error}${R}`)
      console.error(`${DIM}Run: npx @mdvp/cli login${R}`)
      process.exit(1)
    }
    site = (data.sites ?? []).find((s) => s.id === domain) ?? null
  }

  if (!site) {
    if (json || raw) { console.log(JSON.stringify({ error: "not_in_dataset", domain }, null, 2)); process.exit(1) }
    console.error(`${RED}not in dataset: ${domain}${R}`)
    console.error(`${DIM}submit for crawl: npx @mdvp/cli submit ${domain}${R}`)
    process.exit(1)
  }

  const bd = site.scores?.breakdown ?? []
  const sorted = [...bd].sort((a, b) => a.s - b.s)

  if (raw) {
    const output = {
      id: site.id,
      url: site.url,
      domain: site.domain ?? site.id,
      grade: site.grade,
      overall_score: site.overall_score,
      label: site.label,
      category: site.category,
      scored_at: site.scored_at ?? null,
      scores: {
        overall: site.overall_score,
        grade: site.grade,
        breakdown: bd.map((b) => ({ category: CATS[b.c] ?? b.c, key: b.c, score: b.s })),
        worst: sorted.slice(0, 3).map((b) => ({ key: b.c, category: CATS[b.c] ?? b.c, score: b.s })),
        best: sorted.slice(-3).reverse().map((b) => ({ key: b.c, category: CATS[b.c] ?? b.c, score: b.s })),
      },
      metrics: site.metrics ?? null,
      assets: (() => {
        const base = `https://api.mdvp.dev/dataset/${site.id}/file`
        return {
          screenshots: {
            desktop: `${base}/desktop-1440.jpg`,
            mobile: `${base}/iphone-390.jpg`,
            tablet: `${base}/ipad-1024.jpg`,
          },
          video: `${base}/scroll.webm`,
          dom: {
            html: `${base}/page.html`,
            metrics: `${base}/metrics.json`,
            scores: `${base}/scores.json`,
            features: `${base}/features.json`,
          },
          diagnostics: {
            console: `${base}/console.json`,
            network: `${base}/network.json`,
            a11y: `${base}/a11y.json`,
            css_coverage: `${base}/css-coverage.json`,
          },
          files_index: `https://api.mdvp.dev/dataset/${site.id}/files`,
        }
      })(),
      mdvp: { version: "1", api: "https://api.mdvp.dev", dataset_url: `https://api.mdvp.dev/dataset/${site.id}` },
    }
    console.log(JSON.stringify(output, null, 2))
    if (apiKey) await apiPost("/audit/charge", { domain, type: "raw", amount: 0.20 }, apiKey).catch(() => {})
    return
  }

  if (text) {
    console.log(toTextFormat(site, bd))
    if (apiKey) await apiPost("/audit/charge", { domain, type: "json", amount: 0.10 }, apiKey).catch(() => {})
    return
  }

  if (json) {
    const output = {
      id: site.id,
      url: site.url,
      grade: site.grade,
      overall_score: site.overall_score,
      label: site.label,
      scored_at: site.scored_at ?? null,
      scores: {
        overall: site.overall_score,
        grade: site.grade,
        breakdown: Object.fromEntries(bd.map((b) => [b.c, b.s])),
        worst: sorted.slice(0, 3).map((b) => ({ key: b.c, score: b.s })),
      },
    }
    console.log(JSON.stringify(output, null, 2))
    if (apiKey) await apiPost("/audit/charge", { domain, type: "json", amount: 0.10 }, apiKey).catch(() => {})
    return
  }

  console.log(`\n${BOLD}${site.id}${R}  ${scoreColor(site.overall_score)}${site.grade}  ${site.overall_score}/100${R}  ${DIM}${site.label}${R}\n`)
  for (const cat of Object.keys(CATS)) {
    const s = bd.find((b) => b.c === cat)?.s ?? 0
    console.log(`  ${CATS[cat].padEnd(16)}  ${scoreColor(s)}${bar(s)}${R}  ${s}`)
  }
  console.log(`\n${DIM}Lowest: ${sorted.slice(0, 3).map((i) => `${CATS[i.c] ?? i.c} (${i.s})`).join(" · ")}${R}\n`)
}


export { cmdAudit, cmdAuditLocal }
