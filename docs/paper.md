# MDVP: Deterministic, Explainable Design-Quality Measurement for Web Interfaces

**Nikita Evseev** — Tixo Digital
Preprint draft · v0.1 · 2026-06-02

> This is a working preprint draft maintained alongside the source. It is intended
> to seed an arXiv submission. The evaluation section describes a protocol; published
> correlation results will be added when the study completes.

## Abstract

The proliferation of AI-assisted UI generators (v0, Lovable, Bolt, Cursor) has made it
cheap to produce frontends, but the output frequently shares a recognizable, low-effort
fingerprint: a handful of default fonts, the Tailwind accent palette, pill-shaped
controls, and dozens of unsystematic colors. Existing tooling does not fill the gap
between raw CSS statistics (which report counts without judgment) and trained aesthetic
models (which are accurate but opaque, GPU-bound, and non-reproducible). We present
**MDVP**, a method that scores the design quality of any live web page through four
*deterministic* pillars: (1) objective CSS/DOM metrics extracted from computed styles;
(2) perceptual color science using the Oklab color space and the APCA contrast model;
(3) Shannon entropy as a proxy for design-system consistency; and (4) a registry of
explainable AI-pattern detectors. We further introduce *spec-relative* scoring: given a
`DESIGN.md` design-token specification, MDVP diffs the rendered DOM against the intended
system using perceptual color matching. The method requires no trained weights and no
GPU, and produces bit-identical output for a given DOM snapshot, making it suitable for
continuous-integration gating and as a reproducible research instrument.

## 1. Introduction

Automated assessment of *visual design quality* sits awkwardly between two established
families of tools. On one side, CSS-statistics tools (Project Wallace, CSS Stats) report
objective counts — number of unique colors, font sizes, specificity distributions — but
deliberately pass no judgment. On the other, learned aesthetics models (e.g. Webthetics)
predict human ratings with good correlation but require labeled training data, are not
reproducible across environments, and cannot explain *why* a page scored as it did.

Neither family answers the question a CI pipeline actually needs: *is this page's design
systematic and intentional, or is it generic, inconsistent, or machine-default?* We argue
that a useful answer can be assembled from deterministic, individually-defensible signals,
trading some predictive accuracy for full explainability, reproducibility, and zero
infrastructure. MDVP is that assembly.

Contributions:

1. A four-pillar deterministic scoring method over computed DOM styles (§2).
2. A perceptual treatment of color and contrast (Oklab ΔE, APCA) reused for both quality
   scoring and spec compliance (§2.2, §3).
3. A plugin registry of AI-pattern ("vibe-code") detectors, each an isolated, auditable
   rule (§2.4).
4. *Spec-relative* compliance: diffing a live DOM against a declarative `DESIGN.md` token
   specification (§3).
5. A reproducibility guarantee (bit-identical scores) and an open evaluation protocol (§4–5).

## 2. Method

All inputs are *computed* style values obtained via the browser's `getComputedStyle` over
every visible element after layout — not authored source CSS. This captures what the user
actually sees, independent of build tooling, frameworks, or CSS-in-JS.

### 2.1 Objective CSS/DOM metrics

Counts and ratios that are exactly as defensible as a linter rule: unique colors, unique
font families and sizes, unique border-radius values, spacing-on-grid percentage, custom
property (design token) count, dark-mode support, semantic landmark usage, heading
hierarchy, and image alt-text coverage. These require no calibration.

### 2.2 Perceptual color science

Colors are analyzed in the **Oklab** color space [Ottosson 2020], in which Euclidean
distance approximates perceived difference. Two colors are treated as near-duplicates when
their distance ΔE < 0.08, a threshold aligned with just-noticeable-difference values from
CIEDE2000 [Sharma et al. 2005]. Text contrast uses **APCA** [Somers/Myndex], which accounts
for spatial frequency, weight, and size, rather than the WCAG 2.1 luminance ratio. Palette
harmony is scored heuristically against classical hue relationships.

### 2.3 Shannon entropy as a consistency proxy

For font sizes, spacing values, and colors we compute Shannon entropy
H = −Σ p(x) log₂ p(x) over clustered value distributions. H ≈ 0 indicates a single value
used throughout (a strict system); H ≈ 1 indicates uniform spread (no system). Entropy
captures distribution skew that raw counts miss: eight font sizes where two dominate is a
very different design from eight used equally. A 4px-grid adherence check guards against
penalizing deliberately rich-but-systematic scales.

