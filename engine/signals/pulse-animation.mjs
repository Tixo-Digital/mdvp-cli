// Pulsing / pinging UI elements.
// animate-pulse, animate-ping, and @keyframes pulse get sprinkled onto dots,
// badges, and "live" indicators by AI generators. Motion without information.

export default {
  id: 'pulse-animation',
  label: 'Pulsing UI elements',
  penalty: 12,
  weight: 1,
  rationale:
    'Gratuitous pulse/ping animations on dots and badges add motion noise ' +
    'without conveying anything. A hallmark of generated "alive" UIs.',

  test(m) {
    const n = m.pulseAnimationCount ?? 0
    if (n > 2) return { detail: `${n} pulsing elements (animate-pulse / @keyframes pulse)` }
    if (n > 0) return { detail: `${n} pulsing element${n > 1 ? 's' : ''}`, penalty: 5 }
    return null
  },
}
