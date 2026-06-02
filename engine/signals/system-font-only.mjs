// System font stack only, with no more than two families.
// No custom typeface was loaded at all — common in quick generated pages.
// Relaxed for utility sites (dashboards, tools) where system fonts are a valid choice.

const SYSTEM_FONTS = ['-apple-system', 'system-ui', 'ui-sans-serif', 'Segoe UI', 'Helvetica Neue', 'Arial']

export default {
  id: 'system-font-only',
  label: 'System font stack only',
  penalty: 10,
  weight: 1,
  rationale:
    'A landing page with only the system font stack made no typographic ' +
    'choice. Utility apps are exempt — system fonts are reasonable there.',

  test(m, ctx) {
    if (ctx.utility) return null
    const families = m.fontFamilies || []
    if (families.length > 2) return null
    const top = families[0]?.[0] || ''
    if (SYSTEM_FONTS.some((f) => top.includes(f))) {
      return { detail: `System font stack only (${top}), no custom typeface` }
    }
    return null
  },
}
