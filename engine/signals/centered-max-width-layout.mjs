// Repeated centered max-width page shells.
// Common generated landing pages stack every section inside the same
// `max-w-* mx-auto` wrapper, creating a narrow stripe instead of composed
// full-width bands, asymmetry, or layout variation.

export default {
  id: 'centered-max-width-layout',
  label: 'Centered max-width-only layout',
  penalty: 8,
  weight: 1,
  rationale:
    'Pages made from repeated centered max-width shells often feel generated: ' +
    'every section uses the same narrow wrapper instead of a deliberate layout system.',

  test(m, ctx = {}) {
    if (ctx.utility) return null

    const n = m.centeredMaxWidthContainerCount || 0
    if (n >= 7) {
      return { detail: `${n} repeated centered max-width layout containers`, penalty: 12 }
    }
    if (n >= 4) {
      return { detail: `${n} repeated centered max-width layout containers` }
    }
    return null
  },
}
