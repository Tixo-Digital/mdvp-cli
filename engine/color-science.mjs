// Ported from backend/src/color-science.ts — pure JS, no dependencies

function srgbToLinear(c) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function rgbToOklab(r, g, b) {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2220049412 * lg + 0.6696926020 * lb

  const l = Math.cbrt(l_)
  const m = Math.cbrt(m_)
  const s = Math.cbrt(s_)

  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  }
}

export function oklabToOklch(lab) {
  return {
    L: lab.L,
    C: Math.sqrt(lab.a * lab.a + lab.b * lab.b),
    h: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360,
  }
}

export function parseColor(raw) {
  let m = raw.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  m = raw.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  m = raw.match(/#([0-9a-f]{6})/i)
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) }
  return null
}

export function deltaE(lab1, lab2) {
  const dL = lab1.L - lab2.L
  const da = lab1.a - lab2.a
  const db = lab1.b - lab2.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

export function contrastAPCA(fg, bg) {
  const Yfg = 0.2126729 * srgbToLinear(fg.r) + 0.7151522 * srgbToLinear(fg.g) + 0.0721750 * srgbToLinear(fg.b)
  const Ybg = 0.2126729 * srgbToLinear(bg.r) + 0.7151522 * srgbToLinear(bg.g) + 0.0721750 * srgbToLinear(bg.b)
  const Sapc = Ybg > Yfg
    ? (Math.pow(Ybg, 0.56) - Math.pow(Yfg, 0.57)) * 1.14
    : (Math.pow(Ybg, 0.65) - Math.pow(Yfg, 0.62)) * 1.14
  return Math.abs(Sapc) * 100
}

export function isNeutral(lch) { return lch.C < 0.04 }

export function colorTemperature(lch) {
  if (isNeutral(lch)) return 'neutral'
  if (lch.h >= 20 && lch.h <= 90) return 'warm'
  if (lch.h >= 200 && lch.h <= 290) return 'cool'
  if (lch.h >= 90 && lch.h <= 200) return 'cool'
  return 'warm'
}

function scoreHarmony(chromaticLCH) {
  const violations = []
  if (chromaticLCH.length === 0) return { score: 50, type: 'none', violations: ['No chromatic colors — pure neutral palette'] }
  if (chromaticLCH.length === 1) return { score: 80, type: 'monochromatic', violations: [] }

  const hues = chromaticLCH.map(c => c.h)
  let bestScore = 0, bestType = 'random'

  const schemes = [
    { type: 'complementary', angle: 180, tolerance: 25, score: 92 },
    { type: 'triadic', angle: 120, tolerance: 20, score: 90 },
    { type: 'split-complementary', angle: 150, tolerance: 20, score: 88 },
    { type: 'tetradic-rectangle', angle: 60, tolerance: 15, score: 85 },
    { type: 'tetradic-square', angle: 90, tolerance: 15, score: 87 },
    { type: 'analogous', angle: 30, tolerance: 20, score: 82 },
    { type: 'contrast-triadic', angle: 140, tolerance: 15, score: 86 },
  ]

  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const diff = Math.abs(hues[i] - hues[j])
      const norm = diff > 180 ? 360 - diff : diff
      for (const scheme of schemes) {
        const deviation = Math.abs(norm - scheme.angle)
        if (deviation <= scheme.tolerance && scheme.score > bestScore) {
          bestScore = scheme.score; bestType = scheme.type
        }
      }
    }
  }

  const saturations = chromaticLCH.map(c => c.C)
  const avgSat = saturations.reduce((a, b) => a + b, 0) / saturations.length
  const satVariance = saturations.reduce((s, v) => s + Math.pow(v - avgSat, 2), 0) / saturations.length
  if (satVariance > 0.02) { violations.push(`Inconsistent saturation (variance: ${(satVariance * 100).toFixed(1)})`); bestScore -= 10 }

  const lightnesses = chromaticLCH.map(c => c.L)
  const allSameLightness = Math.max(...lightnesses) - Math.min(...lightnesses) < 0.15
  if (allSameLightness && chromaticLCH.length > 2) { violations.push('All chromatic colors at similar lightness'); bestScore -= 5 }

  if (bestScore === 0) {
    const hueRange = Math.max(...hues) - Math.min(...hues)
    if (hueRange < 40) return { score: 75, type: 'analogous-close', violations }
    violations.push('Colors do not follow any standard color harmony scheme')
    return { score: 30, type: 'random', violations }
  }
  return { score: Math.max(0, bestScore), type: bestType, violations }
}

