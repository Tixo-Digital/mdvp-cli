import { accessSync, constants as fsConstants, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'

import { VERSION } from '../lib/constants.mjs'

const REQUIRED_NODE_MAJOR = 18
const LINUX_BROWSER_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
]
const DARWIN_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
]

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function commandVersion(command, args = ['--version'], runner = spawnSync) {
  const result = runner(command, args, { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    return { available: false, version: null, error: result.error?.code || result.stderr?.trim() || null }
  }
  const version = String(result.stdout || result.stderr || '').trim().split('\n')[0] || null
  return { available: true, version, error: null }
}

function browserCandidatesFor(platform) {
  if (platform === 'darwin') return DARWIN_BROWSER_CANDIDATES
  if (platform === 'linux') return LINUX_BROWSER_CANDIDATES
  return []
}

function checkWritableDir(dir, fs = { mkdirSync, writeFileSync, unlinkSync }) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = join(dir, `.mdvp-doctor-${process.pid}-${Date.now()}`)
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
    return { writable: true, error: null }
  } catch (err) {
    return { writable: false, error: err?.message || String(err) }
  }
}

function checkExecutable(path, fs = { accessSync }) {
  try {
    fs.accessSync(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

function addCheck(checks, status, id, label, message, detail = null) {
  checks.push({ id, label, status, message, ...(detail ? { detail } : {}) })
}

function createDoctorReport(options = {}) {
  const env = options.env || process.env
  const platform = options.platform || process.platform
  const arch = options.arch || process.arch
  const runner = options.spawnSync || spawnSync
  const fs = options.fs || { accessSync, mkdirSync, writeFileSync, unlinkSync, existsSync }
  const home = options.home || homedir()
  const checks = []

  const nodeVersion = options.nodeVersion || process.version
  const nodeMajor = Number.parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10)
  const nodeOk = Number.isFinite(nodeMajor) && nodeMajor >= REQUIRED_NODE_MAJOR
  addCheck(
    checks,
    nodeOk ? 'pass' : 'fail',
    'node',
    'Node.js',
    nodeOk
      ? `${nodeVersion} satisfies >=${REQUIRED_NODE_MAJOR}`
      : `${nodeVersion} is unsupported; install Node.js ${REQUIRED_NODE_MAJOR}+`
  )

  const npm = options.npm || commandVersion('npm', ['--version'], runner)
  addCheck(
    checks,
    npm.available ? 'pass' : 'fail',
    'npm',
    'npm',
    npm.available
      ? `npm ${npm.version} is available`
      : 'npm is required to install the local crawler dependencies on first exact audit'
  )

  const cargo = options.cargo || commandVersion('cargo', ['--version'], runner)
  addCheck(
    checks,
    cargo.available ? 'pass' : 'warn',
    'cargo',
    'Rust cargo',
    cargo.available
      ? `${cargo.version} is available for the native static analyzer`
      : 'cargo not found; static/cache mode will use the JavaScript fallback if native build is unavailable'
  )

  const browserEnv = {
    executablePath: env.PUPPETEER_EXECUTABLE_PATH || null,
    browserUrl: env.MDVP_BROWSER_URL || null,
    browserWsEndpoint: env.MDVP_BROWSER_WS_ENDPOINT || null,
    puppeteerCacheDir: env.PUPPETEER_CACHE_DIR || join(home, '.cache', 'puppeteer'),
    useCache: envFlag(env.MDVP_USE_CACHE),
  }
  const configuredExecutable = browserEnv.executablePath
    ? [{ path: browserEnv.executablePath, exists: checkExecutable(browserEnv.executablePath, fs) }]
    : []
  const systemBrowsers = browserCandidatesFor(platform)
    .map((path) => ({ path, exists: checkExecutable(path, fs) }))
    .filter((candidate) => candidate.exists)
  const hasBrowserEndpoint = Boolean(browserEnv.browserUrl || browserEnv.browserWsEndpoint)
  const hasBrowserPath = configuredExecutable.some((candidate) => candidate.exists) || systemBrowsers.length > 0
  const browserStatus = hasBrowserEndpoint || hasBrowserPath ? 'pass' : 'warn'
  addCheck(
    checks,
    browserStatus,
    'browser',
    'Browser runtime',
    hasBrowserEndpoint
      ? 'DevTools browser endpoint configured for exact audits'
      : hasBrowserPath
        ? 'Chrome or Chromium executable found'
        : 'No Chrome/Chromium executable found; first exact audit may rely on Puppeteer download'
  )

  const cache = checkWritableDir(browserEnv.puppeteerCacheDir, fs)
  addCheck(
    checks,
    cache.writable ? 'pass' : 'fail',
    'puppeteer-cache',
    'Puppeteer cache',
    cache.writable
      ? `${browserEnv.puppeteerCacheDir} is writable`
      : `${browserEnv.puppeteerCacheDir} is not writable`
  )

  const crawlerDir = join(home, '.mdvp', 'crawler')
  const puppeteerInstalled = fs.existsSync(join(crawlerDir, 'node_modules', 'puppeteer'))
  addCheck(
    checks,
    puppeteerInstalled ? 'pass' : 'warn',
    'crawler-deps',
    'Local crawler deps',
    puppeteerInstalled
      ? 'Puppeteer is already installed in the local crawler cache'
      : 'Puppeteer will be installed on first exact audit'
  )

  addCheck(
    checks,
    browserEnv.useCache ? 'pass' : 'warn',
    'static-shortcut',
    'Static/cache shortcut',
    browserEnv.useCache
      ? 'MDVP_USE_CACHE=1 is set; audit --fast will use the approximate static shortcut'
      : 'MDVP_USE_CACHE is not set; default audit uses exact browser mode'
  )

  const blocking = checks.filter((check) => check.status === 'fail')
  const ok = blocking.length === 0
  return {
    ok,
    version: VERSION,
    platform,
    arch,
    exactAuditReady: ok,
    staticShortcutReady: browserEnv.useCache,
    runtime: {
      node: { version: nodeVersion, major: nodeMajor, requiredMajor: REQUIRED_NODE_MAJOR, ok: nodeOk },
      npm,
      cargo,
    },
    browser: {
      env: browserEnv,
      configuredExecutable,
      systemBrowsers,
      hasBrowserEndpoint,
      hasBrowserPath,
    },
    cache: {
      puppeteerCacheDir: browserEnv.puppeteerCacheDir,
      writable: cache.writable,
      error: cache.error,
      crawlerDir,
      puppeteerInstalled,
    },
    checks,
  }
}

function formatDoctorText(report) {
  const lines = ['MDVP doctor', '']
  lines.push(`  version ${report.version}`)
  lines.push(`  runtime ${report.platform}/${report.arch}`)
  lines.push('')
  for (const check of report.checks) {
    lines.push(`  ${check.status.padEnd(4)} ${check.label}: ${check.message}`)
  }
  lines.push('')
  lines.push(report.ok
    ? 'Result: ready for exact browser audits.'
    : 'Result: exact browser audits need attention before first run.')
  if (!report.staticShortcutReady) {
    lines.push('Static shortcut: set MDVP_USE_CACHE=1 and pass --fast when you intentionally want approximate no-browser analysis.')
  }
  return `${lines.join('\n')}\n`
}

async function cmdDoctor(opts = {}) {
  const report = createDoctorReport(opts)
  if (opts.json) console.log(JSON.stringify(report, null, 2))
  else process.stdout.write(formatDoctorText(report))
  if (!report.ok) process.exitCode = 1
  return report
}

export {
  REQUIRED_NODE_MAJOR,
  createDoctorReport,
  formatDoctorText,
  cmdDoctor,
}
