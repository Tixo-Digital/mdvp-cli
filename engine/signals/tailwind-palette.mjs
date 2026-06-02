// The default Tailwind purple-pink-blue accent palette.
// blue-500, indigo-500, violet-500, purple-500, pink-500 and their neighbours
// show up together when someone uses Tailwind's defaults without a brand palette.

const TAILWIND_ACCENTS = [
  'rgb(59, 130, 246)', 'rgb(37, 99, 235)', 'rgb(96, 165, 250)',
  'rgb(99, 102, 241)', 'rgb(79, 70, 229)', 'rgb(139, 92, 246)',
  'rgb(168, 85, 247)', 'rgb(147, 51, 234)', 'rgb(236, 72, 153)',
  'rgb(219, 39, 119)', 'rgb(244, 114, 182)', 'rgb(137, 110, 247)',
].map((c) => c.replace(/\s/g, ''))

export default {
  id: 'tailwind-palette',
  label: 'Default Tailwind accent palette',
  penalty: 15,
  weight: 1,
  rationale:
    'The purple-pink-blue Tailwind default palette is the most common ' +
    'symptom of a UI assembled from generator defaults.',

  test(m) {
    const matched = (m.colors || []).filter(([c]) =>
      TAILWIND_ACCENTS.some((tw) => c.replace(/\s/g, '').includes(tw)),
    )
    if (matched.length >= 2) {
      return { detail: `${matched.length} Tailwind purple-pink-blue accents — generator-default palette` }
    }
    if (matched.length === 1) {
      return { detail: 'Default Tailwind accent color detected', penalty: 5 }
    }
    return null
  },
}
