# Scoring Methodology

MDVP measures design quality through four deterministic pillars applied to page HTML/CSS metrics. No neural network, no trained weights, no GPU required. The same fetched input produces the same score.

---

## What the engine measures

### Pillar 1 — CSS/DOM metrics (objective counts)

These are raw measurements extracted by the static analyzer from HTML and same-origin CSS by default. For `audit --exact`, `engine/extract.js` runs in Puppeteer via `page.evaluate()` and reflects `getComputedStyle()` for visible elements.

| Metric | How extracted | Why it matters |
|---|---|---|
| Unique colors | CSS colors deduplicated; exact mode uses computed text/background colors | Color proliferation is the most common symptom of absent design system |
| Unique font families | CSS `font-family`; exact mode uses computed font family | > 3 families signals incoherence |
| Unique font sizes | CSS `font-size`; exact mode uses computed font size | Type scale discipline |
| Unique border-radius values | CSS `border-radius`; exact mode uses computed border radius | Component consistency |
| Spacing values | CSS `padding*` + `gap`; exact mode uses computed values | Grid adherence |
| Custom properties | `document.styleSheets` → `--*` variable count | Design token adoption |
| Dark mode | `@media (prefers-color-scheme: dark)` rule presence | Modern a11y |
| HTML landmarks | `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>` | Semantic structure |
| Image alt coverage | `img[alt]` / total `img` | Accessibility completeness |
| Heading hierarchy | H1–H6 counts | Document structure |

These counts are **entirely objective** — there is no model calibration and no subjective judgment. They are exactly as defensible as a linter rule.

### Pillar 2 — Perceptual color science (published algorithms)

