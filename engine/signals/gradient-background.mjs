// Excessive gradient backgrounds - repeated or layered gradient surfaces.
// A single brand gradient can be intentional. Multiple gradient panels or a
// radial-gradient mesh background are a common generated-landing-page flourish.
// extract.js excludes background-clip:text so this signal does not double-count
// gradient headlines.

export default {
  id: 'gradient-background',
  label: 'Excessive gradient backgrounds',
  penalty: 12,
  weight: 1,
  rationale:
    'Repeated gradient surfaces and mesh-gradient backgrounds often replace a ' +
    'real art direction with generator-default decoration.',

  test(m) {
    const surfaces = m.gradientBackgroundCount ?? 0
    const layers = m.gradientBackgroundLayerCount ?? surfaces

    if (surfaces >= 4 || layers >= 6) {
      return { detail: `${surfaces} gradient backgrounds with ${layers} gradient layers` }
    }
    if (surfaces >= 2 || layers >= 3) {
      return {
        detail: `${surfaces} gradient backgrounds with ${layers} gradient layers`,
        penalty: 6,
      }
    }
    return null
  },
}
