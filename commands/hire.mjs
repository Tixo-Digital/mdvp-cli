import { API } from '../lib/http.mjs'
import { loadConfig } from '../lib/config.mjs'
import { DIM, RED, YELLOW } from '../lib/format.mjs'
import { R } from '../lib/constants.mjs'
import { spawn } from 'child_process'
import { existsSync, writeFileSync, readFileSync, copyFileSync, mkdirSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUNDLED_WORKER = join(__dirname, '../engine/crawler-worker.mjs')
const BUNDLED_EXTRACT = join(__dirname, '../engine/extract.js')

async function cmdHire(opts) {
  const { daemon, tabs, local, _url, _once } = opts
  const { spawn } = await import("child_process")
  const { existsSync } = await import("fs")
  const dir = `${homedir()}/.mdvp/crawler`

  if (!_once) {
    console.log(`${DIM}${ASCII}${R}\n`)
    console.log(`${BOLD}Hiring as crawler node...${R}`)
  }

  mkdirSync(dir, { recursive: true })

  // Use bundled worker from engine/ — same source as github.com/Tixo-Digital/mdvp-cli
  if (existsSync(BUNDLED_WORKER)) {
    process.stderr.write(`${DIM}Using bundled worker (engine/crawler-worker.mjs)${R}\n`)
    copyFileSync(BUNDLED_WORKER, `${dir}/crawler-worker.mjs`)
    if (existsSync(BUNDLED_EXTRACT)) copyFileSync(BUNDLED_EXTRACT, `${dir}/extract.js`)
  } else {
    // Fallback: download from API (development installs, global npx without bundled files)
    process.stderr.write(`${DIM}Downloading worker from ${API}...${R}\n`)
    const workerUrl = `${API}/crawler-worker.mjs`
    const extractUrl = `${API}/extract.js`
    const download = (url, dest) => new Promise((res, rej) => {
      const { get: g } = pickModule(url)
      g(url, { headers: { Accept: "text/plain" } }, (r) => {
        let body = ""
        r.on("data", (c) => (body += c))
        r.on("end", () => { try { writeFileSync(dest, body); res() } catch { rej(new Error("write failed")) } })
      }).on("error", rej)
    })
    await download(workerUrl, `${dir}/crawler-worker.mjs`)
      .catch(() => process.stderr.write(`${DIM}Could not download worker${R}\n`))
    await download(extractUrl, `${dir}/extract.js`)
      .catch(() => {})
  }

  writeFileSync(`${dir}/package.json`, '{"type":"module","dependencies":{"puppeteer":"*"}}')

  const needsInstall = !existsSync(`${dir}/node_modules/puppeteer`)
  if (needsInstall) {
    process.stderr.write(`${DIM}Installing puppeteer (first run, ~60s)...${R}\n`)
    const installed = await new Promise((res) => {
      const child = spawn("npm", ["install", "--prefer-offline"], { cwd: dir, stdio: "inherit" })
      child.on("exit", (code) => res(code === 0))
      child.on("error", () => res(false))
    })
    if (!installed) {
      process.stderr.write(`${DIM}npm install failed, trying npx puppeteer...${R}\n`)
      await new Promise((res) => {
        const child = spawn("npx", ["puppeteer", "browsers", "install", "chrome"], { cwd: dir, stdio: "inherit", env: { ...process.env, PUPPETEER_CACHE_DIR: dir } })
        child.on("exit", () => res(true))
        child.on("error", () => res(false))
      })
    }
  }

  const apiUrl = local ? "http://localhost:7227" : API
  const nodeId = `mdvp-${Math.random().toString(36).slice(2, 8)}`

  let chromiumEnv = {}
  if (process.platform === "linux" && !process.env.PUPPETEER_EXECUTABLE_PATH) {
    const { execSync: es } = await import("child_process")
    for (const p of ["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser","/snap/bin/chromium"]) {
      try { es(`test -x ${p}`, { stdio: "ignore" }); chromiumEnv = { PUPPETEER_EXECUTABLE_PATH: p }; break } catch {}
    }
  }

  const env = { ...process.env, ...chromiumEnv, NODE_ID: nodeId, TABS: String(tabs || 2), API_URL: apiUrl, ...(_url ? { CRAWL_ONCE: _url } : {}) }

  if (_once && _url) {
    process.stderr.write(`${DIM}running local crawl for ${_url}...${R}\n`)
    const child = spawn("node", [`${dir}/crawler-worker.mjs`], { env, cwd: dir, stdio: "inherit" })
    await new Promise((res) => child.on("exit", res))
    console.log(`\n  ${BOLD}Done!${R} Check: npx @mdvp/cli audit ${_url.replace(/^https?:\/\//, "")}`)
    return
  }

  if (daemon) {
    const { openSync } = await import("fs")
    const log = `${dir}/worker-${process.pid}.log`
    const out = openSync(log, "a")
    const child = spawn("node", [`${dir}/crawler-worker.mjs`], { env, cwd: dir, detached: true, stdio: ["ignore", out, out] })
    child.unref()
    console.log(`${GREEN}Worker started in background${R}`)
    console.log(`  PID: ${child.pid}`)
    console.log(`  Log: ${log}`)
    console.log(`  Stop: kill ${child.pid}`)
    console.log(`  Node: ${nodeId}`)
  } else {
    console.log(`${GREEN}Starting crawler node ${nodeId}${R} (Ctrl+C to stop)\n`)
    const child = spawn("node", [`${dir}/crawler-worker.mjs`], { env, cwd: dir, stdio: "inherit" })
    await new Promise((res) => child.on("exit", res))
  }
}

async function cmdRecrawl(opts, domains) {
  const { apiKey } = opts
  if (!apiKey) { console.error(`${RED}No API key. Run: npx @mdvp/cli login${R}`); process.exit(1) }

  const limit = opts.limit || 50
  const body = domains.length > 0 ? { domains } : { limit }
  process.stderr.write(`${DIM}queuing ${domains.length > 0 ? domains.join(', ') : `up to ${limit} oldest`} for recrawl...${R}\n`)

  const d = await apiPost("/crawl/recrawl", body, apiKey)
  if (d.error) { console.error(`${RED}Error: ${d.error}${R}`); process.exit(1) }
  console.log(`\n  ${BOLD}Queued!${R} ${d.queued} sites scheduled for recrawl.`)
  console.log(`  ${DIM}Run: npx @mdvp/cli hire --tabs=4 to start crawling${R}\n`)
}

async function cmdSubmit(domain, opts) {
  const { apiKey, local } = opts
  domain = parseDomain(domain)

  if (local) {
    if (!apiKey) {
      console.error(`${RED}API key required for local crawl. Run: npx @mdvp/cli login${R}`)
      console.error(`${DIM}Free to crawl, but we need to know who you are.${R}`)
      process.exit(1)
    }
    process.stderr.write(`${DIM}crawling ${domain} locally ($0.03, key: ${apiKey.slice(0, 8)}...)...${R}\n`)
    await apiPost("/audit/charge", { domain, type: "local_crawl", amount: 0.03 }, apiKey).catch(() => {})
    await cmdHire({ ...opts, domain, daemon: false, _url: `https://${domain}`, _once: true })
    return
  }

  if (!apiKey) { console.error(`${RED}No API key. Run: npx @mdvp/cli login${R}`); process.exit(1) }
  process.stderr.write(`${DIM}submitting ${domain} → global crawler queue...${R}\n`)
  const d = await apiPost("/crawl/submit", { domain, url: `https://${domain}` }, apiKey)
  if (d.error) { console.error(`${RED}Error: ${d.error}${R}`); process.exit(1) }
  console.log(`\n  ${BOLD}Submitted!${R} ${domain} queued for crawl.`)
  console.log(`  ${DIM}Results in ~60s. Check: npx @mdvp/cli audit ${domain}${R}\n`)
}


export { cmdHire, cmdRecrawl, cmdSubmit }
