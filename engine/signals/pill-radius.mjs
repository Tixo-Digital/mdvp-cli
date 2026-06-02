// border-radius: 9999px on many elements — the Shadcn/Tailwind "pill" default.
// A few pills are fine (chips, avatars). Pills everywhere means every button,
// badge, and card inherited the same default rounding.

export default {
  id: 'pill-radius',
  label: 'Pill-shaped everything',
  penalty: 12,
  weight: 1,
  rationale:
    'border-radius: 9999px on many elements is the Shadcn/Tailwind button ' +
    'default. Real component systems use a deliberate radius scale.',

  test(m) {
    const pill = (m.borderRadii || []).find(([v]) => v === '9999px' || v === '999px')
    const count = pill ? pill[1] : 0
    if (count > 8) {
      return { detail: `${count} pill-shaped elements (border-radius: 9999px)` }
    }
    if (count > 3) {
      return { detail: `${count} pill-shaped elements`, penalty: 5 }
    }
    return null
  },
}
