// Almost no CSS custom properties.
// A real design system defines tokens (--color-*, --space-*, --radius-*).
// Under ~5 custom properties means values are hardcoded throughout.

export default {
  id: 'no-design-tokens',
  label: 'No design token system',
  penalty: 8,
  weight: 1,
  rationale:
    'Fewer than ~5 CSS custom properties means colors and spacing are ' +
    'hardcoded inline rather than driven by design tokens.',

  test(m) {
    const props = m.customProperties ?? 0
    if (props < 5) return { detail: `Only ${props} CSS custom properties — no design token system` }
    return null
  },
}
