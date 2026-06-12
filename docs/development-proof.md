# Development Proof

This page documents why MDVP is useful during development: it turns a rendered frontend into specific engineering work.

It is not a claim that the tool can replace human taste, product judgment, or design review. The claim is narrower: MDVP finds rendered-DOM drift that developers can fix before merge.

## 1. Dogfood Audit Found A Real Fix

Command run from this repository:

```bash
node cli.mjs audit mdvp.dev
```

Observed result:

```text
mdvp.dev  B+  75/100  local crawl

  css_health      84  17 colors · 5 fonts · 77% on grid
  visual_quality  75
  structure       79
  originality     61

Lowest: Readability (42) · Originality (61) · Visual Polish (65)
  · 5 font families. Professional limit: 2
  · Color system detected: clear neutrals + limited accents
```

Why this helps development:

- The finding is not subjective: the rendered page used 5 font families.
- The fix is concrete: consolidate the `mdvp.dev` typography stack to 1-2 intentional families.
- The review loop is cheap: re-run the same command and compare `css_health`, typography, and overall score.

That is the core value: the tool gives a developer a clear next diff.

## 2. Before/After Workflow

The deterministic fixture benchmark models the same workflow without network variance:

```bash
node scripts/benchmark-sensitivity.mjs
```

Summary:

| Development state | Overall | Grade | Originality |
|---|---:|---:|---:|
| Strong design-system baseline | 95 | A+ | 95 |
| + Inter default | 92 | A+ | 80 |
| + Tailwind purple-blue palette | 87 | A | 70 |
| + pill radius everywhere | 70 | B+ | 52 |
| + no semantic tokens | 60 | B- | 44 |
| + sparse generated content | 60 | B- | 0 |

The corresponding development actions are direct:

- Replace generated font defaults with the product typography stack.
- Move from ad hoc Tailwind accents to semantic tokens.
- Normalize border-radius values across components.
- Add real content structure instead of sparse placeholder sections.
- Re-run the audit and keep the score from regressing.

## 3. Pull Request Gate

For a project preview URL:

```bash
npx @mdvp/cli init --github-action
npx @mdvp/cli audit "$PREVIEW_URL" --check
```

This turns MDVP from a report into a development control. A pull request can fail when rendered output exceeds configured limits such as:

- too many unique colors,
- too many font families,
- spacing-grid adherence below threshold,
- low `css_health`,
- banned generated-UI signals,
- DESIGN.md compliance errors.

The result is a practical workflow: a developer sees the failed dimension, fixes the design-system drift, and re-runs the same command before review.

## 4. What This Does Not Prove

This proof does not show that MDVP predicts human preference across the whole web. `docs/benchmark.md` explains why we do not fabricate a Webthetics-style correlation from incompatible screenshot-era data.

What it does prove is narrower and useful:

- MDVP surfaces concrete rendered-DOM issues during active development.
- The findings map to ordinary frontend changes.
- The same checks can run locally, in CI, and through MCP-enabled agents.