function scoreSophisticationPalette(all, neutrals, chromatic, nearDups, harmonyScore) {
  let score = 50
  if (neutrals.length >= 3 && neutrals.length <= 8) {
    const lightnesses = neutrals.map(c => c.lch.L).sort()
    const steps = []
    for (let i = 1; i < lightnesses.length; i++) steps.push(lightnesses[i] - lightnesses[i - 1])
    const avgStep = steps.reduce((a, b) => a + b, 0) / steps.length
    const variance = steps.reduce((s, v) => s + Math.pow(v - avgStep, 2), 0) / steps.length
    if (variance < 0.01) score += 20
    else if (variance < 0.03) score += 10
  }
  if (chromatic.length >= 1 && chromatic.length <= 3) score += 15
  else if (chromatic.length >= 4 && chromatic.length <= 6) score += 5
  else if (chromatic.length > 8) score -= 10
  score += Math.round(harmonyScore * 0.2)
  if (nearDups.length > 3) score -= nearDups.length * 3
  if (neutrals.length > 0 && chromatic.length > 0) {
    const neutralTemps = neutrals.map(c => colorTemperature(c.lch))
    if (neutralTemps.some(t => t !== 'neutral')) score += 10
  }
  return Math.max(0, Math.min(100, score))
}

export function analyzePalette(colors) {
  const parsed = []
  for (const [raw, count] of colors) {
    const rgb = parseColor(raw)
    if (!rgb) continue
    const lab = rgbToOklab(rgb.r, rgb.g, rgb.b)
    const lch = oklabToOklch(lab)
    parsed.push({ raw, rgb, lab, lch, count })
  }

  const neutrals = parsed.filter(c => isNeutral(c.lch))
  const chromatic = parsed.filter(c => !isNeutral(c.lch))

  const nearDuplicates = []
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const dE = deltaE(parsed[i].lab, parsed[j].lab)
      if (dE > 0.001 && dE < 0.008) nearDuplicates.push({ a: parsed[i].raw, b: parsed[j].raw, deltaE: Math.round(dE * 1000) / 1000 })
    }
  }

  const harmonyResult = scoreHarmony(chromatic.map(c => c.lch))
  const temps = parsed.map(c => colorTemperature(c.lch))
  const warmCount = temps.filter(t => t === 'warm').length
  const coolCount = temps.filter(t => t === 'cool').length
  let temperatureProfile
  if (warmCount > coolCount * 2) temperatureProfile = 'warm'
  else if (coolCount > warmCount * 2) temperatureProfile = 'cool'
  else if (warmCount === 0 && coolCount === 0) temperatureProfile = 'neutral'
  else temperatureProfile = 'mixed'

  const textColors = parsed.filter(c => c.lch.L < 0.5 || c.lch.L > 0.8)
  const bgColors = parsed.filter(c => c.lch.L > 0.9 || c.lch.L < 0.15)
  const contrastIssues = []
  for (const fg of textColors) {
    for (const bg of bgColors) {
      const apca = contrastAPCA(fg.rgb, bg.rgb)
      if (apca < 45) contrastIssues.push({ fg: fg.raw, bg: bg.raw, apca: Math.round(apca), severity: apca < 30 ? 'critical' : 'warning' })
    }
  }

  const sophisticationScore = scoreSophisticationPalette(parsed, neutrals, chromatic, nearDuplicates, harmonyResult.score)

  const issues = []
  if (nearDuplicates.length > 3) issues.push(`${nearDuplicates.length} near-duplicate color pairs. Consolidate palette`)
  if (chromatic.length > 5) issues.push(`${chromatic.length} chromatic colors. Professional limit: 2-3 accent colors`)
  if (chromatic.length === 0 && neutrals.length > 0) issues.push('No accent color. Monochrome palette lacks visual hierarchy')
  if (temperatureProfile === 'mixed') issues.push('Mixed warm and cool tones without clear intent')
  const criticalContrast = contrastIssues.filter(i => i.severity === 'critical')
  if (criticalContrast.length > 0) issues.push(`${criticalContrast.length} critical contrast failures (APCA < 30)`)

  const hasSystem = neutrals.length >= 2 && chromatic.length >= 1 && chromatic.length <= 3 && nearDuplicates.length <= 2

  return {
    totalColors: parsed.length,
    neutrals: neutrals.map(c => ({ color: c.raw, lch: c.lch })),
    chromaticColors: chromatic.map(c => ({ color: c.raw, lch: c.lch })),
    nearDuplicates,
    harmonyScore: harmonyResult.score,
    harmonyType: harmonyResult.type,
    harmonyViolations: harmonyResult.violations,
    temperatureProfile,
    sophisticationScore,
    contrastIssues,
    hasSystem,
    issues,
  }
}
