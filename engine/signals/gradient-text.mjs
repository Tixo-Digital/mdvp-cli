// Gradient text — background-clip: text with a gradient fill.
// The purple-to-pink gradient headline is a defining vibe-code aesthetic.
// Detected in extract.js via transparent text fill + gradient background.

export default {
  id: 'gradient-text',
  label: 'Gradient clip text',
  penalty: 8,
  weight: 1,
  rationale:
    'Gradient-filled headlines (background-clip: text) are the signature ' +
    'flourish of generated landing pages. Rarely a deliberate brand choice.',

  test(m) {
    const n = m.gradientTextCount ?? 0
    if (n > 1) return { detail: `${n} gradient-filled text elements (background-clip: text)` }
    if (n === 1) return { detail: 'Gradient-filled headline', penalty: 4 }
    return null
  },
}
