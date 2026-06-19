import { DIM, RED, scoreColor, bar, parseDomain, toTextFormat, BOLD } from '../lib/format.mjs'
import { CATS, R } from '../lib/constants.mjs'
import { sourceLabel } from '../lib/source-label.mjs'
import { homedir } from 'os'
import { existsSync as fsExistsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const ENGINE_DIR = join(__dir, '..', 'engine')
const CRAWLER_WORKER = join(ENGINE_DIR, 'crawler-worker.mjs')
const EXTRACT_JS = join(ENGINE_DIR, 'extract.js')
const DEFAULT_LOCAL_CRAWL_TIMEOUT_MS = 60000
const LINUX_BROWSER_CANDIDATES = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"]
const DARWIN_BROWSER_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
]

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function cacheShortcutsEnabled(env = process.env) {
  return envFlag(env.MDVP_USE_CACHE)
}

function resolveLocalAuditRuntime(opts = {}, env = process.env) {
  const source = opts.source ?? 'local'
  if (source === 'swarm') return { mode: 'browser', reason: 'swarm contribution' }
  if (opts.exact) return { mode: 'browser', reason: 'exact flag' }

  const cacheEnabled = cacheShortcutsEnabled(env)
  if (opts.fast && !cacheEnabled) {
    return {
      mode: 'error',
      message: '--fast uses the approximate static/cache shortcut. Set MDVP_USE_CACHE=1 to opt in, or omit --fast to run the default exact browser audit.',
    }
  }

  if (cacheEnabled) return { mode: 'static', reason: opts.fast ? 'fast cache shortcut' : 'MDVP_USE_CACHE' }
  return { mode: 'browser', reason: 'default exact audit' }
}

function normalizeLocalCrawlTimeout(value, fallback = DEFAULT_LOCAL_CRAWL_TIMEOUT_MS) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveBrowserExecutable({ platform = process.platform, env = process.env, exists = fsExistsSync } = {}) {
  const configured = String(env.PUPPETEER_EXECUTABLE_PATH || '').trim()
  if (configured && exists(configured)) return configured
  const candidates = platform === 'darwin'
    ? DARWIN_BROWSER_CANDIDATES
    : platform === 'linux'
      ? LINUX_BROWSER_CANDIDATES
      : []
  return candidates.find((candidate) => exists(candidate))
}

function terminateCrawlerChild(child) {
  if (!child || child.killed) return
  try {
    if (process.platform === 'win32') child.kill('SIGTERM')
    else process.kill(-child.pid, 'SIGTERM')
  } catch {
    try { child.kill('SIGTERM') } catch {}
  }

  setTimeout(() => {
    if (child.killed) return
    try {
      if (process.platform === 'win32') child.kill('SIGKILL')
      else process.kill(-child.pid, 'SIGKILL')
    } catch {
      try { child.kill('SIGKILL') } catch {}
    }
  }, 2000).unref?.()
}

