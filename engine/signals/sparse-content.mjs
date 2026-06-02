// Very few rendered elements — placeholder / unfinished page.
// AI generators happily ship a hero, three feature cards, and a footer with
// almost no real content. Element count is a blunt but reliable proxy.

export default {
  id: 'sparse-content',
  label: 'Sparse / placeholder content',
  penalty: 20,
  weight: 2,
  rationale:
    'A page with very few elements is usually a placeholder: hero plus a ' +
    'couple of cards, no real content depth.',

  test(m) {
    const n = m.totalElements || 0
    const fewFonts = (m.fontFamilies || []).length <= 2
    if (n < 60) return { detail: `Very sparse page (${n} elements)`, penalty: 25 }
    if (n < 100) return { detail: `Sparse page (${n} elements)`, penalty: 15 }
    if (n < 150 && fewFonts) {
      return { detail: 'Sparse page with minimal font variety', penalty: 10 }
    }
    return null
  },
}
