// Uniform button styling with no visible hierarchy.
// Generated pages often render every CTA, secondary action, and form button with
// the same filled treatment. Several textual controls sharing one signature
// usually means primary/secondary hierarchy was never designed.

export default {
  id: 'uniform-button-style',
  label: 'Uniform button styling',
  penalty: 8,
  weight: 1,
  rationale:
    'Multiple text-bearing buttons sharing the same visual treatment makes ' +
    'primary and secondary actions hard to distinguish. Designed flows show a clear hierarchy.',

  test(m) {
    const count = m.styledButtonCount ?? 0
    const variants = m.buttonStyleVariantCount ?? 0
    const dominant = m.dominantButtonStyleCount ?? 0
    const share = m.dominantButtonStyleShare ?? (count > 0 ? dominant / count : 0)

    if (count >= 5 && variants <= 2 && dominant >= 4 && share >= 0.8) {
      return {
        detail: `${dominant} of ${count} button-like controls share one visual style`,
      }
    }

    if (count >= 3 && variants === 1) {
      return {
        detail: `${count} button-like controls use one visual style`,
        penalty: 5,
      }
    }

    return null
  },
}