Colors are analyzed in [Oklab](https://bottosson.github.io/posts/oklab/) color space rather than RGB. Oklab is designed so that Euclidean distance in the space correlates with perceived color difference — two colors with `deltaE = 0.05` look nearly identical to human eyes regardless of their RGB values.

**Near-duplicate detection:** Two colors are considered near-duplicates if `deltaE(a, b) < 0.08`. This threshold is calibrated against [CIEDE2000 just-noticeable-difference values](https://doi.org/10.1002/col.20070) (JND ≈ 1 in CIELAB ≈ 0.05–0.10 in OKLab).

**Contrast:** Text contrast is measured using [APCA (Advanced Perceptual Contrast Algorithm)](https://github.com/Myndex/SAPC-APCA) rather than the WCAG 2.1 luminance ratio. APCA accounts for spatial frequency, font weight, and font size — it better predicts readable text than the 4.5:1 rule, which has [documented false positive and false negative rates](https://www.w3.org/WAI/GL/task-forces/silver/wiki/Visual_Contrast_of_Text_Accessibility_Requirements).

**Harmony scoring:** Palette hue relationships are analyzed against classical schemes (analogous ±30°, complementary 150–210°, triadic 110–130°, tetradic 80–100°). Harmony score is a heuristic, not a perceptual model.

### Pillar 3 — Shannon entropy as design consistency proxy

Shannon entropy H measures the variety of a distribution:

```
H = -Σ p(x) log₂ p(x)
```

Applied to font sizes, spacing values, and colors:
- **H = 0**: one value used everywhere (perfect consistency, but possibly monotonous)
- **H = 1**: all values equally frequent (maximum chaos, no system)

Font sizes and spacing values are first clustered (±2px tolerance) before entropy is computed, so `14px` and `14.4px` are treated as the same token.

**Why entropy instead of raw counts?**  
Raw counts don't capture distribution skew. A site with 8 font sizes where 95% of text uses 2 of them is very different from one where all 8 are used equally. Entropy captures this: the first case has H ≈ 0.3 (concentrated), the second H ≈ 1.0 (chaotic).

**Scope and limitations:**  
Entropy is computed on computed-style values, not design tokens. A design system that uses the same token for multiple uses (e.g. `--spacing-4` = 16px for both padding and gap) will show up as one spacing value — correctly low entropy. A well-designed scale with deliberate variety can appear high-entropy; the scorer adjusts for this via the 4px grid adherence check (a systematic scale uses grid-aligned values).

**No neural saliency model:**  
Earlier MDVP designs explored using a saliency model (GBVS, DeepGaze II) to predict visual attention distribution and derive entropy from predicted fixation maps. This was abandoned for the open-source CLI for three reasons:

1. **Reproductibility**: neural models require version-pinned weights and produce near-identical but not identical outputs across environments; deterministic DOM metrics produce bit-identical results
2. **No GPU dependency**: saliency inference at scale requires GPU acceleration; not viable in CI or npx workflows
3. **Explainability**: a DOM-metric violation (`42 unique colors`) is immediately actionable; a saliency entropy difference is not

The cloud `/perceive` endpoint (available in the hosted API tier) uses a vision model for annotated screenshot analysis. This is intentionally separate from the local scoring engine.

### Pillar 4 — pattern matching (heuristics)

The `originality` category flags patterns associated with AI-generated UIs. Each signal is an independent detector living in its own file under [`engine/signals/`](../engine/signals/). The score starts at 100; every matched signal subtracts its penalty.

| Signal (`id`) | Penalty | Rationale |
|---|---|---|
| `inter-font` | −15 | Inter/Poppins/Nunito/Outfit — default fonts in v0/Lovable/Bolt templates |
| `tailwind-palette` | −5 to −15 | Default Tailwind purple-pink-blue accent palette |
| `tailwind-spacing` | −12 | Padding values almost entirely on Tailwind's default scale |
| `pill-radius` | −5 to −12 | Many `border-radius: 9999px` elements (Shadcn/Tailwind default) |
| `system-font-only` | −10 | No custom typeface loaded (relaxed for utility sites) |
| `sparse-content` | −10 to −25 | Placeholder page: very few rendered elements |
| `oversized-hero` | −10 | 48px+ headline on a near-empty page |
| `no-design-tokens` | −8 | Fewer than ~5 CSS custom properties |
| `pulse-animation` | −5 to −12 | Gratuitous `animate-pulse` / pulsing dots and badges |
| `eyebrow-chip` | −8 | Small badge/pill above the H1 (generated-hero cliché) |
| `status-dot` | −6 | Decorative colored "online" dots implying fake live state |
| `gradient-text` | −4 to −8 | Gradient-filled headlines (`background-clip: text`) |
| `emoji-icons` | −8 | Emoji standing in for an icon system |
| `monochrome-no-accent` | −5 | Near-gray palette with no accent (soft signal, weight 0) |

**Composite escalation.** A page tripping many signals at once is a stronger signal than any one alone. Beyond the per-signal penalties, the score takes an extra −6 / −12 / −20 as the matched-signal count crosses 4 / 6 / 8. Soft signals (weight 0) contribute to this count without penalising on their own.

These signals are **heuristic and imperfect** — a human designer could intentionally use Inter with a tight color system. They are applied as a cap on the overall score rather than a hard disqualification (see weights below), so an otherwise excellent site that happens to use Inter is not penalised severely.

**Configurable per project.** Any signal can be disabled or re-weighted via `.mdvprc`, so a team can opt out of a rule they intentionally break or harden one they want enforced:

```json
{
  "signals": {
    "disabled": ["system-font-only"],
    "penalties": { "inter-font": 5, "pill-radius": 25 }
  }
}
```

**Contributing a signal** is a one-file change — drop a detector into `engine/signals/`, add it to the registry, done. See [`engine/signals/README.md`](../engine/signals/README.md).

**Known false positive cases:**
- Utility tools and dashboards that legitimately use system fonts
- Minimal landing pages with intentionally sparse content
- Brand style guides that happen to use blue as their accent

The `isUtilitySite()` heuristic (checks for `<table>`, `<input>`, high link density) relaxes several rules for tools and data-heavy interfaces.

### Pillar 5 — DESIGN.md compliance (optional, spec-relative)

Pillars 1–4 judge a page in the absolute. Pillar 5 is **relative to a declared spec**: if a [`DESIGN.md`](https://github.com/google-labs-code/design.md) file is present, the engine diffs the audited page metrics against it.

DESIGN.md describes a visual identity as YAML front matter — `colors`, `typography`, `rounded`, and `spacing` tokens. `engine/design-spec.mjs` parses that subset (a minimal indentation parser; JSON front matter is also accepted) and normalizes it into matchable sets:

| Token | Compared against | Match rule |
|---|---|---|
| `colors` | DOM computed colors used ≥ 3× | Perceptual: Oklab `ΔE < 0.05` to the nearest token |
| `typography.*.fontFamily` | DOM font families | Substring match (allows weight/style suffixes) |
| `typography.*.fontSize` | DOM font sizes | ±1px |
| `rounded` | DOM border-radii | ±1px (rem normalized to px) |

**Color matching is perceptual, not lexical.** `#2563eb` declared in the spec and `rgb(38, 100, 236)` measured in the DOM are the same token — they differ in string form but are indistinguishable to the eye, so they don't register as a violation. This reuses the same Oklab pipeline as Pillar 2.

**Two modes:**
- **Soft (default):** violations produce a capped penalty (`min(40, errors×5 + warnings×2)`) subtracted from the overall score. Off-spec but not blocking.
- **Hard (`--check`):** off-palette colors and off-scale fonts become hard violations that exit 1 — useful for verifying an AI agent actually followed the `DESIGN.md` it was given.

This pillar is **opt-in** — with no `DESIGN.md` present, scoring is unchanged.

---

## Scoring weights

The 12 categories are combined as a weighted average:

| Category | Weight | Pillar |
|---|---|---|
| color | 25 | Color science + counts |
| originality | 35 | AI-pattern detection |
| contentDepth | 25 | Structure |
| spacing | 15 | DOM metrics + entropy |
| typography | 15 | DOM metrics + entropy |
| html_quality | 15 | DOM metrics |
| visual_polish | 15 | Heuristic |
| sophistication | 15 | Heuristic |
| readability | 15 | APCA |
| components | 10 | DOM metrics |
| modernity | 10 | DOM metrics |
| ux_patterns | 10 | Structure |

Weights sum to 190, final score = weighted_sum / 190, rounded to integer.

**Originality cap:** if `originality < 45`, overall score is capped at 60 regardless of other categories. This prevents a fully AI-default UI from scoring well on other dimensions while being indistinguishable from any other generated page.

---

## What is validated vs. heuristic

| Claim | Status |
|---|---|
| Unique color count is X | Objective — directly from `getComputedStyle` |
| Spacing values are Y% on 4px grid | Objective — modular arithmetic |
| APCA contrast is Z Lc | Objective — published algorithm, bit-identical |
| Near-duplicate detection via deltaE | Calibrated against published JND thresholds |
| Shannon entropy interpretation | Established information theory; DOM application is original |
| Harmony scoring | Heuristic, based on classical color theory |
| Originality signal weights | Heuristic, calibrated on ~200 sites manually labeled as AI/human |
| Overall score correlation with human aesthetic judgment | **Planned** — Spearman ρ study against [Webthetics](https://github.com/carrenD/Webthetics) public dataset |

---

## Reproducibility

Given the same fetched HTML/CSS, static audit produces identical output. Given the same rendered DOM snapshot, exact audit produces identical output:

```bash
# Two runs on cached data produce identical scores
npx @mdvp/cli audit mysite.com --json | jq .overall_score
npx @mdvp/cli audit mysite.com --json | jq .overall_score
# → same integer both times
```

The only source of variance is the live page itself (A/B tests, time-based content, CDN routing). Static audit fetches once; exact audit takes one browser snapshot. There is no averaging or sampling.

---

## Relationship to prior work

| System | Approach | Comparison |
|---|---|---|
| [Webthetics](https://github.com/carrenD/Webthetics) | CNN trained on aesthetic ratings | Our entropy/heuristic approach is less accurate (r ≈ 0.45 expected vs. Webthetics r = 0.85) but requires no training data, no GPU, and is fully explainable |
| [Project Wallace](https://projectwallace.com) | CSS statistics (counts, complexity) | Closest comparable tool — Wallace reports raw counts; MDVP adds entropy analysis, APCA contrast, and scoring |
| [WCAG 2.1 checkers](https://wave.webaim.org) | Accessibility rule-based | MDVP uses APCA over WCAG 2.1 luminance ratio; MDVP is not an a11y checker but overlaps on contrast |
| [CSS Stats](https://cssstats.com) | Raw CSS complexity metrics | Report only, no scoring or CI integration |

MDVP occupies the gap between raw CSS statistics (Wallace, CSS Stats) and trained aesthetic models (Webthetics): objective-enough for CI enforcement, richer than counts alone, explainable without a PhD.
