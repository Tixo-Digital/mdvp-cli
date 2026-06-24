# Scoring

MDVP scores a live DOM across four components grouped from 12 underlying categories. All scores are deterministic — the same DOM produces the same score, bit-identical.

## Four components

| Component | What it measures | Why it matters |
|---|---|---|
| `css_health` | Typography, spacing, color system, component consistency, raw counts | Absence of a design system shows up here first |
| `visual_quality` | Modernity, polish, sophistication, readability (entropy, Oklab ΔE, APCA) | Perceptual — not "what the CSS says" but "what the eye sees" |
| `structure` | HTML landmarks, heading hierarchy, alt coverage, content depth, UX patterns | Accessibility and information architecture |
| `originality` | Pattern matching (heuristic detectors in a registry) | Caps overall score when several patterns match — useful for catching low-effort outputs, not a measure of design quality |

A high `originality` penalty caps the overall score regardless of other categories. This is intentional: a 95% css_health page built with Inter + Tailwind's default purple-pink palette and 9999px border-radius is still a generic-looking page, and should be flagged.

## What goes into each component

### `css_health` — objective CSS metrics

Computed directly from `getComputedStyle()` on every visible element. No model, no heuristic — these are facts about what's in the DOM.

| Metric | Default limit | Signal |
|---|---|---|
| Unique colors | ≤ 30 | Color system discipline |
| Font families | ≤ 3 | Typography coherence |
| Font sizes | ≤ 8 | Type scale |
| Border-radius values | ≤ 6 | Component consistency |
| Spacing on 4px grid | ≥ 60% | Layout rhythm |
| CSS custom properties | — | Design token adoption |

### `visual_quality` — perceptual analysis

- **Shannon entropy** on font sizes and spacing. `H=0` = one value everywhere (system). `H=1` = all values equally frequent (chaos). Values are clustered within ±2px tolerance before computing entropy.
- **Oklab color distance** for near-duplicate detection. RGB distance is perceptually non-uniform; Oklab Euclidean distance (ΔE) correlates with what eyes actually distinguish. Threshold: ΔE < 0.08.
- **APCA contrast** (Advanced Perceptual Contrast Algorithm) — more accurate than WCAG 2.1 luminance ratio, accounts for font size and weight.

### `structure` — semantic quality

HTML landmark usage, heading hierarchy, accessible alt text, content depth, UX patterns.

### `originality` — pattern matching (heuristic)

A directory of independent detectors — [`engine/signals/`](../engine/signals/), one file per anti-pattern. The score starts at 100 and each matched signal subtracts a penalty:

| Signal | Why it matters |
|---|---|
| `inter-font` | Inter / Poppins / Nunito / Outfit — default in v0, Lovable, Bolt |
| `tailwind-palette` | Default Tailwind purple-pink-blue accents |
| `pill-radius` | `border-radius: 9999px` everywhere (Shadcn/Tailwind default) |
| `pulse-animation` | Gratuitous `animate-pulse` dots and badges |
| `eyebrow-chip` | Small badge above the H1 — generated-hero cliché |
| `status-dot` | Decorative green "online" dots implying fake live state |
| `gradient-text` | Gradient-filled headlines (`background-clip: text`) |
| `gradient-background` | Repeated or layered gradient backgrounds / mesh-gradient decoration |
| `glassmorphism-overuse` | Repeated `backdrop-filter` frosted-glass surfaces |
| `generic-marketing-copy` | Repeated broad phrases such as "revolutionize" or "next-generation" |
| `sparse-content` | Placeholder page, very few elements |
| `no-design-tokens` | Fewer than ~5 CSS custom properties |
| `emoji-icons` | Emoji standing in for an icon set |

A human-designed site with Inter and a tight system shouldn't be penalised heavily — the `isUtilitySite()` heuristic relaxes rules for tools and dashboards. Adding a signal is a one-file change — see [`engine/signals/README.md`](../engine/signals/README.md).

## Configuring signals

Signals are configurable per project via `.mdvprc` — disable one you intentionally break, or harden one you want banned:

```json
{
  "signals": {
    "disabled": ["system-font-only"],
    "penalties": { "pill-radius": 25 }
  }
}
```

## How the components combine

`overall_score` is a weighted sum of the four components with a penalty cap from `originality`. See [methodology.md](methodology.md) for the exact weight table and a comparison with prior work (Heuristic Evaluation, Hallway Usability, Webthetics).

## Reproducible validation

`docs/benchmark.md` documents a deterministic sensitivity/ablation study and a live reference panel crawl against 8 acclaimed design systems, with raw data in `data/`.

## Next

- [Methodology (full paper)](methodology.md) — 4 pillars, weight table, prior-work comparison
- [DESIGN.md compliance](design-md.md) — diff audited page metrics against a declared design system
- [Benchmark](benchmark.md) — sensitivity/ablation + live reference panel
