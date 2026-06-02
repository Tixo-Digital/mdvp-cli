// Ported from backend/src/dom-scorer.ts — pure JS, no dependencies
// Scoring algorithm: Shannon entropy + design heuristics on DOM metrics
import { analyzePalette } from './color-science.mjs'
import { applySignals } from './signals/index.mjs'

// Shannon entropy — H=0: perfect consistency, H=1: maximum chaos
function shannonEntropy(distribution) {
  const total = distribution.reduce((s, [, c]) => s + c, 0)
  if (total === 0) return 0
  return -distribution.reduce((h, [, c]) => {
    const p = c / total
    return p > 0 ? h + p * Math.log2(p) : h
  }, 0)
}

function normalizedEntropy(distribution) {
  const h = shannonEntropy(distribution)
  const maxH = Math.log2(Math.max(distribution.length, 1))
  return maxH === 0 ? 0 : Math.min(h / maxH, 1)
}

function clusterValues(distribution, threshold = 2) {
  const nums = distribution.map(([v, c]) => [parseFloat(v), c])
    .filter(([v]) => !isNaN(v)).sort((a, b) => a[0] - b[0])
  const clusters = []
  for (const [val, count] of nums) {
    const last = clusters[clusters.length - 1]
    if (last && Math.abs(parseFloat(last[0]) - val) <= threshold) {
      clusters[clusters.length - 1] = [last[0], last[1] + count]
    } else {
      clusters.push([String(val), count])
    }
  }
  return clusters
}

function parsePx(v) { return parseFloat(String(v).replace('px', '')) }

function hasSubPixel(values) {
  return values.filter(([v]) => { const n = parsePx(v); return !isNaN(n) && n % 1 !== 0 }).length
}

function detectGrid(values) {
  const pxValues = values.map(([v]) => parsePx(v)).filter(v => !isNaN(v) && v > 0 && v < 200)
  if (pxValues.length === 0) return { base: 8, adherence: 0 }
  let bestBase = 4, bestAdherence = 0
  for (const base of [4, 8]) {
    const onGrid = pxValues.filter(v => v % base === 0 || Math.abs(v % base) < 0.5).length
    const adherence = onGrid / pxValues.length
    if (adherence > bestAdherence) { bestBase = base; bestAdherence = adherence }
  }
  return { base: bestBase, adherence: bestAdherence }
}

function gridJitter(distribution) {
  const vals = distribution.flatMap(([v, c]) => {
    const n = parseFloat(v)
    return isNaN(n) || n <= 0 || n > 200 ? [] : Array(Math.min(c, 50)).fill(n)
  })
  if (vals.length === 0) return 0
  const totalDeviation = vals.reduce((s, v) => { const rem = v % 4; return s + Math.min(rem, 4 - rem) }, 0)
  return Math.min(totalDeviation / vals.length / 2, 1)
}

function nonStandardSizePenalty(distribution) {
  const standardSizes = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96])
  let standardCount = 0, total = 0
  for (const [v, c] of distribution) {
    const n = Math.round(parseFloat(v))
    if (!isNaN(n) && n > 0) { total += c; if (standardSizes.has(n)) standardCount += c }
  }
  return total === 0 ? 0 : 1 - standardCount / total
}

function parseRGB(rgb) {
  const m = String(rgb).match(/\d+/g)
  if (!m || m.length < 3) return [128, 128, 128]
  return [+m[0], +m[1], +m[2]]
}

