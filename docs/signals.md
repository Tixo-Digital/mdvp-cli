# Signal catalog

MDVP signals are deterministic heuristics for common generated-UI and low-craft patterns. They do not judge taste. They look at rendered DOM metrics from [`engine/extract.js`](../engine/extract.js), return a match only when a pattern is visible in the extracted evidence, and subtract from the `originality` component.

Each detector lives in one file under [`engine/signals/`](../engine/signals/). The registry is [`engine/signals/index.mjs`](../engine/signals/index.mjs).

## How signals work

1. The browser crawler renders the page and extracts computed styles, text counts, element counts, color usage, spacing, typography, animation, and related metrics.
2. Each enabled signal receives those metrics and either returns `null` or a match with a short detail string.
3. Matched signals subtract their configured penalty from originality. Project config can disable signals or override penalties in `.mdvprc`.
4. The final audit reports the matched signal details so a user can decide whether the finding is relevant for their product.

Signals should prefer false negatives over noisy false positives. A detector that fires on legitimate design weakens trust in every score.

## Current detectors

| Signal | File | Detects | Evidence surface | Likely remediation |
|---|---|---|---|---|
| `inter-font` | [`engine/signals/inter-font.mjs`](../engine/signals/inter-font.mjs) | Inter, Poppins, Nunito, Nunito Sans, or Outfit as the primary typeface | Top rendered font family | Pick a deliberate type system or document why the default is intentional |
| `tailwind-palette` | [`engine/signals/tailwind-palette.mjs`](../engine/signals/tailwind-palette.mjs) | Tailwind default blue, indigo, violet, purple, pink accent colors | Rendered CSS color list | Replace utility defaults with brand tokens or a smaller intentional palette |
| `tailwind-spacing` | [`engine/signals/tailwind-spacing.mjs`](../engine/signals/tailwind-spacing.mjs) | Small pages whose padding values mostly match Tailwind's default spacing scale | Rendered padding values plus element count | Define a spacing rhythm for the product instead of accepting generator defaults |
| `pill-radius` | [`engine/signals/pill-radius.mjs`](../engine/signals/pill-radius.mjs) | Many `9999px` or `999px` rounded elements | Rendered border radius counts | Use a radius scale and reserve pills for chips, avatars, or deliberate controls |
| `system-font-only` | [`engine/signals/system-font-only.mjs`](../engine/signals/system-font-only.mjs) | Landing pages using only the system font stack | Font-family counts and utility-page context | Add a product typeface, or disable this signal for utility apps where system fonts are correct |
| `sparse-content` | [`engine/signals/sparse-content.mjs`](../engine/signals/sparse-content.mjs) | Thin placeholder pages | Rendered element count and font variety | Add real content depth, examples, states, and workflow detail |
| `oversized-hero` | [`engine/signals/oversized-hero.mjs`](../engine/signals/oversized-hero.mjs) | Very large hero text on a sparse page | Maximum font size plus element count | Balance headline scale with supporting product evidence and page substance |
| `no-design-tokens` | [`engine/signals/no-design-tokens.mjs`](../engine/signals/no-design-tokens.mjs) | Few CSS custom properties | Custom-property count | Introduce semantic tokens for color, spacing, radius, and typography |
| `monochrome-no-accent` | [`engine/signals/monochrome-no-accent.mjs`](../engine/signals/monochrome-no-accent.mjs) | All-gray palettes with no accent | Rendered color list | Add a purposeful accent or disable for intentionally monochrome systems |
| `pulse-animation` | [`engine/signals/pulse-animation.mjs`](../engine/signals/pulse-animation.mjs) | Pulsing or pinging decorative UI | Animation counts from classes and keyframes | Remove motion that does not communicate state or urgency |
| `eyebrow-chip` | [`engine/signals/eyebrow-chip.mjs`](../engine/signals/eyebrow-chip.mjs) | Small pill or badge directly above the first H1 | Extracted eyebrow count | Replace generic hero badges with specific page hierarchy or product proof |
| `status-dot` | [`engine/signals/status-dot.mjs`](../engine/signals/status-dot.mjs) | Decorative colored status dots | Extracted tiny circle counts | Use status indicators only when they represent real system state |
| `gradient-text` | [`engine/signals/gradient-text.mjs`](../engine/signals/gradient-text.mjs) | Gradient-filled headlines or text | `background-clip: text` style evidence | Use brand typography or a restrained accent treatment |
| `gradient-background` | [`engine/signals/gradient-background.mjs`](../engine/signals/gradient-background.mjs) | Repeated or layered gradient backgrounds | Gradient background and layer counts | Replace decorative gradients with content, imagery, or a smaller surface system |
| `glassmorphism-overuse` | [`engine/signals/glassmorphism-overuse.mjs`](../engine/signals/glassmorphism-overuse.mjs) | Repeated backdrop-blurred surfaces | `backdrop-filter` counts | Keep glass effects for purposeful depth, modals, or overlays |
| `emoji-icons` | [`engine/signals/emoji-icons.mjs`](../engine/signals/emoji-icons.mjs) | Emoji used repeatedly as iconography | Visible emoji count | Use a consistent icon set and reserve emoji for content where appropriate |
| `generic-marketing-copy` | [`engine/signals/generic-marketing-copy.mjs`](../engine/signals/generic-marketing-copy.mjs) | Repeated broad phrases such as "next-generation" or "revolutionize" | Visible text phrase counts | Write product-specific copy tied to a real audience, task, or outcome |
| `generic-cta-copy` | [`engine/signals/generic-cta-copy.mjs`](../engine/signals/generic-cta-copy.mjs) | Repeated generic CTA labels such as "Get started" or "Learn more" | Generic button/textual control counts | Rewrite buttons around the specific task, object, or next step |

## Configuring signals

Signals can be disabled or re-weighted per project:

```json
{
  "signals": {
    "disabled": ["status-dot", "monochrome-no-accent"],
    "penalties": {
      "inter-font": 5,
      "pill-radius": 20
    }
  }
}
```

Use this when a signal is intentionally allowed in your design system. For example, a utility dashboard may prefer system fonts, and a brand system may intentionally use a monochrome palette.

## Adding a detector

1. Create `engine/signals/<your-signal>.mjs`.
2. Export a default object with `id`, `label`, `penalty`, `weight`, `rationale`, and `test(metrics, ctx)`.
3. Import it in `engine/signals/index.mjs` and add it to `SIGNALS`.
4. Add unit coverage in [`test/signals.test.mjs`](../test/signals.test.mjs).
5. Add a row to this catalog and update scoring docs if the signal changes how users should interpret originality.

Keep the detector narrow. One file should represent one pattern, and `test()` must be a pure function: no network, filesystem, timers, randomness, or global state.

## Good signal candidates

A strong signal has all of these properties:

- It can be detected from rendered DOM, computed style, visible text, or extracted structure.
- It is common enough in generated or low-craft UI that users recognize it.
- It has a clear remediation path.
- It can be tested with small fixture metrics.
- It can explain itself in one sentence in CLI output.

Weak candidates are subjective opinions, brand preferences, one-off design critiques, or patterns that require private product context.
