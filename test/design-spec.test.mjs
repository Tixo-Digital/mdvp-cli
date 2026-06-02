import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractFrontMatter,
  parseFrontMatter,
  normalizeSpec,
  compareToSpec,
  specCompliancePenalty,
} from '../engine/design-spec.mjs'
import { VIBECODED_METRICS, GOOD_METRICS } from './fixtures/metrics.mjs'

// A compact DESIGN.md modeled on the google-labs-code format.
const SAMPLE = `---
name: Test System
colors:
  primary: "#2563eb"
  surface: "#ffffff"
  on-surface: "#111827"
typography:
  display:
    fontFamily: DM Sans
    fontSize: 32px
    fontWeight: "700"
  body:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: "400"
rounded:
  sm: 0.25rem
  md: 0.5rem
  full: 9999px
spacing:
  xs: 8px
  md: 24px
---

# Test System

Body copy here.
`

describe('front matter extraction', () => {
  it('pulls the block between the first --- fences', () => {
    const fm = extractFrontMatter(SAMPLE)
    assert.ok(fm.includes('name: Test System'))
    assert.ok(!fm.includes('# Test System'), 'markdown body must not leak into front matter')
  })

  it('returns null when there is no front matter', () => {
    assert.equal(extractFrontMatter('# Just markdown\n\ntext'), null)
  })
})

describe('YAML subset parser', () => {
  const raw = parseFrontMatter(extractFrontMatter(SAMPLE))

  it('parses nested maps', () => {
    assert.equal(raw.name, 'Test System')
    assert.equal(raw.colors.primary, '#2563eb')
    assert.equal(raw.typography.display.fontFamily, 'DM Sans')
    assert.equal(raw.typography.body.fontSize, '16px')
  })

  it('strips quotes from values', () => {
    assert.equal(raw.typography.display.fontWeight, '700')
  })

  it('also accepts JSON front matter', () => {
    const j = parseFrontMatter('{"name":"J","colors":{"a":"#000000"}}')
    assert.equal(j.name, 'J')
    assert.equal(j.colors.a, '#000000')
  })
})

describe('normalizeSpec', () => {
  const spec = normalizeSpec(parseFrontMatter(extractFrontMatter(SAMPLE)))

  it('collects colors as Oklab-ready entries', () => {
    assert.equal(spec.colors.length, 3)
    assert.ok(spec.colors[0].lab, 'each color has a lab value')
  })

  it('collects fonts, sizes, radii, spacing', () => {
    assert.deepEqual([...spec.fonts], ['DM Sans'])
    assert.ok(spec.fontSizes.has(32) && spec.fontSizes.has(16))
    assert.ok(spec.radii.has(4) && spec.radii.has(8) && spec.radii.has(9999), 'rem converted to px')
    assert.ok(spec.spacing.has(8) && spec.spacing.has(24))
  })
})

describe('compareToSpec', () => {
  const spec = normalizeSpec(parseFrontMatter(extractFrontMatter(SAMPLE)))

  it('flags off-palette colors, off-scale fonts on vibecoded metrics', () => {
    const { violations, summary } = compareToSpec(VIBECODED_METRICS, spec)
    assert.ok(summary.errors > 0, 'vibecoded should produce errors')
    assert.ok(violations.some((v) => v.type === 'color'), 'Tailwind palette is off-spec')
    assert.ok(violations.some((v) => v.type === 'font' && v.value === 'Inter'), 'Inter is off-spec')
  })

  it('does not flag a font that is in the spec', () => {
    const onSpec = { fontFamilies: [['DM Sans', 100]], colors: [], fontSizes: [], borderRadii: [] }
    const { violations } = compareToSpec(onSpec, spec)
    assert.ok(!violations.some((v) => v.type === 'font'), 'DM Sans is allowed')
  })

  it('uses perceptual distance, not string equality, for colors', () => {
    // #2563eb is rgb(37,99,235); a near-identical rgb should pass within ΔE
    const near = { colors: [['rgb(38, 100, 236)', 50]], fontFamilies: [], fontSizes: [], borderRadii: [] }
    const { violations } = compareToSpec(near, spec)
    assert.ok(!violations.some((v) => v.type === 'color'), 'near-identical color should be in palette')
  })

  it('ignores one-off colors below minColorUses', () => {
    const rare = { colors: [['rgb(220, 50, 90)', 1]], fontFamilies: [], fontSizes: [], borderRadii: [] }
    const { violations } = compareToSpec(rare, spec)
    assert.ok(!violations.some((v) => v.type === 'color'), 'colors used <3 times are ignored')
  })

  it('deduplicates repeated font families', () => {
    const dup = { fontFamilies: [['Inter', 400], ['Inter', 100]], colors: [], fontSizes: [], borderRadii: [] }
    const { violations } = compareToSpec(dup, spec)
    assert.equal(violations.filter((v) => v.type === 'font').length, 1, 'Inter flagged once')
  })
})

describe('specCompliancePenalty', () => {
  const spec = normalizeSpec(parseFrontMatter(extractFrontMatter(SAMPLE)))

  it('is 0 for a null result', () => {
    assert.equal(specCompliancePenalty(null), 0)
  })

  it('is capped at 40', () => {
    const result = compareToSpec(VIBECODED_METRICS, spec)
    const p = specCompliancePenalty(result)
    assert.ok(p > 0 && p <= 40, `penalty ${p} should be in (0, 40]`)
  })
})
