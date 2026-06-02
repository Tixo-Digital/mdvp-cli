#!/usr/bin/env node
/**
 * MDVP Validation Study — Spearman Correlation
 *
 * Computes Spearman ρ between MDVP component scores and mean human ratings
 * for a set of domains. Used for the validation study described in
 * docs/validation-study.md.
 *
 * Usage:
 *   node scripts/compute-correlation.mjs --ratings data/ratings.json
 *   node scripts/compute-correlation.mjs --ratings data/ratings.json --cached data/mdvp-scores.json
 *   node scripts/compute-correlation.mjs --demo   # run with synthetic data
 *
 * Input: JSON file with this shape:
 *   [
 *     { "domain": "stripe.com", "ratings": [6, 7, 6, 7, 5, 6, 7, 6, 6, 7, ...] },
 *     { "domain": "example.com", "ratings": [3, 2, 4, 3, 3, 2, 4, 3, 3, 3, ...] }
 *   ]
 *
 * Output: Spearman ρ for overall, css_health, visual_quality, structure, originality
 */

import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const CLI = join(__dir, '..', 'cli.mjs')

const argv = process.argv.slice(2)
const flags = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=')
    return [k, v ?? true]
  })
)

// ─── Spearman ρ ──────────────────────────────────────────────────────────────

function rank(arr) {
  const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(arr.length)
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[j].v) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank
    i = j + 1
  }
  return ranks
}

function spearman(x, y) {
  if (x.length !== y.length) throw new Error('Arrays must be same length')
  const n = x.length
  const rx = rank(x)
  const ry = rank(y)
  const meanRx = rx.reduce((s, v) => s + v, 0) / n
  const meanRy = ry.reduce((s, v) => s + v, 0) / n
  let num = 0, sx = 0, sy = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanRx
    const dy = ry[i] - meanRy
    num += dx * dy
    sx += dx * dx
    sy += dy * dy
  }
  if (sx === 0 || sy === 0) return 0
  return num / Math.sqrt(sx * sy)
}

// Two-tailed p-value via t-distribution approximation (valid for n >= 10)
function pValue(rho, n) {
  if (n < 4) return NaN
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho))
  // Approximation using Wilson-Hilferty (good for n >= 10)
  const df = n - 2
  const x = df / (df + t * t)
  // Regularized incomplete beta — approximate via log
  // For reporting: p < 0.001 / 0.01 / 0.05
  const abst = Math.abs(t)
  if (abst > 5.0) return '< 0.001'
  if (abst > 3.3) return '< 0.01'
  if (abst > 2.1) return '< 0.05'
  return '≥ 0.05 (not significant)'
}

// ─── MDVP scoring ────────────────────────────────────────────────────────────

function runMDVP(domain) {
  process.stderr.write(`  auditing ${domain}...\n`)
  const result = spawnSync(process.execPath, [CLI, 'audit', domain, '--local', '--json'], {
    timeout: 120_000,
    encoding: 'utf-8',
  })
  if (result.status !== 0 && result.status !== 1) {
    process.stderr.write(`  WARN: ${domain} exited ${result.status}: ${result.stderr?.slice(0, 200)}\n`)
    return null
  }
  try {
    return JSON.parse(result.stdout)
  } catch {
    process.stderr.write(`  WARN: ${domain} returned invalid JSON\n`)
    return null
  }
}

// ─── Demo synthetic data ─────────────────────────────────────────────────────

