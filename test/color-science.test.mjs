import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rgbToOklab,
  oklabToOklch,
  parseColor,
  deltaE,
  contrastAPCA,
  isNeutral,
  colorTemperature,
  analyzePalette,
} from '../engine/color-science.mjs'

describe('rgbToOklab', () => {
  it('converts pure white to near-maximum L', () => {
    const lab = rgbToOklab(255, 255, 255)
    assert.ok(lab.L > 0.99, `white L should be ~1, got ${lab.L}`)
    assert.ok(Math.abs(lab.a) < 0.01, `white a should be ~0, got ${lab.a}`)
    assert.ok(Math.abs(lab.b) < 0.01, `white b should be ~0, got ${lab.b}`)
  })

  it('converts pure black to L≈0', () => {
    const lab = rgbToOklab(0, 0, 0)
    assert.ok(lab.L < 0.01, `black L should be ~0, got ${lab.L}`)
  })

  it('red has positive a chroma', () => {
    const lab = rgbToOklab(255, 0, 0)
    assert.ok(lab.a > 0.1, `red should have positive a, got ${lab.a}`)
  })

  it('returns object with L, a, b keys', () => {
    const lab = rgbToOklab(128, 64, 200)
    assert.ok('L' in lab && 'a' in lab && 'b' in lab)
  })
})

describe('oklabToOklch', () => {
  it('converts Lab to LCH — C is non-negative', () => {
    const lab = { L: 0.6, a: 0.1, b: -0.2 }
    const lch = oklabToOklch(lab)
    assert.ok(lch.C >= 0, `C should be >= 0, got ${lch.C}`)
    assert.strictEqual(lch.L, 0.6)
    // h is lowercase, in degrees 0–360
    assert.ok(lch.h >= 0 && lch.h < 360, `h should be 0-360, got ${lch.h}`)
  })

  it('neutral gray has near-zero C', () => {
    const lab = rgbToOklab(128, 128, 128)
    const lch = oklabToOklch(lab)
    assert.ok(lch.C < 0.02, `gray should have low chroma, got ${lch.C}`)
  })
})

describe('parseColor', () => {
  it('parses rgb() strings — returns {r, g, b}', () => {
    const rgb = parseColor('rgb(255, 0, 0)')
    assert.ok(rgb !== null)
    assert.strictEqual(rgb.r, 255)
    assert.strictEqual(rgb.g, 0)
    assert.strictEqual(rgb.b, 0)
  })

  it('parses rgba() strings (ignores alpha)', () => {
    const rgb = parseColor('rgba(0, 0, 255, 0.5)')
    assert.ok(rgb !== null)
    assert.strictEqual(rgb.b, 255)
  })

  it('parses hex color', () => {
    const rgb = parseColor('#ff0000')
    assert.ok(rgb !== null)
    assert.strictEqual(rgb.r, 255)
  })

  it('returns null for unparseable input', () => {
    const result = parseColor('transparent')
    assert.strictEqual(result, null)
  })
})

describe('deltaE', () => {
  it('returns 0 for identical colors', () => {
    const lab = rgbToOklab(100, 150, 200)
    assert.strictEqual(deltaE(lab, lab), 0)
  })

  it('returns larger value for more different colors', () => {
    const white = rgbToOklab(255, 255, 255)
    const black = rgbToOklab(0, 0, 0)
    const lightGray = rgbToOklab(240, 240, 240)
    const dFar = deltaE(white, black)
    const dClose = deltaE(white, lightGray)
    assert.ok(dFar > dClose, `black-white (${dFar}) should be > white-lightgray (${dClose})`)
  })
})

describe('contrastAPCA', () => {
  // contrastAPCA takes {r, g, b} objects (not OKLab)
  it('black on white has high contrast (> 80)', () => {
    const fg = { r: 0, g: 0, b: 0 }
    const bg = { r: 255, g: 255, b: 255 }
    const lc = contrastAPCA(fg, bg)
    assert.ok(lc > 80, `black-on-white APCA should be > 80, got ${lc}`)
  })

  it('white on white has ~0 contrast', () => {
    const white = { r: 255, g: 255, b: 255 }
    const lc = contrastAPCA(white, white)
    assert.ok(lc < 5, `same-color contrast should be ~0, got ${lc}`)
  })

  it('returns a finite number', () => {
    const fg = { r: 30, g: 30, b: 30 }
    const bg = { r: 240, g: 240, b: 240 }
    const result = contrastAPCA(fg, bg)
    assert.ok(typeof result === 'number' && isFinite(result))
  })
})

describe('isNeutral', () => {
  // isNeutral takes LCH object with lowercase h
  it('gray is neutral', () => {
    const lch = oklabToOklch(rgbToOklab(128, 128, 128))
    assert.ok(isNeutral(lch))
  })

  it('bright red is not neutral', () => {
    const lch = oklabToOklch(rgbToOklab(220, 30, 30))
    assert.ok(!isNeutral(lch))
  })
})

describe('colorTemperature', () => {
  it('returns warm, cool, or neutral', () => {
    const lch = oklabToOklch(rgbToOklab(200, 80, 30))  // orange-red
    const temp = colorTemperature(lch)
    assert.ok(['warm', 'cool', 'neutral'].includes(temp), `unexpected temp: ${temp}`)
  })

  it('neutral gray returns neutral', () => {
    const lch = oklabToOklch(rgbToOklab(128, 128, 128))
    assert.strictEqual(colorTemperature(lch), 'neutral')
  })
})

describe('analyzePalette', () => {
  it('analyzes an empty palette without throwing', () => {
    const result = analyzePalette([])
    assert.ok(typeof result === 'object')
    assert.ok(Array.isArray(result.nearDuplicates))
  })

  it('detects near-duplicate colors', () => {
    const colors = [
      ['rgb(59, 130, 246)', 10],
      ['rgb(60, 131, 247)', 10],   // almost identical
      ['rgb(15, 23, 42)', 100],
      ['rgb(248, 250, 252)', 80],
    ]
    const result = analyzePalette(colors)
    assert.ok(result.nearDuplicates.length >= 1, 'should detect near-duplicate blues')
  })

  it('counts neutrals vs chromatic correctly', () => {
    const colors = [
      ['rgb(128, 128, 128)', 50],  // neutral gray
      ['rgb(200, 200, 200)', 30],  // neutral light
      ['rgb(220, 50, 50)', 20],    // red (chromatic)
    ]
    const result = analyzePalette(colors)
    // neutrals and chromaticColors are arrays of objects
    assert.ok(result.neutrals.length >= 1, 'should detect at least 1 neutral')
    assert.ok(result.chromaticColors.length >= 1, 'should detect at least 1 chromatic')
  })

  it('returns harmonyScore as a number 0–100', () => {
    const colors = [['rgb(59, 130, 246)', 60], ['rgb(255, 255, 255)', 200], ['rgb(15, 23, 42)', 300]]
    const result = analyzePalette(colors)
    assert.ok(typeof result.harmonyScore === 'number')
    assert.ok(result.harmonyScore >= 0 && result.harmonyScore <= 100,
      `harmonyScore out of range: ${result.harmonyScore}`)
  })

  it('detects contrastIssues array', () => {
    const colors = [
      ['rgb(200, 200, 200)', 100],
      ['rgb(220, 220, 220)', 100],
    ]
    const result = analyzePalette(colors)
    assert.ok(Array.isArray(result.contrastIssues))
  })
})
