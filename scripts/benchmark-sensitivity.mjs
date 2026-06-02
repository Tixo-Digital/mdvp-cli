#!/usr/bin/env node
/**
 * MDVP Sensitivity / Ablation Benchmark
 *
 * Construct-validity check: does the score respond, in the expected direction,
 * to each design factor it claims to measure? Mirrors the occlusion study in
 * Webthetics (Dou et al.) but on deterministic DOM metrics instead of pixels.
 *
 * Starting from a strong design-system metrics profile, we inject one
 * vibe-code factor at a time (and cumulatively) and record the score. No
 * crawling, no network, no human labels — pure, deterministic, reproducible.
 *
 *   node scripts/benchmark-sensitivity.mjs
 *   node scripts/benchmark-sensitivity.mjs --json > data/sensitivity-results.json
 */

import { scoreDOMMetrics, groupComponents } from '../engine/scorer.mjs'
import { GOOD_METRICS, VIBECODED_METRICS } from '../test/fixtures/metrics.mjs'

const clone = (o) => JSON.parse(JSON.stringify(o))

// Mutators — each injects one AI-pattern factor into a metrics object.
const inject = {
  interFont(m) {
    m.fontFamilies = [['Inter', 500], ['Inter', 40]]
    return 'Inter as primary font'
  },
  tailwindPalette(m) {
    m.colors = [
      ['rgb(59, 130, 246)', 120], ['rgb(99, 102, 241)', 80],
      ['rgb(139, 92, 246)', 60], ['rgb(168, 85, 247)', 40],
      ['rgb(255, 255, 255)', 200], ['rgb(17, 24, 39)', 80],
    ]
    return 'Tailwind purple-pink-blue palette'
  },
  pills(m) {
    m.borderRadii = [['9999px', 120], ['9999px', 60]]
    return 'pill radius everywhere (9999px)'
  },
  noTokens(m) {
    m.customProperties = 2
    return 'no design tokens (<5 custom props)'
  },
  sparse(m) {
    m.totalElements = 45
    return 'sparse content (45 elements)'
  },
}

function score(m) {
  const s = scoreDOMMetrics(m)
  const c = groupComponents(s.breakdown, m)
  return { overall: s.overall, grade: s.grade, originality: c.originality.score }
}

// Individual ablations: baseline + one factor each.
const individual = []
const base = score(GOOD_METRICS)
individual.push({ step: 'baseline (strong design system)', factor: '—', ...base })

for (const [key, fn] of Object.entries(inject)) {
  const m = clone(GOOD_METRICS)
  const label = fn(m)
  const s = score(m)
  individual.push({
    step: `+ ${key}`,
    factor: label,
    ...s,
    d_overall: s.overall - base.overall,
    d_originality: s.originality - base.originality,
  })
}

// Cumulative ablation: stack factors one by one toward a fully vibecoded page.
const cumulative = []
const order = ['interFont', 'tailwindPalette', 'pills', 'noTokens', 'sparse']
let acc = clone(GOOD_METRICS)
cumulative.push({ step: 'baseline', ...score(acc) })
for (const key of order) {
  inject[key](acc)
  cumulative.push({ step: `+ ${key}`, ...score(acc) })
}
cumulative.push({ step: 'reference vibecoded fixture', ...score(VIBECODED_METRICS) })

// Monotonicity: cumulative overall score should be non-increasing.
let monotone = true
for (let i = 1; i < cumulative.length - 1; i++) {
  if (cumulative[i].overall > cumulative[i - 1].overall) monotone = false
}

const results = {
  generatedAt: new Date().toISOString(),
  method: 'deterministic ablation on DOM metrics (no crawl, no human labels)',
  individual,
  cumulative,
  monotonicNonIncreasing: monotone,
  delta: {
    overall: cumulative[0].overall - cumulative[cumulative.length - 2].overall,
    originality: cumulative[0].originality - cumulative[cumulative.length - 2].originality,
  },
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2))
  process.exit(0)
}

const pad = (s, n) => String(s).padEnd(n)
const padL = (s, n) => String(s).padStart(n)

console.log('\nMDVP sensitivity / ablation benchmark')
console.log('Construct validity: each injected vibe-code factor should lower the score.\n')

console.log('Individual factors (baseline + one factor):')
console.log('  ' + pad('step', 20) + padL('overall', 9) + padL('Δ', 6) + padL('originality', 13) + padL('Δ', 6))
for (const r of individual) {
  console.log('  ' + pad(r.step, 20) + padL(r.overall, 9) + padL(r.d_overall ?? '', 6) + padL(r.originality, 13) + padL(r.d_originality ?? '', 6))
}

console.log('\nCumulative (stacking factors):')
console.log('  ' + pad('step', 26) + padL('overall', 9) + padL('grade', 7) + padL('originality', 13))
for (const r of cumulative) {
  console.log('  ' + pad(r.step, 26) + padL(r.overall, 9) + padL(r.grade, 7) + padL(r.originality, 13))
}

console.log(`\nMonotonic non-increasing (cumulative): ${results.monotonicNonIncreasing ? 'yes' : 'NO'}`)
console.log(`Total drop: overall ${results.delta.overall} pts, originality ${results.delta.originality} pts\n`)
