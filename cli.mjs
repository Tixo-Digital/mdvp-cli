#!/usr/bin/env node
import { homedir } from 'os'
import { readFileSync } from 'fs'
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { apiGet, apiPost, pickModule, API } from './lib/http.mjs'
import { loadConfig, saveConfig, CONFIG_DIR, CONFIG_FILE } from './lib/config.mjs'
import { VERSION, CATS, R, WELCOME, HELP_OVERVIEW, HELP_TOPICS, HELP_TOPIC_BY_COMMAND } from './lib/constants.mjs'
import { DIM, BOLD, RED, GREEN, YELLOW, scoreColor, bar, parseDomain, toTextFormat } from './lib/format.mjs'
import { cmdAudit } from './commands/audit.mjs'
import { cmdCompare, cmdTop } from './commands/compare.mjs'
import { cmdLogin, cmdBalance } from './commands/auth.mjs'
import { cmdHire, cmdRecrawl, cmdSubmit } from './commands/hire.mjs'

async function main() {
  const argv = process.argv.slice(2)
  const flags = new Set(argv.filter((a) => (a.startsWith("--") || a.startsWith("-")) && !a.includes("=")))
  const flagValues = Object.fromEntries(argv.filter((a) => a.includes("=")).map((a) => a.replace("--", "").split("=")))
  const positional = argv.filter((a) => !(a.startsWith("--") || /^-[a-zA-Z]$/.test(a)))
  const [cmd, arg1, arg2] = positional
  const wantsHelp = flags.has("--help") || flags.has("-h")
  const cfg = loadConfig()
  const opts = {
    json: flags.has("--json"),
    raw: flags.has("--raw"),
    text: flags.has("--text"),  // LLM-optimized compact format
    apiKey: cfg.apiKey ?? null,
    local: flags.has("--local"),  // deprecated: now the default; kept for backward compat
    cloud: flags.has("--cloud"),  // explicit cloud dataset lookup (was default before v1.32.0)
    swarm: flags.has("--swarm"),  // local audit + contribute to public dataset
    check: flags.has("--check"),  // threshold enforcement — exit 1 on violation
    design: flagValues.design || null,  // DESIGN.md path (default: auto-discover in cwd)
    daemon: flags.has("--daemon") || flags.has("-d"),
    tabs: parseInt(flagValues.tabs || "2") || 2,
  }

  if (cmd === "mcp") {
    const { createRequire } = await import("module")
    const { fileURLToPath } = await import("url")
    const { dirname, join } = await import("path")
    const __dir = dirname(fileURLToPath(import.meta.url))
    const mcpPath = join(__dir, "mcp.mjs")
    const { spawn } = await import("child_process")
    const child = spawn(process.execPath, [mcpPath], { stdio: "inherit" })
    child.on("exit", (code) => process.exit(code ?? 0))
    return
  } else if (!cmd && wantsHelp) {
    console.log(`${HELP_OVERVIEW}\n`)
  } else if (!cmd) {
    console.log(`${WELCOME}\n`)
  } else if (cmd === "help") {
    const topic = arg1 ? arg1.toLowerCase() : null
    if (!topic) {
      console.log(`${HELP_OVERVIEW}\n`)
      return
    }
    if (HELP_TOPICS[topic]) {
      console.log(`${HELP_TOPICS[topic]}\n`)
      return
    }
    console.error(`${YELLOW}Unknown help topic: ${topic}${R}\n`)
    console.log(`${HELP_OVERVIEW}\n`)
    process.exit(1)
  } else if (wantsHelp && cmd) {
    const topic = HELP_TOPIC_BY_COMMAND[cmd]
    if (topic && HELP_TOPICS[topic]) {
      console.log(`${HELP_TOPICS[topic]}\n`)
      return
    }
    console.log(`${HELP_OVERVIEW}\n`)
    return
  } else if (cmd === "login") {
    await cmdLogin()
  } else if (cmd === "audit" && arg1) {
    await cmdAudit(arg1, opts)
  } else if (cmd === "submit" && arg1) {
    await cmdSubmit(arg1, opts)
  } else if (cmd === "balance") {
    await cmdBalance(opts)
  } else if (cmd === "compare" && arg1 && arg2) {
    await cmdCompare(arg1, arg2, opts)
  } else if (cmd === "top") {
    await cmdTop(parseInt(arg1 || "10") || 10, false, opts)
  } else if (cmd === "worst") {
    await cmdTop(parseInt(arg1 || "10") || 10, true, opts)
  } else if (cmd === "stats") {
    const d = await apiGet("/dataset/stats")
    if (opts.json) { console.log(JSON.stringify(d, null, 2)); return }
    console.log(`\n  Total sites:   ${d.totalSites}\n  Average score: ${d.averageScore}\n`)
  } else if (cmd === "perceive" && arg1) {
    const isLive = flags.has("--live")
    const noVision = flags.has("--no-vision")
    const targetUrl = arg1.startsWith("http") ? arg1 : `https://${arg1}`
    const domain = parseDomain(arg1)
    process.stderr.write(`${DIM}perceiving ${domain}${isLive ? " (live crawl)" : ""}...${R}\n`)

    let screenshotBase64 = null
    let metrics = null

    if (isLive) {
      const { spawn } = await import("child_process")
      const { existsSync } = await import("fs")
      const dir = `${homedir()}/.mdvp/crawler`
      if (!existsSync(`${dir}/crawler-worker.mjs`)) {
        process.stderr.write(`${DIM}downloading crawler...${R}\n`)
        mkdirSync(dir, { recursive: true })
        const dl = (url, dest) => new Promise((res, rej) => {
          const { get: g } = pickModule(url)
          g(url, { headers: { Accept: "text/plain" } }, (r) => {
            let body = ""; r.on("data", (c) => (body += c))
            r.on("end", () => { try { writeFileSync(dest, body); res() } catch { rej(new Error("write failed")) } })
          }).on("error", rej)
        })
        await dl(`${API}/crawler-worker.mjs`, `${dir}/crawler-worker.mjs`).catch(() => {})
        await dl(`${API}/extract.js`, `${dir}/extract.js`).catch(() => {})
        writeFileSync(`${dir}/package.json`, '{"type":"module","dependencies":{"puppeteer":"*"}}')
      }
      if (!existsSync(`${dir}/node_modules/puppeteer`)) {
        process.stderr.write(`${DIM}installing puppeteer...${R}\n`)
        await new Promise((res, rej) => {
          const child = spawn("npm", ["install", "--prefer-offline"], { cwd: dir, stdio: "inherit" })
          child.on("exit", (code) => code === 0 ? res() : rej(new Error("npm install failed")))
        })
      }
      const isLinux = process.platform === "linux"
      let chromiumPath
      if (isLinux) {
        const { execSync } = await import("child_process")
        for (const p of ["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"]) {
          try { execSync(`test -x ${p}`, { stdio: "ignore" }); chromiumPath = p; break } catch {}
        }
      }
      process.stderr.write(`${DIM}crawling + annotating screenshot...${R}\n`)
      const result = await new Promise((resolve, reject) => {
        const env2 = { ...process.env, CRAWL_ONCE: targetUrl, CRAWL_ONCE_STDOUT: "1", CRAWL_ONCE_SCREENSHOTS: "1", TABS: "1", API_URL: API, ...(chromiumPath ? { PUPPETEER_EXECUTABLE_PATH: chromiumPath } : {}) }
        const child = spawn("node", [`${dir}/crawler-worker.mjs`], { env: env2, cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
        let out = ""; let errOut = ""
        child.stdout.on("data", (d) => (out += d))
        child.stderr.on("data", (d) => { errOut += d; process.stderr.write(d) })
        child.on("exit", () => { try { resolve(JSON.parse(out)) } catch { reject(new Error(errOut.slice(-200) || "no data")) } })
      })
      metrics = result.metrics
      screenshotBase64 = result.screenshots?.["desktop-1440-annotated"] || result.screenshots?.["desktop-1440"] || null
      const viewportMatrix = result.screenshots?.["viewport-matrix"] || null
      const asciiArt = result.screenshots?.["desktop-ascii"] || null
      const regionFragments = result.screenshots?.["region-fragments"] || null
      const temporal = result.screenshots?.["temporal"] || null
      if (viewportMatrix && metrics) metrics._viewportMatrix = viewportMatrix
      if (asciiArt && metrics) metrics._asciiArt = asciiArt
      if (regionFragments && metrics) metrics._regionFragments = regionFragments
      if (temporal && metrics) metrics._temporal = temporal
      const interactionReplay = result.screenshots?.["interaction-replay"] || null
      if (interactionReplay && metrics) metrics._interactionReplay = interactionReplay

      if (flags.has("--tiv")) {
        const ascii = result.screenshots?.["desktop-ascii"]
        if (ascii) {
          process.stderr.write(`${DIM}rendering...${R}\n`)
          process.stdout.write(ascii)
          process.stdout.write('\n')
        } else if (screenshotBase64) {
          const { execSync } = await import("child_process")
          const tmpFile = `/tmp/mdvp-${domain}-${Date.now()}.jpg`
          writeFileSync(tmpFile, Buffer.from(screenshotBase64, "base64"))
          try {
            const tivOut = execSync(`tiv -w 120 "${tmpFile}" 2>/dev/null`, { encoding: "buffer" })
            process.stdout.write(tivOut)
          } catch {
            process.stderr.write(`${YELLOW}tiv not found — install: brew install tiv${R}\n`)
          }
          try { unlinkSync(tmpFile) } catch {}
        }
      }
    }

    const body = isLive
      ? JSON.stringify({ url: targetUrl, include_vision: !noVision, live: false, screenshotBase64, metrics })
      : JSON.stringify({ domain, include_vision: !noVision })

    const headers = { "Content-Type": "application/json", Accept: "text/plain" }
    if (opts.apiKey) headers["x-api-key"] = opts.apiKey

    const res = await new Promise((resolve, reject) => {
      const { request } = pickModule(API)
      const req = request(`${API}/perceive`, {
        method: "POST",
        headers,
      }, (r) => {
        let out = ""; r.on("data", (c) => (out += c)); r.on("end", () => resolve(out))
      })
      req.on("error", reject)
      req.write(body)
      req.end()
    })
    console.log(`\n${res}\n`)
  } else if (cmd === "recrawl") {
    const domains = positional.slice(1)
    await cmdRecrawl({ ...opts, limit: parseInt(flagValues.limit || "50") || 50 }, domains)
  } else if (cmd === "mcp-config") {
    const cfg = {
      mcpServers: {
        mdvp: {
          type: "local",
          command: ["npx", "-y", "-p", "@mdvp/cli@latest", "mdvp", "mcp"],
          ...(opts.apiKey ? { env: { MDVP_API_KEY: opts.apiKey } } : {})
        }
      }
    }
    if (opts.apiKey) {
      process.stderr.write(`${DIM}Token found — generating authenticated config${R}\n`)
    } else {
      process.stderr.write(`${YELLOW}No token found. Run: npx @mdvp/cli login${R}\n`)
      process.stderr.write(`${DIM}Generating unauthenticated config (x402 micropayments)${R}\n`)
    }
    console.log(JSON.stringify(cfg, null, 2))
  } else if (cmd === "hire" || cmd === "apply" || cmd === "serve") {
    await cmdHire(opts)
  } else if (cmd === "label" && arg1) {
    const data = await apiGet(`/dataset?limit=800`, API, opts.apiKey ? { "x-api-key": opts.apiKey } : {})
    if (data?.error) {
      console.error(`${RED}${data.error}${R}`)
      if (/api key/i.test(data.error)) console.error(`${DIM}Run: npx @mdvp/cli login${R}`)
      process.exit(1)
    }
    const sites = data.sites ?? []
    const filtered = sites.filter((s) => s.label === arg1).sort((a, b) => b.overall_score - a.overall_score).slice(0, 20)
    if (!filtered.length) { console.error(`No sites with label: ${arg1}`); process.exit(1) }
    console.log(`\n  ${filtered.length} sites · label=${arg1}\n`)
    for (const s of filtered) console.log(`  ${s.id.padEnd(28)}  ${scoreColor(s.overall_score)}${s.overall_score}${R}  ${s.grade}`)
    console.log()
  } else {
    console.error(`Unknown command: ${cmd}\nRun 'npx mdvp help' for usage.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`${RED}Error: ${err.message}${R}`)
  process.exit(1)
})
