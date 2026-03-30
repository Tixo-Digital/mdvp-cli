import { apiGet, API } from '../lib/http.mjs'
import { DIM, BOLD, RED, GREEN, YELLOW, scoreColor, bar } from '../lib/format.mjs'
import { R } from '../lib/constants.mjs'
import { CATS } from '../lib/constants.mjs'

async function cmdCompare(da, db) {
  ;[da, db] = [da, db].map(parseDomain)
  const sites = (await apiGet(`/dataset?limit=800`)).sites ?? []
  const a = sites.find((s) => s.id === da)
  const b = sites.find((s) => s.id === db)
  if (!a) { console.error(`${RED}not found: ${da}${R}`); process.exit(1) }
  if (!b) { console.error(`${RED}not found: ${db}${R}`); process.exit(1) }
  const bda = Object.fromEntries((a.scores?.breakdown ?? []).map((x) => [x.c, x.s]))
  const bdb = Object.fromEntries((b.scores?.breakdown ?? []).map((x) => [x.c, x.s]))
  console.log(`\n  ${"Category".padEnd(16)}  ${da.slice(0, 14).padEnd(14)}  ${db.slice(0, 14).padEnd(14)}  Δ`)
  console.log(`  ${"─".repeat(16)}  ${"─".repeat(14)}  ${"─".repeat(14)}  ─────`)
  console.log(`  ${"Overall".padEnd(16)}  ${String(a.overall_score).padEnd(14)}  ${String(b.overall_score).padEnd(14)}  ${b.overall_score - a.overall_score > 0 ? "+" : ""}${b.overall_score - a.overall_score}`)
  for (const cat of Object.keys(CATS)) {
    const va = bda[cat] ?? 0, vb = bdb[cat] ?? 0, diff = vb - va
    const c = diff > 5 ? GREEN : diff < -5 ? RED : DIM
    console.log(`  ${(CATS[cat] ?? cat).padEnd(16)}  ${String(va).padEnd(14)}  ${String(vb).padEnd(14)}  ${c}${diff > 0 ? "+" : ""}${diff}${R}`)
  }
  console.log()
}

async function cmdTop(n, worst) {
  const sites = (await apiGet(`/dataset?limit=800`)).sites ?? []
  const sorted = (worst ? sites.sort((a, b) => a.overall_score - b.overall_score) : sites.sort((a, b) => b.overall_score - a.overall_score)).slice(0, n)
  console.log(`\n  ${"#".padEnd(4)}  ${"Domain".padEnd(28)}  ${"Score".padEnd(6)}  Grade  Label`)
  console.log(`  ${"─".repeat(4)}  ${"─".repeat(28)}  ${"─".repeat(6)}  ─────  ─────────`)
  for (const [i, s] of sorted.entries()) {
    console.log(`  ${String(i + 1).padEnd(4)}  ${s.id.padEnd(28)}  ${scoreColor(s.overall_score)}${String(s.overall_score).padEnd(6)}${R}  ${s.grade.padEnd(5)}  ${s.label}`)
  }
  console.log()
}


export { cmdCompare, cmdTop }
