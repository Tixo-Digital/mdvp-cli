import { API, pickModule } from '../lib/http.mjs'
import { loadConfig } from '../lib/config.mjs'
import { DIM, RED, YELLOW, parseDomain } from '../lib/format.mjs'
import { R } from '../lib/constants.mjs'
import { spawn } from 'child_process'
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { homedir } from 'os'

async function cmdPerceive(arg1, opts, flags, positional) {
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
}
export { cmdPerceive }
