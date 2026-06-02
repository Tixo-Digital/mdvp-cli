// .mdvprc threshold enforcement
// Reads .mdvprc from cwd, validates component scores against limits,
// returns a list of violations for CI exit-code gating.

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/** Default thresholds — conservative, matching common design-system standards */
export const DEFAULT_THRESHOLDS = {
  // CSS health — raw counts (lower is better for counts)
  max_colors: 30,
  max_font_families: 3,
  max_font_sizes: 8,
  max_border_radii: 6,
  min_spacing_grid_pct: 60,    // % of spacing values on 4px grid

  // Component scores (0–100, higher is better)
  min_css_health: 60,
  min_visual_quality: 50,
  min_structure: 50,
  min_originality: 30,
  min_overall: 40,
}

/**
 * Load thresholds from .mdvprc or mdvp.config.json in cwd.
 * Falls back to DEFAULT_THRESHOLDS for any missing key.
 */
export function loadThresholds(cwd = process.cwd()) {
  const candidates = ['.mdvprc', 'mdvp.config.json']
  for (const name of candidates) {
    const p = join(cwd, name)
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf-8'))
        const cfg = raw.thresholds ?? raw
        return { ...DEFAULT_THRESHOLDS, ...cfg }
      } catch {
        // malformed config — use defaults
      }
    }
  }
  return { ...DEFAULT_THRESHOLDS }
}

/**
 * Check component scores + raw counts against thresholds.
 * Returns array of violation objects; empty = pass.
 */
export function checkThresholds(components, entropy, overallScore, thresholds) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }
  const violations = []

  const css = components.css_health ?? {}

  if (css.unique_colors > t.max_colors)
    violations.push({ field: 'unique_colors', value: css.unique_colors, limit: t.max_colors, msg: `${css.unique_colors} unique colors (limit: ${t.max_colors})` })
  if (css.unique_font_families > t.max_font_families)
    violations.push({ field: 'unique_font_families', value: css.unique_font_families, limit: t.max_font_families, msg: `${css.unique_font_families} font families (limit: ${t.max_font_families})` })
  if (css.unique_font_sizes > t.max_font_sizes)
    violations.push({ field: 'unique_font_sizes', value: css.unique_font_sizes, limit: t.max_font_sizes, msg: `${css.unique_font_sizes} font sizes (limit: ${t.max_font_sizes})` })
  if (css.unique_border_radii > t.max_border_radii)
    violations.push({ field: 'unique_border_radii', value: css.unique_border_radii, limit: t.max_border_radii, msg: `${css.unique_border_radii} border-radius values (limit: ${t.max_border_radii})` })
  if (css.spacing_on_grid_pct < t.min_spacing_grid_pct)
    violations.push({ field: 'spacing_on_grid_pct', value: css.spacing_on_grid_pct, limit: t.min_spacing_grid_pct, msg: `${css.spacing_on_grid_pct}% spacing on 4px grid (min: ${t.min_spacing_grid_pct}%)` })

  if ((css.score ?? 100) < t.min_css_health)
    violations.push({ field: 'css_health', value: css.score, limit: t.min_css_health, msg: `css_health score ${css.score} below threshold ${t.min_css_health}` })
  if ((components.visual_quality?.score ?? 100) < t.min_visual_quality)
    violations.push({ field: 'visual_quality', value: components.visual_quality.score, limit: t.min_visual_quality, msg: `visual_quality score ${components.visual_quality.score} below threshold ${t.min_visual_quality}` })
  if ((components.structure?.score ?? 100) < t.min_structure)
    violations.push({ field: 'structure', value: components.structure.score, limit: t.min_structure, msg: `structure score ${components.structure.score} below threshold ${t.min_structure}` })
  if ((components.originality?.score ?? 100) < t.min_originality)
    violations.push({ field: 'originality', value: components.originality.score, limit: t.min_originality, msg: `originality score ${components.originality.score} below threshold ${t.min_originality}` })
  if (overallScore < t.min_overall)
    violations.push({ field: 'overall', value: overallScore, limit: t.min_overall, msg: `overall score ${overallScore} below threshold ${t.min_overall}` })

  return violations
}
