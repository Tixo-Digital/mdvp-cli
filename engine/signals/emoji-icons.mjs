// Emoji used as iconography in visible text.
// Generated UIs reach for 🚀 ⚡ ✨ 🎉 instead of an icon set. A handful in
// content is fine; a sprinkle across the UI reads as unfinished.

export default {
  id: 'emoji-icons',
  label: 'Emoji as icons',
  penalty: 8,
  weight: 1,
  rationale:
    'Emoji standing in for an icon system (🚀 ⚡ ✨) is a quick-generation tell. ' +
    'Considered design uses a consistent icon set.',

  test(m) {
    const n = m.emojiCount ?? 0
    if (n > 5) return { detail: `${n} emoji in visible UI text — use an icon set` }
    return null
  },
}
