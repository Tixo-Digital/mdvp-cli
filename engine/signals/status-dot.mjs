// Colored status dots — tiny circles (often green) used as "online" / "live"
// indicators. One is fine. A scattering of green/amber/red dots is decoration
// cosplaying as system status.

export default {
  id: 'status-dot',
  label: 'Decorative status dots',
  penalty: 6,
  weight: 1,
  rationale:
    'Small colored circles (especially green "online" dots) used decoratively ' +
    'imply live system state that usually is not there.',

  test(m) {
    const n = m.statusDotCount ?? 0
    if (n > 2) return { detail: `${n} colored status dots used as decoration` }
    return null
  },
}
