// Oversized hero text on a near-empty page.
// 48px+ headline with very few elements: a big claim and nothing behind it.

export default {
  id: 'oversized-hero',
  label: 'Oversized hero, thin page',
  penalty: 10,
  weight: 1,
  rationale:
    'A 48px+ headline on a page with under ~100 elements is the classic ' +
    'big-promise-no-substance generated landing page.',

  test(m, ctx) {
    const sizes = (m.fontSizes || []).map(([v]) => ctx.parsePx(v)).filter((v) => !isNaN(v))
    if (sizes.length === 0) return null
    const maxSize = Math.max(...sizes)
    if (maxSize >= 48 && (m.totalElements || 0) < 100) {
      return { detail: `Oversized hero text (${maxSize}px) on a sparse page` }
    }
    return null
  },
}
