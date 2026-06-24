// Glassmorphism overuse - repeated frosted-glass surfaces.
// One translucent nav or modal can be intentional. Several backdrop-blurred
// cards/panels usually means decorative "glass" styling replaced hierarchy.

export default {
  id: 'glassmorphism-overuse',
  label: 'Glassmorphism overuse',
  penalty: 12,
  weight: 1,
  rationale:
    'Repeated backdrop-blurred surfaces are a common generated-UI flourish. ' +
    'Use glass sparingly where depth or modal layering has a clear purpose.',

  test(m) {
    const n = m.backdropBlurCount ?? 0
    if (n >= 6) return { detail: `${n} backdrop-blurred surfaces` }
    if (n >= 3) {
      return {
        detail: `${n} backdrop-blurred surfaces`,
        penalty: 6,
      }
    }
    return null
  },
}
