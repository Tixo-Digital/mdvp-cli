# Signals

Each file in this directory is **one anti-pattern detector**. A signal looks at the
DOM metrics extracted by [`../extract.js`](../extract.js) and decides whether a page
matches a known AI-generated / low-craft pattern (Inter as the only font, pill buttons,
pulsing status dots, an "eyebrow" chip above the H1, etc.).

The `originality` score starts at 100 and every matched signal subtracts its penalty.

## Adding a signal

1. Create `my-signal.mjs` in this directory.
2. Export a default object (see shape below).
3. Add one import + array entry in [`index.mjs`](index.mjs).

That's it. `npm test` will pick it up.

## Signal shape

```js
// engine/signals/pulse-animation.mjs
export default {
  id: 'pulse-animation',          // kebab-case, must equal the filename
  label: 'Pulsing UI elements',   // short human name, shown in reports
  penalty: 12,                    // points removed from originality (0–100)
  weight: 1,                      // contribution to the composite "how many signals" count
  rationale:
    'Gratuitous pulse/ping animations on dots and badges are a hallmark of ' +
    'AI-generated UIs and add motion noise without information.',

  /**
   * @param {object} m   DOM metrics (see ../extract.js return value)
   * @param {object} ctx { utility: boolean, parsePx: (v)=>number }
   * @returns {{ detail: string, penalty?: number } | null}
   *          Return null when the page does NOT match.
   *          `detail` is shown to the user. `penalty` optionally overrides the default.
   */
  test(m, ctx) {
    const n = m.pulseAnimationCount ?? 0
    if (n > 2) return { detail: `${n} pulsing elements (animate-pulse / @keyframes pulse)` }
    return null
  },
}
```

## Rules

- **Pure function.** `test()` must not touch the network, filesystem, or globals.
- **Null when unsure.** A signal that fires on legitimate design is worse than one that
  misses. Prefer false negatives over false positives.
- **One pattern per file.** If you're checking two unrelated things, write two signals.
- **`weight: 0`** for soft detectors that shouldn't penalise on their own but should
  count toward the composite "too many signals" escalation.

## Configuration

Any signal can be disabled or re-weighted per project via `.mdvprc`:

```json
{
  "signals": {
    "disabled": ["status-dot", "monochrome-no-accent"],
    "penalties": { "inter-font": 5, "pill-radius": 20 }
  }
}
```

This lets a team say "we use Inter on purpose, don't penalise it" or "pills are banned
here, penalise them hard" without forking the engine.