function generateDemoData(n = 20) {
  // Synthetic data that demonstrates a moderate positive correlation
  const sites = []
  for (let i = 0; i < n; i++) {
    const trueQuality = Math.random()  // 0–1 latent quality
    // Human ratings: correlated with quality + noise (20 raters)
    const ratings = Array.from({ length: 20 }, () => {
      const base = 1 + trueQuality * 6
      const noise = (Math.random() - 0.5) * 2.5
      return Math.max(1, Math.min(7, Math.round(base + noise)))
    })
    // MDVP score: correlated with quality + different noise
    const mdvpNoise = (Math.random() - 0.5) * 20
    const overall_score = Math.max(0, Math.min(100, Math.round(trueQuality * 100 + mdvpNoise)))
    const cssNoise = (Math.random() - 0.5) * 15
    const css_health_score = Math.max(0, Math.min(100, Math.round(trueQuality * 100 + cssNoise)))
    sites.push({
      domain: `demo-site-${i + 1}.example.com`,
      ratings,
      mdvp: {
        overall_score,
        components: {
          css_health: { score: css_health_score },
          visual_quality: { score: Math.max(0, Math.min(100, Math.round(trueQuality * 100 + (Math.random() - 0.5) * 25))) },
          structure: { score: Math.max(0, Math.min(100, Math.round(trueQuality * 100 + (Math.random() - 0.5) * 30))) },
          originality: { score: Math.max(0, Math.min(100, Math.round(trueQuality * 100 + (Math.random() - 0.5) * 40))) },
        },
      },
    })
  }
  return sites
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printBar(rho) {
  const width = 40
  const center = Math.floor(width / 2)
  const filled = Math.round(Math.abs(rho) * center)
  const bar = Array(width).fill('·')
  bar[center] = '│'
  if (rho >= 0) {
    for (let i = 0; i < filled; i++) bar[center + 1 + i] = '█'
  } else {
    for (let i = 0; i < filled; i++) bar[center - 1 - i] = '█'
  }
  return bar.join('')
}

function printReport(results, n) {
  console.log(`\n${'─'.repeat(72)}`)
  console.log(`MDVP Validation Study — Spearman Correlation`)
  console.log(`n = ${n} pages  ·  ${new Date().toISOString().slice(0, 10)}`)
  console.log(`${'─'.repeat(72)}\n`)
  console.log(`${'Component'.padEnd(18)}  ${'ρ'.padStart(7)}  ${'p-value'.padEnd(16)}  Distribution`)
  console.log(`${'─'.repeat(18)}  ${'─'.repeat(7)}  ${'─'.repeat(16)}  ${'─'.repeat(42)}`)

  for (const [label, rho, p] of results) {
    const rhoStr = (rho >= 0 ? '+' : '') + rho.toFixed(3)
    console.log(`${label.padEnd(18)}  ${rhoStr.padStart(7)}  ${p.padEnd(16)}  ${printBar(rho)}`)
  }

  console.log(`\n${'─'.repeat(72)}`)
  const best = results.reduce((a, b) => Math.abs(b[1]) > Math.abs(a[1]) ? b : a)
  console.log(`Best correlation: ${best[0]} (ρ = ${best[1].toFixed(3)}, ${best[2]})`)
  const overall = results.find(r => r[0] === 'overall')
  if (overall) {
    const rho = overall[1]
    if (Math.abs(rho) >= 0.60) console.log('Interpretation: strong correlation — ready to publish')
    else if (Math.abs(rho) >= 0.45) console.log('Interpretation: moderate correlation — meets success threshold')
    else if (Math.abs(rho) >= 0.30) console.log('Interpretation: weak correlation — revise scoring weights')
    else console.log('Interpretation: negligible correlation — scoring needs rethinking')
  }
  console.log()
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let sites

  if (flags.demo) {
    console.log('Running with synthetic demo data (n=20)...')
    sites = generateDemoData(20)
  } else {
    if (!flags.ratings) {
      console.error('Usage: node scripts/compute-correlation.mjs --ratings data/ratings.json [--cached data/mdvp-scores.json] [--demo]')
      process.exit(1)
    }

    const ratingsData = JSON.parse(readFileSync(flags.ratings, 'utf-8'))
    const cacheFile = flags.cached || null
    const cache = (cacheFile && existsSync(cacheFile)) ? JSON.parse(readFileSync(cacheFile, 'utf-8')) : {}

    console.log(`Loaded ${ratingsData.length} sites from ${flags.ratings}`)
    if (cacheFile && existsSync(cacheFile)) console.log(`Using cached MDVP scores from ${cacheFile}`)

    sites = []
    for (const entry of ratingsData) {
      const domain = entry.domain
      let mdvp = cache[domain] ?? null
      if (!mdvp) {
        mdvp = runMDVP(domain)
        if (cacheFile) {
          cache[domain] = mdvp
          writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
        }
      }
      if (mdvp) sites.push({ domain, ratings: entry.ratings, mdvp })
      else process.stderr.write(`  SKIP ${domain}: no MDVP data\n`)
    }

    console.log(`${sites.length} sites with both human ratings and MDVP scores`)
  }

  if (sites.length < 10) {
    console.error(`Not enough sites (${sites.length} < 10) for a meaningful correlation`)
    process.exit(1)
  }

  const meanRatings = sites.map(s => s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length)
  const overall = sites.map(s => s.mdvp.overall_score)
  const cssHealth = sites.map(s => s.mdvp.components?.css_health?.score ?? s.mdvp.overall_score)
  const visualQuality = sites.map(s => s.mdvp.components?.visual_quality?.score ?? s.mdvp.overall_score)
  const structure = sites.map(s => s.mdvp.components?.structure?.score ?? s.mdvp.overall_score)
  const originality = sites.map(s => s.mdvp.components?.originality?.score ?? s.mdvp.overall_score)

  const n = sites.length
  const results = [
    ['overall', spearman(overall, meanRatings), pValue(spearman(overall, meanRatings), n)],
    ['css_health', spearman(cssHealth, meanRatings), pValue(spearman(cssHealth, meanRatings), n)],
    ['visual_quality', spearman(visualQuality, meanRatings), pValue(spearman(visualQuality, meanRatings), n)],
    ['structure', spearman(structure, meanRatings), pValue(spearman(structure, meanRatings), n)],
    ['originality', spearman(originality, meanRatings), pValue(spearman(originality, meanRatings), n)],
  ]

  printReport(results, n)

  if (flags.output) {
    const out = {
      date: new Date().toISOString(),
      n,
      results: Object.fromEntries(results.map(([k, rho, p]) => [k, { rho: +rho.toFixed(4), p }])),
      sites: sites.map((s, i) => ({
        domain: s.domain,
        mean_human_rating: +meanRatings[i].toFixed(3),
        n_raters: s.ratings.length,
        overall_score: s.mdvp.overall_score,
        css_health: s.mdvp.components?.css_health?.score,
      })),
    }
    writeFileSync(flags.output, JSON.stringify(out, null, 2))
    console.log(`Results written to ${flags.output}`)
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
