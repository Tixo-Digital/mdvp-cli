// DESIGN.md compliance — compare a live DOM against a design specification.
//
// DESIGN.md (https://github.com/google-labs-code/design.md) describes a visual
// identity as YAML front matter: colors, typography, rounded, spacing tokens.
// This module parses that spec and diffs it against the metrics extract.js
// produces, so you can verify a page actually follows its own design system.
//
// Pure ESM, no dependencies. Reuses the engine's Oklab color science so that
// "off-palette" is judged perceptually, not by string equality.

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseColor, rgbToOklab, deltaE } from './color-science.mjs'

// ── Front matter + minimal YAML ───────────────────────────────────────────────

/** Extract the YAML/JSON front matter block delimited by the first pair of `---`. */
export function extractFrontMatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*(\n|$)/)
  return m ? m[1] : null
}

/** Strip an inline `# comment` from an unquoted scalar. */
function stripComment(val) {
  if (val.startsWith('"') || val.startsWith("'")) return val
  const h = val.indexOf(' #')
  return h === -1 ? val : val.slice(0, h).trim()
}

function unquote(val) {
  const v = stripComment(val).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

/**
 * Minimal indentation-based YAML parser for the DESIGN.md token subset:
 * nested string maps, scalar values, comments. Not a general YAML parser —
 * no anchors, flow style, or multiline scalars (the format doesn't use them).
 * Falls back to JSON.parse when the front matter is JSON.
 */
export function parseFrontMatter(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed) } catch { return {} }
  }

  const root = {}
  const stack = [{ indent: -1, obj: root }]

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) continue

    const indent = line.length - line.trimStart().length
    const ci = trimmedLine.indexOf(':')
    if (ci === -1) continue

    const key = trimmedLine.slice(0, ci).trim()
    const val = trimmedLine.slice(ci + 1).trim()

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].obj

    if (val === '') {
      const child = {}
      parent[key] = child
      stack.push({ indent, obj: child })
    } else {
      parent[key] = unquote(val)
    }
  }
  return root
}

// ── Normalization ─────────────────────────────────────────────────────────────

const REM_PX = 16

/** Convert a CSS length token (px / rem) to a px number. Returns NaN if unknown. */
function lenToPx(v) {
  if (typeof v !== 'string') return NaN
  const s = v.trim()
  if (s.endsWith('rem')) return parseFloat(s) * REM_PX
  if (s.endsWith('px')) return parseFloat(s)
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

/**
 * Normalize a parsed DESIGN.md object into matchable sets.
 * @returns {{
 *   name: string|null,
 *   colors: Array<{hex:string, lab:object}>,
 *   fonts: Set<string>, fontSizes: Set<number>, fontWeights: Set<string>,
 *   radii: Set<number>, spacing: Set<number>
 * }}
 */
export function normalizeSpec(raw) {
  const spec = {
    name: raw.name ?? null,
    colors: [],
    fonts: new Set(),
    fontSizes: new Set(),
    fontWeights: new Set(),
    radii: new Set(),
    spacing: new Set(),
  }

  for (const v of Object.values(raw.colors ?? {})) {
    const rgb = typeof v === 'string' ? parseColor(v) : null
    if (rgb) spec.colors.push({ hex: v, lab: rgbToOklab(rgb.r, rgb.g, rgb.b) })
  }

  for (const t of Object.values(raw.typography ?? {})) {
    if (!t || typeof t !== 'object') continue
    if (t.fontFamily) spec.fonts.add(String(t.fontFamily).trim())
    const px = lenToPx(t.fontSize)
    if (!isNaN(px)) spec.fontSizes.add(px)
    if (t.fontWeight) spec.fontWeights.add(String(t.fontWeight).trim())
  }

  for (const v of Object.values(raw.rounded ?? {})) {
    const px = lenToPx(v)
    if (!isNaN(px)) spec.radii.add(px)
  }
  for (const v of Object.values(raw.spacing ?? {})) {
    const px = lenToPx(v)
    if (!isNaN(px)) spec.spacing.add(px)
  }

  return spec
}

/** Locate a DESIGN.md file in cwd. Returns absolute path or null. */
export function findDesignSpec(cwd = process.cwd()) {
  for (const name of ['DESIGN.md', 'design.md', '.design.md']) {
    const p = join(cwd, name)
    if (existsSync(p)) return p
  }
  return null
}

/** Read + parse + normalize a DESIGN.md file. Returns spec or null. */
export function loadDesignSpec(filePath) {
  if (!filePath || !existsSync(filePath)) return null
  const text = readFileSync(filePath, 'utf-8')
  const fm = extractFrontMatter(text)
  if (!fm) return null
  return normalizeSpec(parseFrontMatter(fm))
}

// ── Comparison ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  colorDeltaE: 0.05, // Oklab distance under which a DOM color counts as "in palette"
  sizeTolerancePx: 1, // font-size match tolerance
  radiusTolerancePx: 1,
  minColorUses: 3, // ignore one-off colors used on very few elements
}

