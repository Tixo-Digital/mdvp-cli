# Benchmarks

How well does MDVP's score reflect real design quality? This documents what we
*can* measure honestly, and is reproducible from the scripts in `scripts/`.

## Why not a Webthetics correlation (yet)

The natural benchmark is Spearman ρ between MDVP and human aesthetic ratings on a
public dataset such as [Webthetics](https://github.com/carrenD/Webthetics) (Dou et al.).
We do not report that number because the two are **structurally incompatible**:

- Webthetics (built on the Reinecke et al. CHI'14 corpus) provides **static screenshots**
  with human ratings, captured around 2013.
- MDVP scores a **live DOM** — computed CSS values from `getComputedStyle`. It cannot
  score a screenshot, and the original 2013-era URLs are largely dead or redesigned.

Correlating today's live DOM against 2013 ratings of a since-changed page would be invalid,
and we will not fabricate a coefficient. A proper ρ study needs a *DOM-era* corpus of pages
with human ratings; building one (e.g. via a rating panel over freshly crawled pages) is
future work. Until then, we report two honest, reproducible validity checks below.

## 1. Sensitivity / ablation (deterministic)

This is the analogue of Webthetics' own occlusion study, on DOM metrics instead of pixels:
starting from a strong design-system profile, inject one vibe-code factor at a time and
measure the score. A valid scorer should respond, in the right direction, to each factor.

Reproduce: `node scripts/benchmark-sensitivity.mjs` (no network; reads `test/fixtures`).
Raw output: [`data/sensitivity-results.json`](../data/sensitivity-results.json).

**Individual factors** (strong baseline + one factor), effect on `originality`:

| Injected factor | originality Δ |
|---|---|
| baseline (strong design system) | — (95) |
| Inter as primary font | −15 |
| Tailwind purple-pink-blue palette | −10 |
| pill radius everywhere (9999px) | −12 |
| no design tokens (<5 custom props) | −8 |
| sparse content (45 elements) | −43 |

**Cumulative** (stacking factors toward a fully generated page):

| Step | overall | grade | originality |
|---|---|---|---|
| baseline | 95 | A+ | 95 |
| + Inter | 92 | A+ | 80 |
| + Tailwind palette | 87 | A | 70 |
| + pills | 70 | B+ | 52 |
| + no tokens | 60 | B- | 44 |
| + sparse | 60 | B- | 0 |

The cumulative overall score is **monotonically non-increasing** (verified by the script),
dropping 35 points overall and 95 points on originality from a strong baseline to a fully
vibe-coded profile. This confirms the score moves with the design factors it claims to
measure — necessary (not sufficient) for construct validity.

## 2. Reference panel (live)

Face validity: do sites widely regarded for strong design systems score well? We crawl a
reference panel with the local engine and report the score distribution. This is
descriptive — a positive-only panel, not a ranking, and no site is labeled negatively.

Reproduce: `node scripts/benchmark-reference.mjs --out data/benchmark-results-live.json`.
Panel: [`data/benchmark-sites.json`](../data/benchmark-sites.json). Each score is a single
live DOM snapshot and drifts as sites change.

<!-- RESULTS:REFERENCE — run 2026-06-02, n=8, 8/8 crawled; raw: data/benchmark-results-live.json -->

| Site | Grade | Overall | CSS health | Originality |
|---|---:|---:|---:|---:|
| figma.com | A- | 79 | 89 | 92 |
| vercel.com | A- | 77 | 86 | 87 |
| railway.app | A- | 77 | 75 | 77 |
| tailwindcss.com | B+ | 74 | 71 | 94 |
| github.com | B+ | 73 | 70 | 92 |
| posthog.com | B+ | 72 | 65 | 91 |
| stripe.com | B | 66 | 54 | 92 |
| linear.app | B- | 60 | 53 | 62 |

Distribution (single snapshot, 2026-06-02): overall mean **72.3**, median **73.5**, range
60–79; originality mean **85.9**, median **91.5**; CSS-health mean **70.4**.

Reading it honestly:

- **Originality is uniformly high** (mostly 87–94). This is the pillar the anti-vibe-code
  signals target, and the result is the one we'd want for face validity: hand-built,
  distinctive design systems are *not* flagged as generated. That the score leaves acclaimed
  design alone is the claim being checked here, and it holds.
- **Overall caps at A-, not A+.** These are large production marketing/app sites, and the
  ceiling comes from `css_health` (mean 70.4: big stylesheets, high rule counts, deep
  specificity), not from originality. MDVP measures CSS hygiene as well as taste; a heavy
  shipping site legitimately scores lower on hygiene than a curated reference page would.
- Scores are reported as-is, descriptively. This is not a ranking and no site is labeled
  negatively; a single live snapshot will drift as each site ships changes.

## Caveats

- The sensitivity study uses curated fixtures; it shows the scorer is *responsive and
  directionally correct*, not that its absolute scale matches human judgment.
- The reference panel is small and positive-only; it checks that acclaimed sites are not
  penalized, not discrimination accuracy.
- Neither is a substitute for a human-rating correlation study, which remains open (§ top).
- All numbers are reproducible from `scripts/` and pinned to a release; re-run for fresh data.