function linearize(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function rgbToOklabLocal(rgb) {
  const [r, g, b] = parseRGB(rgb)
  const lr = linearize(r), lg = linearize(g), lb = linearize(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

function apcaContrast(fg, bg) {
  const [rF, gF, bF] = parseRGB(fg); const [rB, gB, bB] = parseRGB(bg)
  const Yfg = 0.2126 * linearize(rF) + 0.7152 * linearize(gF) + 0.0722 * linearize(bF)
  const Ybg = 0.2126 * linearize(rB) + 0.7152 * linearize(gB) + 0.0722 * linearize(bB)
  const Sapc = Ybg > Yfg
    ? 1.14 * (Math.pow(Ybg, 0.56) - Math.pow(Yfg, 0.57))
    : 1.14 * (Math.pow(Ybg, 0.65) - Math.pow(Yfg, 0.62))
  return Math.abs(Sapc) * 100
}

function contrastVariance(colors, topBg = 'rgb(255,255,255)') {
  if (colors.length < 2) return 0
  const contrasts = colors.slice(0, 10).map(([c]) => apcaContrast(c, topBg))
  const mean = contrasts.reduce((a, b) => a + b, 0) / contrasts.length
  const variance = contrasts.reduce((s, c) => s + (c - mean) ** 2, 0) / contrasts.length
  return Math.min(Math.sqrt(variance) / 106, 1)
}

function isUtilitySite(metrics) {
  const focusableRatio = metrics.focusableCount && metrics.totalElements > 0
    ? metrics.focusableCount / metrics.totalElements : 0
  return focusableRatio > 0.15 && metrics.totalElements < 150 && (metrics.formCount || 0) > 0
}

// ── Scoring functions ─────────────────────────────────────────────────────────

function scoreSpacing(metrics) {
  let score = 100
  const details = []
  const utility = isUtilitySite(metrics)
  const allSpacing = [...(metrics.paddings || []), ...(metrics.gaps || [])]
  detectGrid(allSpacing) // side-effect free, used for context

  const pxValues = allSpacing.map(([v]) => parsePx(v)).filter(v => !isNaN(v) && v > 0 && v < 200)
  if (pxValues.length > 0) {
    const notOn4 = pxValues.filter(v => v % 4 !== 0 && Math.abs(v % 4) > 0.5)
    const notOn8 = pxValues.filter(v => v % 8 !== 0 && Math.abs(v % 8) > 0.5)
    const redFlagRatio = notOn4.length / pxValues.length
    const yellowFlagRatio = notOn8.length / pxValues.length
    if (utility) {
      details.push('Utility/tool site — spacing grid rules relaxed')
    } else if (redFlagRatio > 0.3) {
      score -= 35; details.push(`${Math.round(redFlagRatio * 100)}% of spacing values not on 4px grid. No spacing system`)
    } else if (redFlagRatio > 0.1) {
      score -= 15; details.push(`${notOn4.length} spacing values not on 4px grid`)
    } else if (yellowFlagRatio > 0.4) {
      score -= 10; details.push(`${Math.round(yellowFlagRatio * 100)}% of spacing not on 8px grid`)
    } else {
      details.push(`${Math.round((1 - redFlagRatio) * 100)}% spacing on grid`)
    }
  }

  const uniquePaddings = (metrics.paddings || []).length
  if (uniquePaddings > 12) { score -= 15; details.push(`${uniquePaddings} unique padding values. Professional limit: 6-8`) }
  else if (uniquePaddings > 8) { score -= 5; details.push(`${uniquePaddings} unique padding values`) }

  const subPixelCount = hasSubPixel(allSpacing)
  if (subPixelCount > 0) { score -= subPixelCount * 3; details.push(`${subPixelCount} sub-pixel spacing values`) }
  if ((metrics.gaps || []).length === 0 && metrics.totalElements > 50) { score -= 10; details.push('No CSS gap detected. Likely margin-based layout') }

  return { category: 'spacing', score: Math.max(0, score), weight: 15, details }
}

function scoreTypography(metrics) {
  let score = 100
  const details = []
  const fontCount = (metrics.fontFamilies || []).length
  if (fontCount > 3) { score -= (fontCount - 2) * 10; details.push(`${fontCount} font families. Professional limit: 2`) }
  else { details.push(`${fontCount} font families`) }

  const sizeCount = (metrics.fontSizes || []).length
  if (sizeCount > 8) { score -= (sizeCount - 6) * 5; details.push(`${sizeCount} unique font sizes. Professional type scale has 5-7`) }
  else if (sizeCount <= 6) { details.push(`Clean type scale with ${sizeCount} sizes`) }

  const subPixelFonts = hasSubPixel(metrics.fontSizes || [])
  if (subPixelFonts > 0) { score -= subPixelFonts * 5; details.push(`${subPixelFonts} sub-pixel font sizes. Use integer values`) }

  const weightCount = (metrics.fontWeights || []).length
  if (weightCount > 4) { score -= (weightCount - 3) * 5; details.push(`${weightCount} font weights. Professional limit: 3`) }

  const sizes = (metrics.fontSizes || []).map(([v]) => parsePx(v)).filter(v => !isNaN(v)).sort((a, b) => a - b)
  if (sizes.length >= 3) {
    const ratios = []
    for (let i = 1; i < sizes.length; i++) { if (sizes[i - 1] > 0) ratios.push(sizes[i] / sizes[i - 1]) }
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length
    const variance = ratios.reduce((s, r) => s + Math.pow(r - avgRatio, 2), 0) / ratios.length
    if (variance > 0.3) { score -= 10; details.push('Inconsistent type scale ratio. Consider a mathematical scale (1.25, 1.333, etc.)') }
  }

  return { category: 'typography', score: Math.max(0, score), weight: 15, details }
}

function scoreColor(metrics) {
  const palette = analyzePalette(metrics.colors || [])
  let score = palette.sophisticationScore
  const details = []

  details.push(`${palette.totalColors} colors: ${palette.neutrals.length} neutrals + ${palette.chromaticColors.length} chromatic`)
  details.push(`Harmony: ${palette.harmonyType} (${palette.harmonyScore}/100)`)
  details.push(`Temperature: ${palette.temperatureProfile}`)

  if (palette.harmonyType === 'random') { score -= 15; details.push('Colors do not follow any classical harmony scheme') }
  for (const v of palette.harmonyViolations) { score -= 5; details.push(v) }
  if (palette.hasSystem) { score += 10; details.push('Color system detected: clear neutrals + limited accents') }
  if (palette.nearDuplicates.length > 3) { score -= (palette.nearDuplicates.length - 2) * 3; details.push(`${palette.nearDuplicates.length} perceptually identical color pairs. Consolidate`) }
  if (palette.chromaticColors.length === 0 && palette.neutrals.length > 0) { score -= 15; details.push('No chromatic accent color. Palette lacks visual interest') }
  if (palette.chromaticColors.length > 6) { score -= (palette.chromaticColors.length - 5) * 3; details.push(`${palette.chromaticColors.length} chromatic colors. Consider reducing to 3-5`) }
  const hasDefaultBlue = (metrics.colors || []).some(([c]) => c === 'rgb(0, 0, 238)' || c === 'rgb(0, 0, 255)')
  if (hasDefaultBlue) { score -= 20; details.push('Browser default link blue (#0000EE) detected. Unstyled links') }
  const hasBlack = (metrics.colors || []).some(([c]) => c === 'rgb(0, 0, 0)')
  if (hasBlack) {
    const usage = (metrics.colors || []).find(([c]) => c === 'rgb(0, 0, 0)')?.[1] || 0
    if (usage > 5 && usage < 100) { score -= 5; details.push(`Pure #000000 on ${usage} elements. Consider near-black (#0a0a0a)`) }
  }
  const criticalContrast = palette.contrastIssues.filter(i => i.severity === 'critical')
  if (criticalContrast.length > 0) { score -= Math.min(10, criticalContrast.length * 3); details.push(`${criticalContrast.length} low-contrast pairs (APCA)`) }
  for (const issue of palette.issues) { if (!details.some(d => d.includes(issue.slice(0, 20)))) details.push(issue) }

  return { category: 'color', score: Math.max(0, Math.min(100, score)), weight: 25, details }
}

function scoreComponents(metrics) {
  let score = 100
  const details = []
  const radiusCount = (metrics.borderRadii || []).length
  if (radiusCount === 0) { score -= 5; details.push('No border-radius detected. Sharp corners everywhere') }
  else if (radiusCount > 5) { score -= (radiusCount - 4) * 5; details.push(`${radiusCount} unique border-radius values. Standardize to 2-3`) }
  else { details.push(`${radiusCount} border-radius values`) }
  const hasPercentRadius = (metrics.borderRadii || []).some(([v]) => String(v).includes('%'))
  const hasPxRadius = (metrics.borderRadii || []).some(([v]) => String(v).includes('px'))
  if (hasPercentRadius && hasPxRadius) { score -= 5; details.push('Mixing % and px border-radius. Pick one unit') }
  return { category: 'components', score: Math.max(0, score), weight: 10, details }
}

function scoreModernity(metrics) {
  let score = 60
  const details = []
  if (metrics.hasContainerQueries) { score += 15; details.push('Container queries detected — modern responsive approach') }
  if (metrics.customProperties && metrics.customProperties > 20) { score += 15; details.push(`${metrics.customProperties} CSS custom properties — robust design token system`) }
  else if (metrics.customProperties && metrics.customProperties > 10) { score += 8; details.push(`${metrics.customProperties} CSS custom properties`) }
  if (metrics.hasDarkMode) { score += 10; details.push('Dark mode support detected') }
  if (metrics.hasSrcset) { score += 5; details.push('Responsive images (srcset) detected') }
  if ((metrics.gaps || []).length > 0) { score += 5; details.push('CSS gap (flex/grid) in use') }
  const topFont = (metrics.fontFamilies || [])[0]?.[0] || ''
  const legacyFonts = ['Arial', 'Helvetica', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New', 'Times']
  if (legacyFonts.some(f => topFont.includes(f))) { score -= 10; details.push(`Legacy system font: ${topFont}. Consider a modern web font`) }
  return { category: 'modernity', score: Math.max(0, Math.min(100, score)), weight: 10, details }
}

function scoreVibecodedPenalty(metrics, config = {}) {
  // Every anti-pattern lives in engine/signals/ as its own file.
  // The registry runs them all; this function only aggregates + escalates.
  const ctx = { utility: isUtilitySite(metrics), parsePx }
  const { totalPenalty, signalCount, matched } = applySignals(metrics, ctx, config.signals || {})

  let score = 100 - totalPenalty
  const details = matched.map((sig) => sig.detail)

  // Composite escalation: a page tripping many signals at once is a far
  // stronger fingerprint than any single one. Weight-0 signals (soft tells)
  // contribute to signalCount without penalising on their own.
  if (signalCount >= 8) { score -= 20; details.push(`${signalCount} heuristic pattern matches — many common design patterns detected`) }
  else if (signalCount >= 6) { score -= 12; details.push(`${signalCount} heuristic pattern matches — several common design patterns detected`) }
  else if (signalCount >= 4) { score -= 6; details.push(`${signalCount} heuristic pattern matches`) }

  return {
    category: 'originality',
    score: Math.max(0, score),
    weight: 35,
    details,
    signalCount,
    matchedSignals: matched.map((sig) => sig.id),
  }
}

function scoreHTMLQuality(metrics) {
  let score = 100
  const details = []
  if (metrics.overflows && metrics.overflows > 5) { score -= Math.min(25, (metrics.overflows - 5) * 2); details.push(`${metrics.overflows} elements with content overflow`) }
  if (metrics.emojiCount && metrics.emojiCount > 5) { score -= (metrics.emojiCount - 3) * 3; details.push(`${metrics.emojiCount} emoji in visible text. Professional sites use icons`) }
  if (metrics.divRatio && metrics.divRatio > 0.8) { score -= 15; details.push(`${Math.round(metrics.divRatio * 100)}% div/span elements. Div soup`) }
  else if (metrics.divRatio && metrics.divRatio > 0.6) { score -= 5; details.push(`${Math.round(metrics.divRatio * 100)}% div/span elements`) }
  if (metrics.landmarkCount !== undefined && metrics.landmarkCount === 0) { score -= 10; details.push('No landmark elements (nav, main, article). Poor accessibility') }
  if (metrics.h1Count !== undefined) {
    if (metrics.h1Count === 0) { score -= 10; details.push('No h1 tag') }
    else if (metrics.h1Count > 3) { score -= Math.min(15, (metrics.h1Count - 1) * 3); details.push(`${metrics.h1Count} h1 tags. Should be exactly 1`) }
    else if (metrics.h1Count > 1) { score -= 5; details.push(`${metrics.h1Count} h1 tags. Ideally exactly 1`) }
  }
  if (metrics.emptyLinks && metrics.emptyLinks > 0) { score -= metrics.emptyLinks * 5; details.push(`${metrics.emptyLinks} empty/broken links (href="#")`) }
  if (metrics.imagesWithoutAlt && metrics.imagesWithoutAlt > 0) { score -= metrics.imagesWithoutAlt * 3; details.push(`${metrics.imagesWithoutAlt} images without alt text`) }
  if (metrics.hasViewportMeta === false) { score -= 15; details.push('Missing viewport meta tag') }
  if (metrics.hasLangAttr === false) { score -= 5; details.push('Missing lang attribute on html element') }
  if (metrics.metaDescription) {
    const desc = metrics.metaDescription.toLowerCase()
    if (desc.length < 50) { score -= 5; details.push(`Meta description too short (${desc.length} chars). Aim for 120-160`) }
    const aiMeta = ['lovable generated', 'vite + react', 'built with lovable', 'made with bolt', 'v0 by vercel', 'cutting-edge', 'revolutionize', 'transform your business']
    if (aiMeta.some(p => desc.includes(p))) { score -= 15; details.push('Generic auto-generated meta description detected. Consider a more specific description') }
  }
  if (metrics.titleTag) {
    const title = metrics.titleTag.toLowerCase()
    if (title === 'home' || title === 'index' || title.length < 10) { score -= 5; details.push(`Generic page title: "${metrics.titleTag}"`) }
  }
  if (metrics.consoleErrors && metrics.consoleErrors > 0) { score -= Math.min(20, metrics.consoleErrors * 5); details.push(`${metrics.consoleErrors} console errors`) }
  if (metrics.consoleWarnings && metrics.consoleWarnings > 5) { score -= Math.min(10, (metrics.consoleWarnings - 3) * 2); details.push(`${metrics.consoleWarnings} console warnings`) }
  return { category: 'html_quality', score: Math.max(0, score), weight: 15, details }
}

function scoreVisualPolish(metrics) {
  let score = 100
  const details = []
  if (metrics.backdropBlurCount && metrics.backdropBlurCount > 2) { score -= (metrics.backdropBlurCount - 2) * 5; details.push(`${metrics.backdropBlurCount} backdrop-blur elements. Glassmorphism overuse`) }
  if (metrics.animationCount && metrics.animationCount > 20) { score -= Math.min(25, (metrics.animationCount - 15)); details.push(`${metrics.animationCount} animated elements. High animation density`) }
  if (metrics.shadows && metrics.shadows.length > 4) { score -= (metrics.shadows.length - 3) * 3; details.push(`${metrics.shadows.length} unique shadow values. Standardize`) }
  if (metrics.gradientCount && metrics.gradientCount > 3) { score -= (metrics.gradientCount - 2) * 5; details.push(`${metrics.gradientCount} gradient backgrounds. Overuse feels generic`) }
  const palette = analyzePalette(metrics.colors || [])
  if (palette.nearDuplicates.length > 2) { score -= palette.nearDuplicates.length * 3; details.push(`${palette.nearDuplicates.length} perceptually identical color pairs`) }
  if (metrics.maxLineLength && metrics.maxLineLength > 80) { score -= 10; details.push(`Max line length: ${metrics.maxLineLength}ch. Optimal: 45-75ch`) }
  if (metrics.genericTextCount && metrics.genericTextCount > 0) { score -= metrics.genericTextCount * 5; details.push(`${metrics.genericTextCount} generic placeholder phrases detected`) }
  return { category: 'visual_polish', score: Math.max(0, score), weight: 15, details }
}

function scoreSophistication(metrics) {
  let score = 50
  const details = []
  if (metrics.customProperties && metrics.customProperties > 20) { score += 20; details.push(`${metrics.customProperties} CSS custom properties. Robust design token system`) }
  else if (metrics.customProperties && metrics.customProperties > 10) { score += 12; details.push(`${metrics.customProperties} CSS custom properties`) }
  else if (metrics.customProperties && metrics.customProperties > 5) { score += 5; details.push(`${metrics.customProperties} CSS custom properties`) }
  if (metrics.hasDarkMode) { score += 15; details.push('Dark mode support detected') }
  if (metrics.hasContainerQueries) { score += 15; details.push('Container queries detected') }
  if (metrics.hasSrcset) { score += 5; details.push('Responsive images (srcset) detected') }
  const topFont = (metrics.fontFamilies || [])[0]?.[0] || ''
  const defaultGoogleFonts = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway', 'Poppins', 'Nunito']
  const premiumFonts = ['Inter', 'DM Sans', 'Geist', 'Plus Jakarta Sans', 'Manrope', 'Satoshi', 'Outfit', 'Cabinet Grotesk', 'Berkeley Mono', 'JetBrains Mono', 'IBM Plex']
  if (premiumFonts.some(f => topFont.includes(f))) { score += 5; details.push(`Premium typeface: ${topFont}`) }
  else if (defaultGoogleFonts.some(f => topFont.includes(f))) { score -= 5; details.push(`Top-10 Google Font: ${topFont}. Overused`) }
  return { category: 'sophistication', score: Math.min(100, Math.max(0, score)), weight: 15, details }
}

function scoreReadability(metrics) {
  let score = 100
  const details = []
  if (metrics.textOverflows && metrics.textOverflows > 0) { score -= Math.min(30, metrics.textOverflows * 8); details.push(`${metrics.textOverflows} text elements overflow their containers`) }
  if (metrics.lineHeightIssues && metrics.lineHeightIssues > 0) { score -= Math.min(20, metrics.lineHeightIssues * 4); details.push(`${metrics.lineHeightIssues} elements with poor line-height`) }
  if (metrics.letterSpacingAllCaps && metrics.letterSpacingAllCaps > 0) { score -= Math.min(10, metrics.letterSpacingAllCaps * 3); details.push(`${metrics.letterSpacingAllCaps} ALL-CAPS elements without letter-spacing`) }
  const smallFonts = (metrics.fontSizes || []).filter(([v]) => parsePx(v) < 14 && parsePx(v) > 0)
  if (smallFonts.length > 0) {
    const criticalSmall = (metrics.fontSizes || []).filter(([v]) => parsePx(v) < 12)
    if (criticalSmall.length > 0) { score -= 15; details.push(`${criticalSmall.reduce((s, [, c]) => s + c, 0)} elements below 12px`) }
    else if (smallFonts.reduce((s, [, c]) => s + c, 0) > 10) { score -= 10; details.push('Many elements below 14px') }
  }
  if (metrics.lineLengthIssues && metrics.lineLengthIssues > 0) { score -= Math.min(15, metrics.lineLengthIssues * 5); details.push(`${metrics.lineLengthIssues} text blocks exceed 75ch line length`) }
  return { category: 'readability', score: Math.max(0, score), weight: 15, details }
}

function scoreUXPatterns(metrics) {
  let score = 70
  const details = []
  if (metrics.hasViewportMeta) { score += 10; details.push('Viewport meta tag present') }
  else { score -= 20; details.push('Missing <meta name="viewport">') }
  if (metrics.ctaCount !== undefined) {
    if (metrics.ctaCount > 0) { score += 8; details.push(`${metrics.ctaCount} call-to-action button(s)`) }
    else if (metrics.totalElements > 50) { score -= 10; details.push('No clear call-to-action button found') }
  }
  if (metrics.navItemCount !== undefined) {
    if (metrics.navItemCount >= 2 && metrics.navItemCount <= 7) { score += 5; details.push(`Navigation has ${metrics.navItemCount} items`) }
    else if (metrics.navItemCount > 8) { score -= Math.min(15, (metrics.navItemCount - 7) * 3); details.push(`${metrics.navItemCount} navigation items — cognitive overload`) }
  }
  if (metrics.imagesWithoutAlt !== undefined) {
    if (metrics.imagesWithoutAlt > 0) { score -= Math.min(15, metrics.imagesWithoutAlt * 5); details.push(`${metrics.imagesWithoutAlt} images missing alt text`) }
    else { score += 5; details.push('All images have alt text') }
  }
  if (metrics.consoleErrors && metrics.consoleErrors > 0) { score -= Math.min(15, metrics.consoleErrors * 5); details.push(`${metrics.consoleErrors} console error(s) on load`) }
  return { category: 'ux_patterns', score: Math.max(0, Math.min(100, score)), weight: 10, details }
}

function scoreContentDepth(metrics) {
  let score = 100
  const details = []
  if (metrics.totalElements < 80) { score -= 30; details.push(`Very sparse page (${metrics.totalElements} elements)`) }
  else if (metrics.totalElements < 120) { score -= 15; details.push(`Low element count (${metrics.totalElements})`) }
  else if (metrics.totalElements > 200) { score += 10; details.push(`Substantial content depth (${metrics.totalElements} elements)`) }
  if (metrics.divRatio && metrics.divRatio > 0.7) { score -= 10; details.push(`${Math.round(metrics.divRatio * 100)}% div/span ratio. Div soup`) }
  if (metrics.landmarkCount !== undefined && metrics.landmarkCount < 3) { score -= 20; details.push(`Only ${metrics.landmarkCount} semantic landmark elements`) }
  return { category: 'contentDepth', score: Math.max(0, Math.min(100, score)), weight: 25, details }
}

// ── Entropy metrics ───────────────────────────────────────────────────────────

export function computeEntropyMetrics(m) {
  const fontSizesClustered = clusterValues(m.fontSizes ?? [], 2)
  const spacings = [...(m.paddings ?? []), ...(m.gaps ?? [])]
  const spacingsClustered = clusterValues(spacings, 1)

  const typographyEntropy = normalizedEntropy(fontSizesClustered)
  const colorEntropy = normalizedEntropy((m.colors ?? []).slice(0, 20))
  const spacingEntropy = normalizedEntropy(spacingsClustered)
  const borderRadiusEntropy = normalizedEntropy(m.borderRadii ?? [])
  const overallDesignEntropy = typographyEntropy * 0.35 + spacingEntropy * 0.35 + colorEntropy * 0.20 + borderRadiusEntropy * 0.10

  const pxSpacings = spacings.map(([v]) => parseFloat(v)).filter(v => !isNaN(v) && v > 0)
  const onGrid = pxSpacings.filter(v => v % 4 === 0 || v % 8 === 0).length
  const spacingGridAdherence = pxSpacings.length > 0 ? onGrid / pxSpacings.length : 1

  const dominant = [...(m.fontSizes ?? [])].sort((a, b) => b[1] - a[1])[0]
  const allColors = (m.colors ?? []).filter(([c]) => c.includes('rgb') && !c.includes('rgba(0'))
  const sortedColors = [...allColors].sort((a, b) => b[1] - a[1])

  const detectPageBackground = () => {
    const candidate = sortedColors[0]?.[0] ?? 'rgb(255,255,255)'
    const [r, g, b] = parseRGB(candidate)
    const lum = 0.2126 * (r/255) + 0.7152 * (g/255) + 0.0722 * (b/255)
    if (lum > 0.8) return candidate
    const light = sortedColors.find(([c]) => { const [r2, g2, b2] = parseRGB(c); return (r2 + g2 + b2) > 600 })?.[0]
    return light ?? candidate
  }

  const detectPageForeground = (bg) => {
    const [rb, gb, bb] = parseRGB(bg)
    const bgLum = 0.2126 * (rb/255) + 0.7152 * (gb/255) + 0.0722 * (bb/255)
    if (bgLum < 0.3) {
      return sortedColors.find(([c]) => { const [r2, g2, b2] = parseRGB(c); return (r2 + g2 + b2) > 550 })?.[0] ?? 'rgb(255,255,255)'
    }
    return sortedColors.find(([c]) => { const [r2, g2, b2] = parseRGB(c); return (r2 + g2 + b2) < 300 })?.[0] ?? 'rgb(0,0,0)'
  }

  const topBg = detectPageBackground()
  const topFg = detectPageForeground(topBg)
  const lc = apcaContrast(topFg, topBg)
  const dominantFontPx = parseFloat(dominant?.[0] ?? '16')
  const apcaContrastRisk = lc < 45 ? 'critical' : (lc < 60 && dominantFontPx < 16 ? 'low' : 'none')

  const gj = gridJitter([...(m.paddings ?? []), ...(m.gaps ?? [])])
  const nsp = nonStandardSizePenalty(m.fontSizes ?? [])
  const cv = contrastVariance(m.colors ?? [], topBg)
  const spacingGritScore = Math.round((spacingGridAdherence * 0.5 + (1 - gj) * 0.5) * 100) / 100

  return {
    typographyEntropy: Math.round(typographyEntropy * 100) / 100,
    colorEntropy: Math.round(colorEntropy * 100) / 100,
    spacingEntropy: Math.round(spacingEntropy * 100) / 100,
    borderRadiusEntropy: Math.round(borderRadiusEntropy * 100) / 100,
    overallDesignEntropy: Math.round(overallDesignEntropy * 100) / 100,
    dominantFontSize: dominant?.[0] ?? 'unknown',
    uniqueFontSizes: fontSizesClustered.length,
    uniqueColors: (m.colors ?? []).length,
    uniqueSpacings: spacingsClustered.length,
    spacingGridAdherence: Math.round(spacingGridAdherence * 100) / 100,
    apcaLcScore: Math.round(lc * 10) / 10,
    apcaContrastRisk,
    gridJitter: Math.round(gj * 100) / 100,
    nonStandardSizePenalty: Math.round(nsp * 100) / 100,
    contrastVariance: Math.round(cv * 100) / 100,
    spacingGritScore,
  }
}

// ── Component grouping for CI thresholds ─────────────────────────────────────

/**
 * Groups raw breakdown scores into three named components:
 *   css_health       — Typography + Spacing + Color + Components
 *                      (CSS/DOM measurables, no subjective judgment)
 *   visual_quality   — Modernity + Visual Polish + Sophistication + Readability
 *                      (design craft signals)
 *   structure        — HTML Quality + UX Patterns + Content Depth
 *                      (semantic/accessibility/content)
 *
 * Returned alongside the raw breakdown so callers can choose either level.
 */
export function groupComponents(breakdown, metrics) {
  const get = (cat) => breakdown.find(b => b.category === cat)?.score ?? 0

  const cssHealth = Math.round(
    (get('typography') * 0.3 + get('spacing') * 0.3 + get('color') * 0.3 + get('components') * 0.1)
  )
  const visualQuality = Math.round(
    (get('modernity') * 0.25 + get('visual_polish') * 0.35 + get('sophistication') * 0.25 + get('readability') * 0.15)
  )
  const structure = Math.round(
    (get('html_quality') * 0.4 + get('ux_patterns') * 0.35 + get('contentDepth') * 0.25)
  )

  // Raw DOM counts for threshold enforcement
  const rawCounts = {
    unique_colors: (metrics.colors ?? []).length,
    unique_font_families: (metrics.fontFamilies ?? []).length,
    unique_font_sizes: (metrics.fontSizes ?? []).length,
    unique_border_radii: (metrics.borderRadii ?? []).length,
    total_elements: metrics.totalElements ?? 0,
    dom_depth_proxy: metrics.totalElements ? Math.round(Math.log2(metrics.totalElements + 1)) : 0,
    custom_properties: metrics.customProperties ?? 0,
    has_dark_mode: !!metrics.hasDarkMode,
    spacing_on_grid_pct: (() => {
      const all = [...(metrics.paddings ?? []), ...(metrics.gaps ?? [])]
      const px = all.map(([v]) => parseFloat(v)).filter(v => !isNaN(v) && v > 0)
      if (px.length === 0) return 100
      return Math.round(px.filter(v => v % 4 === 0).length / px.length * 100)
    })(),
  }

  return {
    css_health: { score: cssHealth, ...rawCounts },
    visual_quality: { score: visualQuality },
    structure: { score: structure },
    originality: { score: get('originality') },
  }
}

// ── Main scoring entry point ──────────────────────────────────────────────────

/** Map an overall 0–100 score to a letter grade. */
export function gradeForScore(overall) {
  if (overall >= 88) return 'A+'
  if (overall >= 82) return 'A'
  if (overall >= 76) return 'A-'
  if (overall >= 70) return 'B+'
  if (overall >= 64) return 'B'
  if (overall >= 58) return 'B-'
  if (overall >= 52) return 'C+'
  if (overall >= 46) return 'C'
  if (overall >= 40) return 'C-'
  if (overall >= 30) return 'D'
  return 'F'
}

export function scoreDOMMetrics(metrics, config = {}) {
  const breakdowns = [
    scoreSpacing(metrics),
    scoreTypography(metrics),
    scoreColor(metrics),
    scoreComponents(metrics),
    scoreModernity(metrics),
    scoreVibecodedPenalty(metrics, config),
    scoreHTMLQuality(metrics),
    scoreVisualPolish(metrics),
    scoreSophistication(metrics),
    scoreReadability(metrics),
    scoreUXPatterns(metrics),
    scoreContentDepth(metrics),
  ]

  const totalWeight = breakdowns.reduce((s, b) => s + b.weight, 0)
  const weightedScore = breakdowns.reduce((s, b) => s + b.score * b.weight, 0) / totalWeight
  let overall = Math.round(weightedScore)

  const originalityScore = breakdowns.find(b => b.category === 'originality')?.score ?? 100
  if (originalityScore < 45) overall = Math.min(overall, 60)
  else if (originalityScore < 60) overall = Math.min(overall, 70)
  else if (originalityScore < 70) overall = Math.min(overall, 78)

  const grade = gradeForScore(overall)

  const recommendations = breakdowns
    .flatMap(b => b.details.filter(d =>
      d.includes('limit') || d.includes('Consider') || d.includes('Replace') ||
      d.includes('Consolidate') || d.includes('Standardize') || d.includes('Use ') ||
      d.includes('Target')
    ))
    .slice(0, 5)

  return { overall, grade, breakdown: breakdowns, recommendations }
}
