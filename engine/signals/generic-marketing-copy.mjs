// Repeated generic marketing copy in visible text.
// A single "get started" CTA can be legitimate; repeated phrases such as
// "revolutionize" or "next-generation" across a sparse page are a generation tell.

export default {
  id: 'generic-marketing-copy',
  label: 'Generic marketing copy',
  penalty: 10,
  weight: 1,
  rationale:
    'Repeated broad marketing phrases make a page feel assembled from defaults ' +
    'instead of written for a specific product, audience, or workflow.',

  test(m) {
    const n = m.genericTextCount ?? 0
    if (n >= 4) return { detail: `${n} generic marketing phrases in visible text`, penalty: 15 }
    if (n >= 2) return { detail: `${n} generic marketing phrases in visible text` }
    return null
  },
}
