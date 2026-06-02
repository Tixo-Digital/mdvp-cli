// "Eyebrow" chip — a small pill/badge directly above the H1 in a hero section.
// "✨ Now in beta", "Introducing…", "New" — the generator hero cliché.
// Detected in extract.js: a small, short, badge-styled element preceding the first H1.

export default {
  id: 'eyebrow-chip',
  label: 'Hero eyebrow chip',
  penalty: 8,
  weight: 1,
  rationale:
    'A small badge/pill above the H1 ("Introducing…", "Now in beta") is the ' +
    'generated-hero cliché. A confident hero is headline + subhead + CTA.',

  test(m) {
    const n = m.eyebrowCount ?? 0
    if (n > 0) return { detail: 'Eyebrow chip above the H1 — generated-hero cliché' }
    return null
  },
}
