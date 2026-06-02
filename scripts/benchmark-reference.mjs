#!/usr/bin/env node
/**
 * MDVP Reference-Panel Benchmark (live)
 *
 * Face validity: do sites widely regarded for strong design systems actually
 * score well? Crawls each reference URL with the local engine and reports the
 * distribution of scores. This is descriptive (no human ratings, no negative
 * class — see docs/benchmark.md for why Webthetics-style ρ is not computable),
 * and reproducible: re-run to get fresh snapshots.
 *
 *   node scripts/benchmark-reference.mjs
 *   node scripts/benchmark-reference.mjs --out data/benchmark-results-live.json
 */

import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const CLI = join(__dir, '..', 'cli.mjs')
const SITES = JSON.parse(readFileSync(join(__dir, '..', 'data', 'benchmark-sites.json'), 'utf-8'))
const PER_SITE_TIMEOUT_MS = 150_000

const outFlag = process.argv.indexOf('--out')
const outPath = outFlag !== -1 ? process.argv[outFlag + 1] : null

// spawnSync's timeout kills the `node` child but NOT the detached Chrome it
// launched, so a timed-out crawl leaks a browser. Accumulating browsers then
// contend for CPU/RAM and make every later launch time out too — a cascade
// that turns infra leakage into fake "site failed to score" results. Reap any
// puppeteer-managed Chrome between sites. Scoped to the puppeteer cache path so
// the user's own /Applications/Google Chrome.app is never touched.
function reapPuppeteerChrome() {
  if (process.platform === 'win32') return
  spawnSync('pkill', ['-9', '-f', '.cache/puppeteer/chrome'], { timeout: 5000 })
}

function crawl(domain) {
  const res = spawnSync('node', [CLI, 'audit', domain, '--local', '--json'], {
    encoding: 'utf-8',
    timeout: PER_SITE_TIMEOUT_MS,
    maxBuffer: 1 << 26,
  })
  reapPuppeteerChrome()
  if (res.status !== 0 || !res.stdout) {
    const reason = res.signal === 'SIGTERM' || res.error?.code === 'ETIMEDOUT'
      ? `timed out after ${PER_SITE_TIMEOUT_MS / 1000}s`
      : (res.stderr || 'no output').slice(-160).trim()
    return { domain, ok: false, error: reason }
  }
  try {
    const d = JSON.parse(res.stdout)
    return {
      domain, ok: true,
      overall: d.overall_score, grade: d.grade,
      css_health: d.components?.css_health?.score,
      originality: d.components?.originality?.score,
    }
  } catch {
    return { domain, ok: false, error: 'unparseable output' }
  }
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length

const rows = []
reapPuppeteerChrome() // start from a clean slate
process.stderr.write(`Crawling ${SITES.reference_design_systems.length} reference sites (~30-90s each)...\n`)
for (const domain of SITES.reference_design_systems) {
  process.stderr.write(`  ${domain} ... `)
  const r = crawl(domain)
  rows.push(r)
  process.stderr.write(r.ok ? `${r.grade} ${r.overall} (orig ${r.originality})\n` : `FAILED (${r.error})\n`)
}

const ok = rows.filter((r) => r.ok)
const overalls = ok.map((r) => r.overall)
const summary = {
  generatedAt: new Date().toISOString(),
  n: SITES.reference_design_systems.length,
  succeeded: ok.length,
  overall: ok.length ? { mean: +mean(overalls).toFixed(1), median: median(overalls), min: Math.min(...overalls), max: Math.max(...overalls) } : null,
  rows,
}

console.log('\n' + JSON.stringify(summary, null, 2))
if (outPath) { writeFileSync(outPath, JSON.stringify(summary, null, 2)); process.stderr.write(`\nwrote ${outPath}\n`) }
