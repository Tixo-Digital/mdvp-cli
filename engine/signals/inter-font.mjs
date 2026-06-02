// Inter / Poppins / Nunito / Outfit as the primary font.
// These are the default typefaces shipped by v0, Lovable, Bolt, and most
// Tailwind UI templates — a strong tell that no typographic decision was made.

const AI_FONTS = ['Inter', 'Poppins', 'Nunito', 'Nunito Sans', 'Outfit']

export default {
  id: 'inter-font',
  label: 'Default AI vibe-coding font',
  penalty: 15,
  weight: 2,
  rationale:
    'Inter/Poppins/Nunito/Outfit are the default fonts in AI UI generators. ' +
    'A deliberate brand picks a typeface with personality.',

  test(m) {
    const top = (m.fontFamilies || [])[0]?.[0] || ''
    if (AI_FONTS.some((f) => top.includes(f))) {
      return { detail: `${top} — default AI vibe-coding font, no typographic personality` }
    }
    return null
  },
}
