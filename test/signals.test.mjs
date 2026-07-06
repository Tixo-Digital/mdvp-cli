import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { SIGNALS, applySignals } from '../engine/signals/index.mjs'
import { VIBECODED_METRICS, GOOD_METRICS } from './fixtures/metrics.mjs'

const signalsDir = join(dirname(fileURLToPath(import.meta.url)), '../engine/signals')

// ── Registry integrity ───────────────────────────────────────────────────────

describe('signal registry — shape', () => {
  it('every signal has the required fields', () => {
    for (const sig of SIGNALS) {
      assert.equal(typeof sig.id, 'string', `id missing on ${JSON.stringify(sig)}`)
      assert.ok(/^[a-z0-9-]+$/.test(sig.id), `id not kebab-case: ${sig.id}`)
      assert.equal(typeof sig.label, 'string', `label missing on ${sig.id}`)
      assert.equal(typeof sig.penalty, 'number', `penalty missing on ${sig.id}`)
      assert.ok(sig.penalty >= 0 && sig.penalty <= 100, `penalty out of range on ${sig.id}`)
      assert.equal(typeof sig.rationale, 'string', `rationale missing on ${sig.id}`)
      assert.equal(typeof sig.test, 'function', `test() missing on ${sig.id}`)
    }
  })

  it('signal ids are unique', () => {
    const ids = SIGNALS.map((s) => s.id)
    assert.equal(new Set(ids).size, ids.length, `duplicate ids in ${ids.join(', ')}`)
  })

  it('every .mjs file in signals/ is registered (no orphans)', () => {
    const files = readdirSync(signalsDir)
      .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
      .map((f) => f.replace(/\.mjs$/, ''))
    const registered = new Set(SIGNALS.map((s) => s.id))
    for (const file of files) {
      assert.ok(registered.has(file), `signal file ${file}.mjs is not in index.mjs SIGNALS`)
    }
  })

  it('every signal id matches a file of the same name', () => {
    const files = new Set(
      readdirSync(signalsDir).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')),
    )
    for (const sig of SIGNALS) {
      assert.ok(files.has(sig.id), `signal id ${sig.id} has no matching ${sig.id}.mjs`)
    }
  })

  it('test() returns null or a {detail} object — never throws', () => {
    const ctx = { utility: false, parsePx: (v) => parseFloat(String(v)) }
    for (const sig of SIGNALS) {
      const r = sig.test({}, ctx)
      if (r !== null) {
        assert.equal(typeof r.detail, 'string', `${sig.id} returned non-null without a string detail`)
      }
    }
  })
})

// ── applySignals behaviour ────────────────────────────────────────────────────

describe('applySignals', () => {
  const ctx = { utility: false, parsePx: (v) => parseFloat(String(v)) }

  it('flags vibecoded metrics with multiple signals', () => {
    const { matched, signalCount, totalPenalty } = applySignals(VIBECODED_METRICS, ctx)
    assert.ok(matched.length >= 4, `expected ≥4 signals on vibecoded, got ${matched.length}`)
    assert.ok(signalCount >= matched.length, 'signalCount should be ≥ matched count (weights ≥ 1)')
    assert.ok(totalPenalty > 0, 'vibecoded should accrue penalty')
    assert.ok(matched.some((m) => m.id === 'inter-font'), 'should detect Inter font')
    assert.ok(matched.some((m) => m.id === 'pill-radius'), 'should detect pills')
  })

  it('barely flags good metrics', () => {
    const { matched } = applySignals(GOOD_METRICS, ctx)
    // GOOD uses a single deliberate accent; should not trip the heavy signals
    assert.ok(!matched.some((m) => m.id === 'inter-font'), 'DM Sans should not trip inter-font')
    assert.ok(!matched.some((m) => m.id === 'pill-radius'), 'good radii should not trip pills')
    assert.ok(!matched.some((m) => m.id === 'sparse-content'), '200 elements is not sparse')
  })

  it('config.disabled removes a signal', () => {
    const before = applySignals(VIBECODED_METRICS, ctx)
    const after = applySignals(VIBECODED_METRICS, ctx, { disabled: ['inter-font'] })
    assert.ok(before.matched.some((m) => m.id === 'inter-font'))
    assert.ok(!after.matched.some((m) => m.id === 'inter-font'), 'inter-font should be disabled')
    assert.ok(after.totalPenalty < before.totalPenalty, 'disabling a signal lowers penalty')
  })

  it('config.penalties overrides a penalty', () => {
    const base = applySignals(VIBECODED_METRICS, ctx)
    const baseInter = base.matched.find((m) => m.id === 'inter-font')
    const bumped = applySignals(VIBECODED_METRICS, ctx, { penalties: { 'inter-font': 50 } })
    const bumpedInter = bumped.matched.find((m) => m.id === 'inter-font')
    assert.equal(bumpedInter.penalty, 50, 'override should set penalty to 50')
    assert.ok(bumpedInter.penalty > baseInter.penalty, 'override raised the penalty')
  })

  it('a signal that throws does not break scoring', () => {
    const bomb = { id: 'bomb', label: 'x', penalty: 5, rationale: 'x', test() { throw new Error('boom') } }
    SIGNALS.push(bomb)
    try {
      assert.doesNotThrow(() => applySignals(VIBECODED_METRICS, ctx))
    } finally {
      SIGNALS.pop()
    }
  })
})

