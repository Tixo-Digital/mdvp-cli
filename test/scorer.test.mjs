import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  scoreDOMMetrics,
  computeEntropyMetrics,
  groupComponents,
} from '../engine/scorer.mjs'
import { MINIMAL_METRICS, GOOD_METRICS, VIBECODED_METRICS } from './fixtures/metrics.mjs'

// ---------------------------------------------------------------------------
// scoreDOMMetrics
// ---------------------------------------------------------------------------
describe('scoreDOMMetrics — return shape', () => {
  it('returns overall, grade, breakdown, recommendations', () => {
    const result = scoreDOMMetrics(MINIMAL_METRICS)
    assert.ok(typeof result.overall === 'number', 'overall should be a number')
    assert.ok(typeof result.grade === 'string', 'grade should be a string')
    assert.ok(Array.isArray(result.breakdown), 'breakdown should be an array')
    assert.ok(Array.isArray(result.recommendations), 'recommendations should be an array')
  })

  it('overall is in 0–100 range', () => {
    for (const m of [MINIMAL_METRICS, GOOD_METRICS, VIBECODED_METRICS]) {
      const { overall } = scoreDOMMetrics(m)
      assert.ok(overall >= 0 && overall <= 100, `overall out of range: ${overall}`)
    }
  })

  it('grade is a valid letter grade', () => {
    const valid = new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'])
    for (const m of [MINIMAL_METRICS, GOOD_METRICS, VIBECODED_METRICS]) {
      const { grade } = scoreDOMMetrics(m)
      assert.ok(valid.has(grade), `unexpected grade: ${grade}`)
    }
  })

  it('breakdown has 12 categories', () => {
    const { breakdown } = scoreDOMMetrics(MINIMAL_METRICS)
    assert.strictEqual(breakdown.length, 12)
  })

  it('every breakdown entry has category, score, weight, details', () => {
    const { breakdown } = scoreDOMMetrics(MINIMAL_METRICS)
    for (const b of breakdown) {
      assert.ok(typeof b.category === 'string', `missing category: ${JSON.stringify(b)}`)
      assert.ok(typeof b.score === 'number', `missing score: ${b.category}`)
      assert.ok(typeof b.weight === 'number', `missing weight: ${b.category}`)
      assert.ok(Array.isArray(b.details), `missing details: ${b.category}`)
    }
  })

  it('every category score is in 0–100', () => {
    const { breakdown } = scoreDOMMetrics(GOOD_METRICS)
    for (const b of breakdown) {
      assert.ok(b.score >= 0 && b.score <= 100,
        `${b.category} score out of range: ${b.score}`)
    }
  })

  it('does not throw on empty / minimal metrics', () => {
    assert.doesNotThrow(() => scoreDOMMetrics({}))
    assert.doesNotThrow(() => scoreDOMMetrics({ totalElements: 0 }))
    assert.doesNotThrow(() => scoreDOMMetrics(MINIMAL_METRICS))
  })
})

describe('scoreDOMMetrics — scoring direction', () => {
  it('good design scores higher than vibecoded', () => {
    const good = scoreDOMMetrics(GOOD_METRICS).overall
    const vibe = scoreDOMMetrics(VIBECODED_METRICS).overall
    assert.ok(good > vibe, `good (${good}) should outscore vibecoded (${vibe})`)
  })

  it('vibecoded originality score < good originality score', () => {
    const goodBreak = scoreDOMMetrics(GOOD_METRICS).breakdown
    const vibeBreak = scoreDOMMetrics(VIBECODED_METRICS).breakdown
    const goodOrig = goodBreak.find(b => b.category === 'originality').score
    const vibeOrig = vibeBreak.find(b => b.category === 'originality').score
    assert.ok(goodOrig > vibeOrig,
      `good originality (${goodOrig}) should beat vibecoded (${vibeOrig})`)
  })

  it('good design gets dark mode + container query bonus in modernity', () => {
    const goodBreak = scoreDOMMetrics(GOOD_METRICS).breakdown
    const minBreak = scoreDOMMetrics(MINIMAL_METRICS).breakdown
    const goodMod = goodBreak.find(b => b.category === 'modernity').score
    const minMod = minBreak.find(b => b.category === 'modernity').score
    assert.ok(goodMod > minMod,
      `good modernity (${goodMod}) should beat minimal (${minMod})`)
  })
})

