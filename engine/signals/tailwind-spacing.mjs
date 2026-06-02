// Padding values that almost entirely match Tailwind's default spacing scale,
// on a page with few elements. Indicates layout built from utility classes
// without a custom spacing system.

const TAILWIND_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]

export default {
  id: 'tailwind-spacing',
  label: 'Default Tailwind spacing scale',
  penalty: 12,
  weight: 1,
  rationale:
    'When > 85% of padding values land exactly on Tailwind\'s default scale ' +
    'and the page is small, the layout is generator-default rather than designed.',

  test(m, ctx) {
    const px = (m.paddings || [])
      .map(([v]) => ctx.parsePx(v))
      .filter((v) => !isNaN(v) && v > 0)
    if (px.length < 4) return null
    if ((m.totalElements || 0) >= 200) return null

    const onScale = px.filter((v) => TAILWIND_SCALE.includes(v))
    const ratio = onScale.length / px.length
    if (ratio > 0.85) {
      return { detail: `Tailwind default spacing scale (${Math.round(ratio * 100)}% match)` }
    }
    return null
  },
}
