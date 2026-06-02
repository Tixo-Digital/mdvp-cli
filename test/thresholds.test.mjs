import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'os'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_THRESHOLDS,
  loadThresholds,
  checkThresholds,
} from '../engine/thresholds.mjs'

// ---------------------------------------------------------------------------
// DEFAULT_THRESHOLDS shape
// ---------------------------------------------------------------------------
describe('DEFAULT_THRESHOLDS', () => {
  it('has all required keys', () => {
    const required = [
      'max_colors', 'max_font_families', 'max_font_sizes', 'max_border_radii',
      'min_spacing_grid_pct', 'min_css_health', 'min_visual_quality',
      'min_structure', 'min_originality', 'min_overall',
    ]
    for (const k of required) {
      assert.ok(k in DEFAULT_THRESHOLDS, `missing key: ${k}`)
    }
  })

  it('min_overall is below 50 by default (conservative)', () => {
    assert.ok(DEFAULT_THRESHOLDS.min_overall <= 50,
      `min_overall should be conservative (<=50), got ${DEFAULT_THRESHOLDS.min_overall}`)
  })
})

// ---------------------------------------------------------------------------
// loadThresholds
// ---------------------------------------------------------------------------
describe('loadThresholds', () => {
  it('returns defaults when no config file exists', () => {
    const result = loadThresholds('/nonexistent/path/xyz123')
    assert.strictEqual(result.max_colors, DEFAULT_THRESHOLDS.max_colors)
    assert.strictEqual(result.min_overall, DEFAULT_THRESHOLDS.min_overall)
  })

  it('merges .mdvprc overrides with defaults', () => {
    const dir = join(tmpdir(), `mdvp-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.mdvprc'), JSON.stringify({
      thresholds: { max_colors: 15, min_overall: 55 }
    }))
    const result = loadThresholds(dir)
    assert.strictEqual(result.max_colors, 15)
    assert.strictEqual(result.min_overall, 55)
    // untouched defaults should remain
    assert.strictEqual(result.max_font_families, DEFAULT_THRESHOLDS.max_font_families)
  })

  it('handles .mdvprc as flat object (no thresholds wrapper)', () => {
    const dir = join(tmpdir(), `mdvp-test-flat-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.mdvprc'), JSON.stringify({ max_colors: 20 }))
    const result = loadThresholds(dir)
    assert.strictEqual(result.max_colors, 20)
  })

  it('handles malformed .mdvprc gracefully (returns defaults)', () => {
    const dir = join(tmpdir(), `mdvp-test-bad-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.mdvprc'), 'this is not json {{')
    const result = loadThresholds(dir)
    assert.strictEqual(result.max_colors, DEFAULT_THRESHOLDS.max_colors)
  })

  it('reads mdvp.config.json as fallback', () => {
    const dir = join(tmpdir(), `mdvp-test-config-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'mdvp.config.json'), JSON.stringify({
      thresholds: { min_css_health: 70 }
    }))
    const result = loadThresholds(dir)
    assert.strictEqual(result.min_css_health, 70)
  })
})

// ---------------------------------------------------------------------------
// checkThresholds
// ---------------------------------------------------------------------------

const PASSING_COMPONENTS = {
  css_health: {
    score: 75,
    unique_colors: 12,
    unique_font_families: 2,
    unique_font_sizes: 5,
    unique_border_radii: 2,
    spacing_on_grid_pct: 85,
    custom_properties: 20,
    has_dark_mode: false,
  },
  visual_quality: { score: 70 },
  structure: { score: 65 },
  originality: { score: 80 },
}

const PASSING_ENTROPY = {
  spacingGridAdherence: 0.85,
  apcaContrastRisk: 0,
}

describe('checkThresholds', () => {
  it('returns empty array when all pass', () => {
    const violations = checkThresholds(
      PASSING_COMPONENTS,
      PASSING_ENTROPY,
      72,
      DEFAULT_THRESHOLDS
    )
    assert.deepStrictEqual(violations, [])
  })

  it('flags too many unique colors', () => {
    const components = {
      ...PASSING_COMPONENTS,
      css_health: { ...PASSING_COMPONENTS.css_health, unique_colors: 40 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 72, DEFAULT_THRESHOLDS)
    const found = violations.find(v => v.field === 'unique_colors')
    assert.ok(found, 'should flag unique_colors violation')
    assert.strictEqual(found.value, 40)
    assert.strictEqual(found.limit, DEFAULT_THRESHOLDS.max_colors)
  })

  it('flags too many font families', () => {
    const components = {
      ...PASSING_COMPONENTS,
      css_health: { ...PASSING_COMPONENTS.css_health, unique_font_families: 6 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 72, DEFAULT_THRESHOLDS)
    assert.ok(violations.some(v => v.field === 'unique_font_families'))
  })

  it('flags spacing below grid threshold', () => {
    const components = {
      ...PASSING_COMPONENTS,
      css_health: { ...PASSING_COMPONENTS.css_health, spacing_on_grid_pct: 40 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 72, DEFAULT_THRESHOLDS)
    assert.ok(violations.some(v => v.field === 'spacing_on_grid_pct'))
  })

  it('flags low overall score', () => {
    const violations = checkThresholds(PASSING_COMPONENTS, PASSING_ENTROPY, 20, DEFAULT_THRESHOLDS)
    assert.ok(violations.some(v => v.field === 'overall'))
  })

  it('flags low css_health score', () => {
    const components = {
      ...PASSING_COMPONENTS,
      css_health: { ...PASSING_COMPONENTS.css_health, score: 30 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 72, DEFAULT_THRESHOLDS)
    assert.ok(violations.some(v => v.field === 'css_health'))
  })

  it('respects custom thresholds (stricter limit)', () => {
    const strict = { ...DEFAULT_THRESHOLDS, max_colors: 8 }
    const components = {
      ...PASSING_COMPONENTS,
      css_health: { ...PASSING_COMPONENTS.css_health, unique_colors: 12 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 72, strict)
    assert.ok(violations.some(v => v.field === 'unique_colors'),
      'should flag 12 colors with strict limit 8')
  })

  it('each violation has field, value, limit, msg', () => {
    const components = {
      ...PASSING_COMPONENTS,
      css_health: { ...PASSING_COMPONENTS.css_health, unique_colors: 50 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 72, DEFAULT_THRESHOLDS)
    for (const v of violations) {
      assert.ok('field' in v, 'missing field')
      assert.ok('value' in v, 'missing value')
      assert.ok('limit' in v, 'missing limit')
      assert.ok(typeof v.msg === 'string', 'missing msg string')
    }
  })

  it('multiple violations are all reported', () => {
    const components = {
      css_health: {
        score: 20,
        unique_colors: 80,
        unique_font_families: 8,
        unique_font_sizes: 20,
        unique_border_radii: 10,
        spacing_on_grid_pct: 15,
      },
      visual_quality: { score: 10 },
      structure: { score: 10 },
      originality: { score: 10 },
    }
    const violations = checkThresholds(components, PASSING_ENTROPY, 10, DEFAULT_THRESHOLDS)
    assert.ok(violations.length >= 5, `expected ≥5 violations, got ${violations.length}`)
  })
})