// ---------------------------------------------------------------------------
// computeEntropyMetrics
// ---------------------------------------------------------------------------
describe('computeEntropyMetrics — return shape', () => {
  it('returns expected entropy keys', () => {
    const e = computeEntropyMetrics(MINIMAL_METRICS)
    const keys = ['overallDesignEntropy', 'typographyEntropy', 'colorEntropy',
      'spacingEntropy', 'apcaContrastRisk', 'spacingGridAdherence']
    for (const k of keys) {
      assert.ok(k in e, `missing key: ${k}`)
    }
  })

  it('normalized entropy fields are 0–1', () => {
    const e = computeEntropyMetrics(GOOD_METRICS)
    // These specific fields are normalized 0-1 (not raw counts or APCA scores)
    const normalizedFields = [
      'typographyEntropy', 'colorEntropy', 'spacingEntropy',
      'overallDesignEntropy', 'spacingGridAdherence',
    ]
    for (const k of normalizedFields) {
      if (k in e) {
        assert.ok(e[k] >= 0 && e[k] <= 1,
          `${k} should be 0-1, got ${e[k]}`)
      }
    }
  })

  it('does not throw on empty metrics', () => {
    assert.doesNotThrow(() => computeEntropyMetrics({}))
  })

  it('good design has higher spacing grid adherence than vibecoded', () => {
    const goodE = computeEntropyMetrics(GOOD_METRICS)
    const vibeE = computeEntropyMetrics(VIBECODED_METRICS)
    // Good design has consistent 4/8px grid — spacingGridAdherence should be higher
    // Vibecoded fixture has off-grid spacing values
    assert.ok(goodE.spacingGridAdherence > vibeE.spacingGridAdherence,
      `good gridAdherence (${goodE.spacingGridAdherence}) should beat vibecoded (${vibeE.spacingGridAdherence})`)
  })
})

// ---------------------------------------------------------------------------
// groupComponents
// ---------------------------------------------------------------------------
describe('groupComponents — return shape', () => {
  it('returns css_health, visual_quality, structure, originality', () => {
    const result = scoreDOMMetrics(GOOD_METRICS)
    const groups = groupComponents(result.breakdown, GOOD_METRICS)
    assert.ok('css_health' in groups)
    assert.ok('visual_quality' in groups)
    assert.ok('structure' in groups)
    assert.ok('originality' in groups)
  })

  it('each group has a score in 0–100', () => {
    const result = scoreDOMMetrics(GOOD_METRICS)
    const groups = groupComponents(result.breakdown, GOOD_METRICS)
    for (const [key, val] of Object.entries(groups)) {
      assert.ok(typeof val.score === 'number',
        `${key}.score should be a number`)
      assert.ok(val.score >= 0 && val.score <= 100,
        `${key}.score out of range: ${val.score}`)
    }
  })

  it('css_health exposes raw counts', () => {
    const result = scoreDOMMetrics(GOOD_METRICS)
    const groups = groupComponents(result.breakdown, GOOD_METRICS)
    const css = groups.css_health
    assert.ok(typeof css.unique_colors === 'number', 'unique_colors missing')
    assert.ok(typeof css.unique_font_families === 'number', 'unique_font_families missing')
    assert.ok(typeof css.unique_font_sizes === 'number', 'unique_font_sizes missing')
    assert.ok(typeof css.unique_border_radii === 'number', 'unique_border_radii missing')
    assert.ok(typeof css.spacing_on_grid_pct === 'number', 'spacing_on_grid_pct missing')
  })

  it('css_health counts match fixture data', () => {
    const result = scoreDOMMetrics(GOOD_METRICS)
    const groups = groupComponents(result.breakdown, GOOD_METRICS)
    const css = groups.css_health
    // GOOD_METRICS has 7 colors, 2 font families
    assert.strictEqual(css.unique_colors, GOOD_METRICS.colors.length)
    assert.strictEqual(css.unique_font_families, GOOD_METRICS.fontFamilies.length)
  })

  it('does not throw on minimal metrics', () => {
    const result = scoreDOMMetrics(MINIMAL_METRICS)
    assert.doesNotThrow(() => groupComponents(result.breakdown, MINIMAL_METRICS))
    assert.doesNotThrow(() => groupComponents(result.breakdown, {}))
  })
})

// ---------------------------------------------------------------------------
// Regression: empty metrics should not produce NaN
// ---------------------------------------------------------------------------
describe('regression — no NaN in output', () => {
  it('no NaN in scoreDOMMetrics output for empty input', () => {
    const { overall, breakdown } = scoreDOMMetrics({})
    assert.ok(!isNaN(overall), `overall is NaN`)
    for (const b of breakdown) {
      assert.ok(!isNaN(b.score), `${b.category} score is NaN`)
    }
  })

  it('no NaN in groupComponents for empty input', () => {
    const result = scoreDOMMetrics({})
    const groups = groupComponents(result.breakdown, {})
    for (const [key, val] of Object.entries(groups)) {
      assert.ok(!isNaN(val.score), `${key}.score is NaN`)
    }
  })
})