// ── New negative-skill signals ────────────────────────────────────────────────

describe('new anti-pattern signals', () => {
  const ctx = { utility: false, parsePx: (v) => parseFloat(String(v)) }
  const find = (id) => SIGNALS.find((s) => s.id === id)

  it('pulse-animation fires on pulsing elements', () => {
    assert.equal(find('pulse-animation').test({ pulseAnimationCount: 0 }, ctx), null)
    assert.ok(find('pulse-animation').test({ pulseAnimationCount: 5 }, ctx))
  })

  it('eyebrow-chip fires when a chip sits above the H1', () => {
    assert.equal(find('eyebrow-chip').test({ eyebrowCount: 0 }, ctx), null)
    assert.ok(find('eyebrow-chip').test({ eyebrowCount: 1 }, ctx))
  })

  it('status-dot fires on decorative colored dots', () => {
    assert.equal(find('status-dot').test({ statusDotCount: 1 }, ctx), null)
    assert.ok(find('status-dot').test({ statusDotCount: 4 }, ctx))
  })

  it('gradient-text fires on gradient clip text', () => {
    assert.equal(find('gradient-text').test({ gradientTextCount: 0 }, ctx), null)
    assert.ok(find('gradient-text').test({ gradientTextCount: 2 }, ctx))
  })

  it('gradient-background fires on repeated or layered gradient surfaces', () => {
    assert.equal(find('gradient-background').test({ gradientBackgroundCount: 1, gradientBackgroundLayerCount: 1 }, ctx), null)
    assert.equal(find('gradient-background').test({ gradientBackgroundCount: 2, gradientBackgroundLayerCount: 2 }, ctx).penalty, 6)
    assert.ok(find('gradient-background').test({ gradientBackgroundCount: 1, gradientBackgroundLayerCount: 4 }, ctx))
    assert.equal(find('gradient-background').test({ gradientTextCount: 3 }, ctx), null)
  })

  it('glassmorphism-overuse fires on repeated backdrop-blurred surfaces', () => {
    assert.equal(find('glassmorphism-overuse').test({ backdropBlurCount: 2 }, ctx), null)
    assert.equal(find('glassmorphism-overuse').test({ backdropBlurCount: 3 }, ctx).penalty, 6)
    assert.ok(find('glassmorphism-overuse').test({ backdropBlurCount: 6 }, ctx))
  })

  it('generic-marketing-copy fires on repeated generic phrases', () => {
    assert.equal(find('generic-marketing-copy').test({ genericTextCount: 1 }, ctx), null)
    assert.ok(find('generic-marketing-copy').test({ genericTextCount: 2 }, ctx))
    assert.equal(find('generic-marketing-copy').test({ genericTextCount: 4 }, ctx).penalty, 15)
  })

  it('centered-max-width-layout fires on repeated centered page shells', () => {
    assert.equal(find('centered-max-width-layout').test({ centeredMaxWidthContainerCount: 1 }, ctx), null)
    assert.equal(find('centered-max-width-layout').test({ centeredMaxWidthContainerCount: 3 }, ctx), null)
    assert.ok(find('centered-max-width-layout').test({ centeredMaxWidthContainerCount: 4 }, ctx))
    assert.equal(
      applySignals({ centeredMaxWidthContainerCount: 4 }, ctx).matched
        .find((m) => m.id === 'centered-max-width-layout').penalty,
      8,
    )
    assert.equal(find('centered-max-width-layout').test({ centeredMaxWidthContainerCount: 8 }, ctx).penalty, 12)
  })

  it('centered-max-width-layout ignores utility/tool pages', () => {
    const utilityCtx = { ...ctx, utility: true }
    assert.equal(
      find('centered-max-width-layout').test({ centeredMaxWidthContainerCount: 8 }, utilityCtx),
      null,
    )
  })

  it('uniform-button-style fires when many controls share one treatment', () => {
    assert.equal(find('uniform-button-style').test({ styledButtonCount: 2, buttonStyleVariantCount: 1, dominantButtonStyleCount: 2, dominantButtonStyleShare: 1 }, ctx), null)
    assert.equal(find('uniform-button-style').test({ styledButtonCount: 3, buttonStyleVariantCount: 1, dominantButtonStyleCount: 3, dominantButtonStyleShare: 1 }, ctx).penalty, 5)
    assert.ok(find('uniform-button-style').test({ styledButtonCount: 6, buttonStyleVariantCount: 2, dominantButtonStyleCount: 5, dominantButtonStyleShare: 0.83 }, ctx))
  })

  it('uniform-button-style stays quiet when controls show hierarchy', () => {
    assert.equal(find('uniform-button-style').test({ styledButtonCount: 5, buttonStyleVariantCount: 3, dominantButtonStyleCount: 3, dominantButtonStyleShare: 0.6 }, ctx), null)
    assert.equal(find('uniform-button-style').test({ styledButtonCount: 4, buttonStyleVariantCount: 2, dominantButtonStyleCount: 3, dominantButtonStyleShare: 0.75 }, ctx), null)
  })
})
