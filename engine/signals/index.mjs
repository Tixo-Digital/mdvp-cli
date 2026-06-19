// Signal registry.
//
// Each import below is one anti-pattern detector from this directory.
// To add a signal: create a file, import it here, add it to SIGNALS.
// See README.md for the signal shape.

import interFont from './inter-font.mjs'
import tailwindPalette from './tailwind-palette.mjs'
import tailwindSpacing from './tailwind-spacing.mjs'
import pillRadius from './pill-radius.mjs'
import systemFontOnly from './system-font-only.mjs'
import sparseContent from './sparse-content.mjs'
import oversizedHero from './oversized-hero.mjs'
import noDesignTokens from './no-design-tokens.mjs'
import monochromeNoAccent from './monochrome-no-accent.mjs'
import pulseAnimation from './pulse-animation.mjs'
import eyebrowChip from './eyebrow-chip.mjs'
import statusDot from './status-dot.mjs'
import gradientText from './gradient-text.mjs'
import gradientBackground from './gradient-background.mjs'
import emojiIcons from './emoji-icons.mjs'
import genericMarketingCopy from './generic-marketing-copy.mjs'

/** All registered signals, in declaration order. */
export const SIGNALS = [
  interFont,
  tailwindPalette,
  tailwindSpacing,
  pillRadius,
  systemFontOnly,
  sparseContent,
  oversizedHero,
  noDesignTokens,
  monochromeNoAccent,
  pulseAnimation,
  eyebrowChip,
  statusDot,
  gradientText,
  gradientBackground,
  emojiIcons,
  genericMarketingCopy,
]

/**
 * Run every enabled signal against the metrics.
 *
 * @param {object} metrics  DOM metrics from extract.js
 * @param {object} [ctx]    { utility: boolean, parsePx: (v)=>number }
 * @param {object} [config] { disabled?: string[], penalties?: Record<string,number> }
 * @returns {{ totalPenalty: number, signalCount: number, matched: Array<{id,label,penalty,detail}> }}
 */
export function applySignals(metrics, ctx = {}, config = {}) {
  const disabled = new Set(config.disabled || [])
  const overrides = config.penalties || {}

  let totalPenalty = 0
  let signalCount = 0
  const matched = []

  for (const sig of SIGNALS) {
    if (disabled.has(sig.id)) continue

    let result
    try {
      result = sig.test(metrics, ctx)
    } catch {
      result = null // a misbehaving signal must never break scoring
    }
    if (!result) continue

    const penalty = overrides[sig.id] ?? result.penalty ?? sig.penalty
    totalPenalty += penalty
    signalCount += sig.weight ?? 1
    matched.push({ id: sig.id, label: sig.label, penalty, detail: result.detail })
  }

  return { totalPenalty, signalCount, matched }
}
