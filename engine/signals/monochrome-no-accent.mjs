// Monochrome palette with no accent color.
// Every color is near-gray (R≈G≈B) and there are few of them. Often a
// half-finished theme that never got a brand color.

export default {
  id: 'monochrome-no-accent',
  label: 'Monochrome, no accent',
  penalty: 5,
  weight: 0, // soft: counts toward composite but does not penalise alone elsewhere
  rationale:
    'A palette of only near-grays with no accent reads as an unfinished theme. ' +
    'Weight 0: contributes to the composite count but is a weak signal alone.',

  test(m) {
    const colors = m.colors || []
    if (colors.length === 0 || colors.length > 5) return null
    const allGray = colors.every(([c]) => {
      const nums = c.match(/\d+/g)
      if (!nums || nums.length < 3) return true
      const [r, g, b] = nums.map(Number)
      return Math.abs(r - g) < 20 && Math.abs(g - b) < 20
    })
    if (allGray) return { detail: 'Monochrome palette with no accent color' }
    return null
  },
}
