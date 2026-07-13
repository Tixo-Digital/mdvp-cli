// Repeated generic CTA/button labels.
// A single "Get started" can be fine. Several generic action labels on the
// same page usually means the flow has placeholder copy instead of task-specific
// action hierarchy.

export default {
  id: 'generic-cta-copy',
  label: 'Generic CTA copy',
  penalty: 7,
  weight: 1,
  rationale:
    'Repeated generic CTA labels make actions feel interchangeable. Designed flows use ' +
    'specific button copy that tells users what happens next.',

  test(m) {
    const n = m.genericButtonTexts ?? 0
    if (n >= 4) {
      return {
        detail: `${n} generic CTA labels in button-like controls`,
        penalty: 12,
      }
    }
    if (n >= 2) {
      return { detail: `${n} generic CTA labels in button-like controls` }
    }
    return null
  },
}