async function runCrawlerWorker({ cwd, env, timeoutMs, workerPath }) {
  const { spawn: spawnChild } = await import("child_process")
  timeoutMs = normalizeLocalCrawlTimeout(timeoutMs)
  return await new Promise((resolve, reject) => {
    let settled = false
    let out = ""
    let errOut = ""
    const child = spawnChild("node", [workerPath], {
      env,
      cwd,
      detached: process.platform !== 'win32',
      stdio: ["ignore", "pipe", "pipe"],
    })

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      terminateCrawlerChild(child)
      reject(new Error(`local crawl timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    timer.unref?.()

    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => { errOut += d; process.stderr.write(d) })
    child.on("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on("exit", (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(errOut.slice(-300) || `crawler exited with ${signal || code}`))
        return
      }
      try { resolve(JSON.parse(out)) }
      catch { reject(new Error(errOut.slice(-300) || "crawler returned no data")) }
    })
  })
}

function crawlerInstallErrorMessage(kind) {
  const base = 'Exact browser audit requires npm plus a Chromium-compatible browser runtime.'
  const container = 'In minimal containers, use the static shortcut with MDVP_USE_CACHE=1, or use a browser image with npm, unzip, Chromium libraries, and MDVP_PUPPETEER_ARGS=\'["--no-sandbox"]\'.'
  if (kind === 'missing-npm') return `${base} npm was not found on PATH. ${container}`
  return `${base} Puppeteer install failed. ${container}`
}

async function installCrawlerDependencies(dir, spawnChild) {
  return await new Promise((resolve, reject) => {
    let settled = false
    const child = spawnChild("npm", ["install", "--prefer-offline"], { cwd: dir, stdio: "inherit" })

    child.on("error", (err) => {
      if (settled) return
      settled = true
      const kind = err?.code === 'ENOENT' ? 'missing-npm' : 'install-failed'
      reject(new Error(crawlerInstallErrorMessage(kind)))
    })

    child.on("exit", (code) => {
      if (settled) return
      settled = true
      code === 0 ? resolve() : reject(new Error(crawlerInstallErrorMessage('install-failed')))
    })
  })
}

export async function cmdAuditLocal(domain, opts = {}) {
  const { json, raw, text, source = "local" } = opts
  const runtime = resolveLocalAuditRuntime({ ...opts, source })
  if (runtime.mode === 'error') {
    console.error(`${RED}${runtime.message}${R}`)
    process.exit(1)
  }
  const useBrowser = runtime.mode === 'browser'
  let outputSource = source
  let result

  if (!useBrowser) {
    process.stderr.write(`${DIM}analyzing https://${domain} with static/cache shortcut...${R}\n`)
    const { analyzeStaticUrl } = await import(`${ENGINE_DIR}/static-analyzer.mjs`)
    result = await analyzeStaticUrl(`https://${domain}`, opts)
    outputSource = "static"
  } else {
    const { spawn } = await import("child_process")
    const { existsSync, writeFileSync, mkdirSync } = await import("fs")
    const dir = `${homedir()}/.mdvp/crawler`

    if (!existsSync(`${dir}/crawler-worker.mjs`)) {
      mkdirSync(dir, { recursive: true })
      const { copyFileSync } = await import("fs")
      copyFileSync(CRAWLER_WORKER, `${dir}/crawler-worker.mjs`)
      copyFileSync(EXTRACT_JS, `${dir}/extract.js`)
      writeFileSync(`${dir}/package.json`, '{"type":"module","dependencies":{"puppeteer":"*"}}')
    } else {
      const { copyFileSync } = await import("fs")
      copyFileSync(CRAWLER_WORKER, `${dir}/crawler-worker.mjs`)
      copyFileSync(EXTRACT_JS, `${dir}/extract.js`)
    }

    if (!existsSync(`${dir}/node_modules/puppeteer`)) {
      process.stderr.write(`${DIM}installing puppeteer (first run ~30s)...${R}\n`)
      await installCrawlerDependencies(dir, spawn)
    }

    const isLinux = process.platform === "linux"
    let chromiumPath = resolveBrowserExecutable()
    if (isLinux && !chromiumPath) {
      const { execSync } = await import("child_process")
      process.stderr.write(`${DIM}installing chromium...${R}\n`)
      execSync("apt-get install -y chromium-browser 2>/dev/null || snap install chromium 2>/dev/null || true", { stdio: "inherit" })
      chromiumPath = resolveBrowserExecutable()
    }

    process.stderr.write(`${DIM}crawling https://${domain} locally...${R}\n`)

    const timeoutMs = normalizeLocalCrawlTimeout(opts.timeout)
    result = await runCrawlerWorker({
      cwd: dir,
      timeoutMs,
      workerPath: `${dir}/crawler-worker.mjs`,
      env: {
        ...process.env,
        CRAWL_ONCE: `https://${domain}`,
        CRAWL_ONCE_STDOUT: "1",
        CRAWL_ONCE_TIMEOUT_MS: String(timeoutMs),
        TABS: "1",
        CRAWL_ONCE_EXACT: "1",
        ...(chromiumPath ? { PUPPETEER_EXECUTABLE_PATH: chromiumPath } : {}),
      },
    })
  }

  if (!result || !result.metrics) {
    console.error(`${RED}Crawl failed — no metrics returned${R}`)
    process.exit(1)
  }

  const { scoreDOMMetrics, groupComponents, computeEntropyMetrics, gradeForScore } = await import(`${ENGINE_DIR}/scorer.mjs`)
  const { loadThresholds, checkThresholds, loadSignalConfig } = await import(`${ENGINE_DIR}/thresholds.mjs`)
  const { findDesignSpec, loadDesignSpec, compareToSpec, specCompliancePenalty } = await import(`${ENGINE_DIR}/design-spec.mjs`)
  const signalConfig = loadSignalConfig()
  const score = scoreDOMMetrics(result.metrics, { signals: signalConfig })
  const bd = score.breakdown.map((b) => ({ c: b.category, s: b.score }))
  const sorted = [...bd].sort((a, b) => a.s - b.s)
  const components = groupComponents(score.breakdown, result.metrics)
  const entropy = computeEntropyMetrics(result.metrics)

  const check = opts.check ?? false
  const specPath = opts.design ? opts.design : findDesignSpec()
  const spec = specPath ? loadDesignSpec(specPath) : null
  const specResult = spec ? compareToSpec(result.metrics, spec) : null
  const specPenalty = specResult && !check ? specCompliancePenalty(specResult) : 0
  const adjustedOverall = Math.max(0, score.overall - specPenalty)
  const adjustedGrade = gradeForScore(adjustedOverall)

  const entropyOut = {
    overall: entropy.overallDesignEntropy,
    typography: entropy.typographyEntropy,
    color: entropy.colorEntropy,
    spacing: entropy.spacingEntropy,
    apca_risk: entropy.apcaContrastRisk,
    spacing_grid_pct: Math.round(entropy.spacingGridAdherence * 100),
  }

  let violations = []
  if (check) {
    const thresholds = loadThresholds()
    violations = checkThresholds(components, entropy, score.overall, thresholds)
    if (specResult) {
      for (const v of specResult.violations.filter((x) => x.severity === 'error')) {
        violations.push({ field: `design:${v.type}`, value: v.value, msg: `DESIGN.md: ${v.msg}` })
      }
    }
  }

  const site = { id: domain, url: `https://${domain}`, overall_score: adjustedOverall, grade: adjustedGrade, label: null, scores: { breakdown: bd } }

  const payload = {
    id: site.id,
    url: site.url,
    source: outputSource,
    grade: adjustedGrade,
    overall_score: adjustedOverall,
    components,
    entropy: entropyOut,
    scores: {
      overall: adjustedOverall,
      grade: adjustedGrade,
      breakdown: Object.fromEntries(bd.map((b) => [b.c, b.s])),
      worst: sorted.slice(0, 3).map((b) => ({ key: b.c, score: b.s })),
    },
    recommendations: score.recommendations,
  }
  if (result.analysis) payload.analysis = result.analysis
  if (specResult) {
    payload.design_compliance = {
      spec: specResult.summary.spec,
      spec_file: specPath,
      errors: specResult.summary.errors,
      warnings: specResult.summary.warnings,
      score_penalty: specPenalty,
      base_overall: score.overall,
      violations: specResult.violations,
    }
  }
  if (check) payload.violations = violations

  if (json) {
    console.log(JSON.stringify(payload, null, 2))
    if (check && violations.length > 0) process.exit(1)
    return payload
  }

  if (text) { console.log(toTextFormat(site, bd)); return payload }

  console.log(`\n${BOLD}${domain}${R}  ${scoreColor(adjustedOverall)}${adjustedGrade}  ${adjustedOverall}/100${R}  ${DIM}${sourceLabel(outputSource)}${R}\n`)
  console.log(`  css_health      ${scoreColor(components.css_health.score)}${bar(components.css_health.score)}${R}  ${components.css_health.score}  ${DIM}${components.css_health.unique_colors} colors · ${components.css_health.unique_font_families} fonts · ${components.css_health.spacing_on_grid_pct}% on grid${R}`)
  console.log(`  visual_quality  ${scoreColor(components.visual_quality.score)}${bar(components.visual_quality.score)}${R}  ${components.visual_quality.score}`)
  console.log(`  structure       ${scoreColor(components.structure.score)}${bar(components.structure.score)}${R}  ${components.structure.score}`)
  console.log(`  originality     ${scoreColor(components.originality.score)}${bar(components.originality.score)}${R}  ${components.originality.score}`)
  console.log(`\n${DIM}entropy ${entropy.overallDesignEntropy} · apca ${entropy.apcaContrastRisk} · grid ${entropyOut.spacing_grid_pct}%${R}`)
  console.log(`${DIM}Lowest: ${sorted.slice(0, 3).map((i) => `${CATS[i.c] ?? i.c} (${i.s})`).join(" · ")}${R}\n`)
  if (score.recommendations.length > 0) {
    score.recommendations.slice(0, 3).forEach(r => console.log(`  ${DIM}· ${r}${R}`))
    console.log()
  }

  if (specResult) {
    const { errors, warnings, spec } = specResult.summary
    const label = spec ? `DESIGN.md (${spec})` : 'DESIGN.md'
    if (errors === 0 && warnings === 0) {
      console.log(`${DIM}✓ ${label}: DOM matches the spec${R}\n`)
    } else {
      const penaltyNote = specPenalty > 0 ? `  ${DIM}−${specPenalty} from ${score.overall}${R}` : ''
      console.log(`${BOLD}${label}${R}  ${errors} error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}${penaltyNote}`)
      specResult.violations.slice(0, 6).forEach((v) => {
        const mark = v.severity === 'error' ? '✗' : '·'
        console.log(`  ${v.severity === 'error' ? '' : DIM}${mark} ${v.msg}${R}`)
      })
      if (specResult.violations.length > 6) console.log(`  ${DIM}… ${specResult.violations.length - 6} more${R}`)
      console.log()
    }
  }

  if (check) {
    if (violations.length === 0) {
      console.log(`${DIM}✓ all thresholds pass${R}\n`)
    } else {
      console.error(`\nThreshold violations:`)
      violations.forEach(v => console.error(`  ✗ ${v.msg}`))
      console.error()
      process.exit(1)
    }
  }

  return payload
}

export { DEFAULT_LOCAL_CRAWL_TIMEOUT_MS, cacheShortcutsEnabled, installCrawlerDependencies, normalizeLocalCrawlTimeout, resolveBrowserExecutable, resolveLocalAuditRuntime, runCrawlerWorker, terminateCrawlerChild }
