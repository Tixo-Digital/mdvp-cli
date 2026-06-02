// Inter / Poppins / Nunito / Outfit as the primary font.
// These are common default typefaces shipped by many UI kits and AI tools —
// often a sign that no deliberate typographic decision was made.

const GENERIC_FONTS = ['Inter', 'Poppins', 'Nunito', 'Nunito Sans', 'Outfit']

export default {
  id: 'inter-font',
  label: 'Generic default font as primary typeface',
  penalty: 15,
  weight: 2,
  rationale:
    'Inter/Poppins/Nunito/Outfit are common defaults. A deliberate brand ' +
    'usually picks a typeface with more personality.',

  test(m) {
    const top = (m.fontFamilies || [])[0]?.[0] || ''
    if (GENERIC_FONTS.some((f) => top.includes(f))) {
      return { detail: `${top} — generic default font, no typographic personality` }
    }
    return null
  },
}