### 2.4 AI-pattern detection (vibe-code signals)

The originality pillar is a registry of independent detectors, each a pure function over
the metrics returning an optional penalty and a human-readable reason. Examples: a default
generator font as the primary typeface; the Tailwind purple-pink-blue accent set; near-
universal `border-radius: 9999px`; pulsing status dots; an "eyebrow" chip above the H1;
gradient-filled headlines; placeholder-sparse content. A composite escalation amplifies the
penalty when many signals fire together. Each detector is a single source file, making the
catalog community-extensible as generators change their defaults. Detectors are heuristic
and relaxed for utility/tool interfaces.

### 2.5 Aggregation

Twelve weighted categories combine into an overall 0–100 score grouped into four reported
components (CSS health, visual quality, structure, originality). A low originality score
caps the overall score, preventing a machine-default page from scoring well on other axes.

## 3. Spec-relative compliance (DESIGN.md)

Pillars 1–4 judge a page in the absolute. MDVP additionally supports *relative* evaluation
against a declared specification. `DESIGN.md` [Google Labs] encodes a visual identity as
YAML front matter — `colors`, `typography`, `rounded`, `spacing` tokens. MDVP parses this
and diffs the rendered DOM against it: off-palette colors (judged perceptually in Oklab,
not by string equality, so `#2563eb` and `rgb(38,100,236)` are one token), off-scale font
sizes, undeclared font families, and off-scale radii. This converts MDVP from an absolute
scorer into a verifier of whether an implementation — or an AI agent given the spec —
actually followed its own design system. Violations apply a soft score penalty by default
or hard CI failures on demand.

## 4. Evaluation protocol

Because the metrics are deterministic, the primary empirical question is *construct
validity*: does the overall score correlate with human aesthetic judgment? We specify a
pre-registered protocol rather than report post-hoc numbers:

- **Dataset:** the public Webthetics corpus [Dou et al.] of web screenshots with human
  aesthetic ratings.
- **Procedure:** score each page with MDVP; compute Spearman rank correlation ρ between
  MDVP overall score and mean human rating, with bootstrap confidence intervals.
- **Baselines:** raw CSS-statistic counts, and (where licensing permits) a learned model.
- **Reproduction:** `scripts/compute-correlation.mjs` computes ρ and p-values from a
  scores/ratings table; a `--demo` mode validates the pipeline on synthetic data.

We expect MDVP to under-perform trained aesthetic models on raw correlation while offering
full explainability, determinism, and zero infrastructure — a different point on the
accuracy/transparency trade-off, not a replacement.

## 5. Reproducibility

Given the same DOM snapshot (DOM state and computed styles at time *T*), MDVP emits
identical output: there are no trained weights, no sampling, and no averaging. The only
source of variance is the live page itself (A/B tests, time-based content, CDN routing),
which is eliminated by scoring a single captured snapshot. Releases are versioned
(SemVer); each archived release is intended to receive a DOI.

## 6. Limitations

The originality detectors are heuristic and can produce false positives (a designer may
deliberately use a default font with a tight system); they are applied as a soft cap, not
a disqualification. Entropy is computed on computed-style values, not authored tokens.
Harmony scoring is heuristic. MDVP measures *systematic intent and craft signals*, which
correlate with but are not identical to subjective beauty.

## References

- B. Ottosson. *A perceptual color space for image processing (Oklab)*. 2020.
- G. Sharma, W. Wu, E. N. Dalal. *The CIEDE2000 color-difference formula*. Color Research
  & Application, 2005.
- A. Somers (Myndex). *APCA — Advanced Perceptual Contrast Algorithm (SAPC)*.
- Google Labs. *DESIGN.md format specification*.
- C. Dou et al. *Webthetics: quantifying webpage aesthetics with deep learning*.
- C. E. Shannon. *A mathematical theory of communication*. Bell System Technical Journal, 1948.
- Project Wallace; CSS Stats — CSS analytics tools.

## How to cite

See [`CITATION.cff`](../CITATION.cff) in the repository root, or use GitHub's
"Cite this repository" button.