function nearestDeltaE(lab, palette) {
  let min = Infinity
  for (const c of palette) {
    const d = deltaE(lab, c.lab)
    if (d < min) min = d
  }
  return min
}

/**
 * Diff DOM metrics against a normalized spec.
 * @returns {{ violations: Array, summary: object }}
 *   violation: { type, value, severity: 'error'|'warn', msg }
 */
export function compareToSpec(metrics, spec, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const violations = []

  // Colors — off-palette by perceptual distance
  let offPalette = 0
  let consideredColors = 0
  for (const [raw, count] of metrics.colors ?? []) {
    if (count < o.minColorUses) continue
    const rgb = parseColor(raw)
    if (!rgb) continue
    consideredColors++
    if (spec.colors.length === 0) continue
    const d = nearestDeltaE(rgbToOklab(rgb.r, rgb.g, rgb.b), spec.colors)
    if (d > o.colorDeltaE) {
      offPalette++
      violations.push({
        type: 'color', value: raw, severity: 'error',
        msg: `Off-palette color ${raw} (ΔE ${d.toFixed(3)} from nearest token)`,
      })
    }
  }

  // Fonts — family not declared in the spec
  if (spec.fonts.size > 0) {
    const seen = new Set()
    for (const [family] of metrics.fontFamilies ?? []) {
      const fam = String(family).trim()
      if (seen.has(fam)) continue
      seen.add(fam)
      const allowed = [...spec.fonts].some((f) => fam.includes(f) || f.includes(fam))
      if (!allowed) {
        violations.push({
          type: 'font', value: fam, severity: 'error',
          msg: `Font "${fam}" is not in the DESIGN.md typography scale`,
        })
      }
    }
  }

  // Font sizes — off the declared type scale
  if (spec.fontSizes.size > 0) {
    const scale = [...spec.fontSizes]
    for (const [sizeRaw] of metrics.fontSizes ?? []) {
      const px = lenToPx(sizeRaw)
      if (isNaN(px)) continue
      const onScale = scale.some((s) => Math.abs(s - px) <= o.sizeTolerancePx)
      if (!onScale) {
        violations.push({
          type: 'fontSize', value: sizeRaw, severity: 'warn',
          msg: `Font size ${sizeRaw} is off the DESIGN.md type scale`,
        })
      }
    }
  }

  // Border radii — off the rounded scale
  if (spec.radii.size > 0) {
    const scale = [...spec.radii]
    for (const [radiusRaw] of metrics.borderRadii ?? []) {
      const px = lenToPx(radiusRaw)
      if (isNaN(px) || px === 0) continue
      const onScale = scale.some((s) => Math.abs(s - px) <= o.radiusTolerancePx)
      if (!onScale) {
        violations.push({
          type: 'radius', value: radiusRaw, severity: 'warn',
          msg: `Border-radius ${radiusRaw} is off the DESIGN.md rounded scale`,
        })
      }
    }
  }

  const errors = violations.filter((v) => v.severity === 'error').length
  return {
    violations,
    summary: {
      spec: spec.name,
      errors,
      warnings: violations.length - errors,
      offPaletteColors: offPalette,
      consideredColors,
    },
  }
}

/**
 * Soft penalty (0–40) derived from spec violations, for non-CI scoring.
 * Errors weigh more than warnings; capped so a spec mismatch dents but
 * does not zero a score.
 */
export function specCompliancePenalty(result) {
  if (!result) return 0
  const { errors, warnings } = result.summary
  return Math.min(40, errors * 5 + warnings * 2)
}
