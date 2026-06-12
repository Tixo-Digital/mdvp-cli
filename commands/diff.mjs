import { readFileSync } from 'fs'

import { CATS } from '../lib/constants.mjs'
import { BOLD, DIM, GREEN, RED, YELLOW } from '../lib/format.mjs'

const R = "\x1b[0m"
const COMPONENTS = [
  ['css_health', 'css_health'],
  ['visual_quality', 'visual_quality'],
  ['structure', 'structure'],
  ['originality', 'originality'],
]

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function scoreFromComponent(value) {
  if (value && typeof value === 'object') return toNumber(value.score)
  return toNumber(value)
}

function normalizeBreakdown(scores) {
  const breakdown = scores?.breakdown ?? scores
  if (!breakdown || typeof breakdown !== 'object') return {}

  if (Array.isArray(breakdown)) {
    return Object.fromEntries(breakdown.flatMap((entry) => {
      const key = entry?.key ?? entry?.c ?? entry?.category
      const score = toNumber(entry?.score ?? entry?.s)
      return key && score !== null ? [[key, score]] : []
    }))
  }

  return Object.fromEntries(Object.entries(breakdown).flatMap(([key, value]) => {
    const score = toNumber(value)
    return score !== null ? [[key, score]] : []
  }))
}

function normalizeSnapshot(input, source = '<snapshot>') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${source}: expected a JSON object`)
  }

  const overall = toNumber(input.overall_score ?? input.scores?.overall ?? input.overall)
  const components = Object.fromEntries(COMPONENTS.flatMap(([key]) => {
    const score = scoreFromComponent(input.components?.[key])
    return score !== null ? [[key, score]] : []
  }))
  const categories = normalizeBreakdown(input.scores ?? input.categories)

  if (overall === null) {
    throw new Error(`${source}: missing overall_score`)
  }
  if (Object.keys(components).length === 0 && Object.keys(categories).length === 0) {
    throw new Error(`${source}: missing component or category score data`)
  }

  return {
    id: input.id ?? input.domain ?? input.url ?? source,
    url: input.url ?? null,
    grade: input.grade ?? input.scores?.grade ?? null,
    overall,
    components,
    categories,
  }
}

function loadSnapshot(path) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err?.code === 'ENOENT') throw new Error(`${path}: file not found`)
    if (err instanceof SyntaxError) throw new Error(`${path}: malformed JSON`)
    throw err
  }
  return normalizeSnapshot(parsed, path)
}

function change(scope, key, label, before, after) {
  if (before === null && after === null) return null
  const delta = before === null || after === null ? null : after - before
  return { scope, key, label, before, after, delta }
}

function collectChanges(before, after) {
  const changes = [
    change('overall', 'overall', 'Overall', before.overall, after.overall),
    ...COMPONENTS.map(([key, label]) => change(
      'component',
      key,
      label,
      before.components[key] ?? null,
      after.components[key] ?? null,
    )),
    ...Object.keys(CATS).map((key) => change(
      'category',
      key,
      CATS[key] ?? key,
      before.categories[key] ?? null,
      after.categories[key] ?? null,
    )),
  ].filter(Boolean)

  return changes.filter((item) => item.before !== null || item.after !== null)
}

function diffSnapshots(beforeInput, afterInput) {
  const before = normalizeSnapshot(beforeInput, 'before')
  const after = normalizeSnapshot(afterInput, 'after')
  const changes = collectChanges(before, after)
  const changed = changes.filter((item) => item.delta !== 0)
  const numericChanged = changed.filter((item) => item.delta !== null)
  const improved = numericChanged.filter((item) => item.delta > 0).length
  const regressed = numericChanged.filter((item) => item.delta < 0).length

  return {
    before,
    after,
    delta: {
      overall: after.overall - before.overall,
    },
    summary: {
      changed: changed.length,
      improved,
      regressed,
      unavailable: changed.filter((item) => item.delta === null).length,
    },
    changes,
    changed,
  }
}

function signed(value) {
  if (value === null) return 'n/a'
  return `${value > 0 ? '+' : ''}${value}`
}

function scorePair(item) {
  const before = item.before === null ? 'n/a' : String(item.before)
  const after = item.after === null ? 'n/a' : String(item.after)
  return `${before} -> ${after}`
}

function colorForDelta(delta) {
  if (delta === null || delta === 0) return DIM
  return delta > 0 ? GREEN : RED
}

function formatRows(rows) {
  return rows
    .map((item) => {
      const color = colorForDelta(item.delta)
      return `  ${item.label.padEnd(16)}  ${scorePair(item).padEnd(14)}  ${color}${signed(item.delta)}${R}`
    })
    .join('\n')
}

function formatDiffText(diff) {
  const componentRows = diff.changes.filter((item) => item.scope === 'component')
  const categoryRows = diff.changes.filter((item) => item.scope === 'category')
  const overall = diff.changes.find((item) => item.scope === 'overall')
  const title = `${diff.before.id} -> ${diff.after.id}`

  return [
    '',
    `  ${BOLD}${title}${R}`,
    '',
    `  ${'Metric'.padEnd(16)}  ${'Before -> After'.padEnd(14)}  Delta`,
    `  ${'-'.repeat(16)}  ${'-'.repeat(14)}  -----`,
    formatRows([overall]),
    componentRows.length ? `\n  ${YELLOW}Components${R}\n${formatRows(componentRows)}` : '',
    categoryRows.length ? `\n  ${YELLOW}Categories${R}\n${formatRows(categoryRows)}` : '',
    '',
  ].filter((line) => line !== '').join('\n')
}

async function cmdDiff(beforePath, afterPath, opts = {}) {
  if (!beforePath || !afterPath) {
    console.error('Usage: mdvp diff <before.json> <after.json> [--json]')
    process.exit(3)
  }

  let diff
  try {
    diff = diffSnapshots(loadSnapshot(beforePath), loadSnapshot(afterPath))
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(3)
  }

  if (opts.json) {
    console.log(JSON.stringify(diff, null, 2))
    return diff
  }

  console.log(formatDiffText(diff))
  return diff
}

export {
  cmdDiff,
  diffSnapshots,
  formatDiffText,
  loadSnapshot,
  normalizeSnapshot,
}
