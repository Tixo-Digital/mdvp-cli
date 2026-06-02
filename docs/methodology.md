# Scoring Methodology

MDVP measures design quality through four deterministic pillars applied to live DOM snapshots. No neural network, no trained weights, no GPU required. The same URL crawled twice produces the same score.

---

## What the engine measures

### Pillar 1 — CSS/DOM metrics (objective counts)

These are raw measurements extracted by `engine/extract.js` via Puppeteer's `page.evaluate()`. They reflect what `getComputedStyle()` returns for every visible element — the actual rendered values, not source CSS.

| Metric | How extracted | Why it matters |
|---|---|---|
| Unique colors | `getComputedStyle(el).color` + `backgroundColor` deduplicated | Color proliferation is the most common symptom of absent design system |
| Unique font families | `getComputedStyle(el).fontFamily` | > 3 families signals incoherence |
| Unique font sizes | `getComputedStyle(el).fontSize` | Type scale discipline |
| Unique border-radius values | `getComputedStyle(el).borderRadius` | Component consistency |
| Spacing values | `padding*` + `gap` computed values | Grid adherence |
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

### Pillar 4 — AI-pattern detection (vibe-code fingerprints)

The `originality` category flags patterns associated with AI-generated UIs. Each signal contributes a penalty:

| Signal | Penalty | Rationale |
|---|---|---|
| Inter/Poppins/Nunito/Outfit as primary font | −10 to −20 | Default fonts in v0/Lovable/Bolt templates |
| ≥ 2 Tailwind purple-pink-blue accent colors | −15 | Default Tailwind gradient palette |
| All border-radius = 9999px (full pill) | −20 | Signature of Shadcn/Tailwind button defaults |
| Sparse content (< 3 headings, < 150 words) | −15 | Placeholder content pages |
| No CSS custom properties (< 5) | −10 | No design token system |
| System font stack only | −10 | No custom typeface choice |

These signals are **heuristic and imperfect** — a human designer could intentionally use Inter with a tight color system. The penalty is applied as a cap on the overall score rather than a hard disqualification: an otherwise excellent site that happens to use Inter is not penalized severely.

**Known false positive cases:**
- Utility tools and dashboards that legitimately use system fonts
- Minimal landing pages with intentionally sparse content
- Brand style guides that happen to use blue as their accent

The `isUtilitySite()` heuristic (checks for `<table>`, `<input>`, high link density) relaxes several rules for tools and data-heavy interfaces.

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

Given the same snapshot (DOM state + computed styles at time T), the engine produces identical output:

```bash
# Two runs on cached data produce identical scores
npx @mdvp/cli audit mysite.com --local --json | jq .overall_score
npx @mdvp/cli audit mysite.com --local --json | jq .overall_score
# → same integer both times
```

The only source of variance is the live DOM itself (A/B tests, time-based content, CDN routing). To eliminate this, the crawler takes a single snapshot and scores it — there is no averaging or sampling.

---

## Relationship to prior work

| System | Approach | Comparison |
|---|---|---|
| [Webthetics](https://github.com/carrenD/Webthetics) | CNN trained on aesthetic ratings | Our entropy/heuristic approach is less accurate (r ≈ 0.45 expected vs. Webthetics r = 0.85) but requires no training data, no GPU, and is fully explainable |
| [Project Wallace](https://projectwallace.com) | CSS statistics (counts, complexity) | Closest comparable tool — Wallace reports raw counts; MDVP adds entropy analysis, APCA contrast, and scoring |
| [WCAG 2.1 checkers](https://wave.webaim.org) | Accessibility rule-based | MDVP uses APCA over WCAG 2.1 luminance ratio; MDVP is not an a11y checker but overlaps on contrast |
| [CSS Stats](https://cssstats.com) | Raw CSS complexity metrics | Report only, no scoring or CI integration |

MDVP occupies the gap between raw CSS statistics (Wallace, CSS Stats) and trained aesthetic models (Webthetics): objective-enough for CI enforcement, richer than counts alone, explainable without a PhD.
