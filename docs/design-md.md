# DESIGN.md compliance

Signals catch *generic* anti-patterns. A [`DESIGN.md`](https://github.com/google-labs-code/design.md) file lets you check the opposite: does the live DOM actually follow **your** design system?

Drop a `DESIGN.md` in your repo (the Google design.md format — YAML front matter with `colors`, `typography`, `rounded`, `spacing` tokens). MDVP picks it up automatically and diffs the audited page metrics against it:

```bash
npx @mdvp/cli audit myapp.com
# … normal scores …
#
# DESIGN.md (Acme)  3 errors · 2 warnings  −18 from 74
#   ✗ Off-palette color rgb(236, 72, 153) (ΔE 0.14 from nearest token)
#   ✗ Font "Inter" is not in the DESIGN.md typography scale
#   · Border-radius 9999px is off the DESIGN.md rounded scale
```

## How it works

- **Colors** are matched perceptually in Oklab space (ΔE), not by string equality — `#2563eb` and `rgb(38,100,236)` are the same token.
- **Fonts** must appear in the declared typography list.
- **Border-radius** values must be on the declared rounded scale.
- **Spacing** must land on the declared spacing grid.

## Two modes

Without `--check`, spec mismatches apply a soft penalty (capped at −40) to the score. With `--check`, off-palette colors and off-scale fonts become hard violations that exit 1 — so an agent that ignored your `DESIGN.md` fails CI.

```bash
npx @mdvp/cli audit myapp.com --check   # DESIGN.md errors fail the build
```

Point at a non-default path with `--design=path/to/DESIGN.md`:

```bash
npx @mdvp/cli audit myapp.com --design=docs/DESIGN.md --check
```

## Example DESIGN.md

```yaml
---
name: Acme
colors:
  - "#2563eb"   # primary
  - "#0f172a"   # ink
  - "#fafafa"   # paper
  - "#dc2626"   # danger
typography:
  - "Inter"
  - "JetBrains Mono"
rounded:
  - 0
  - 4
  - 8
  - 16
spacing:
  - 4
  - 8
  - 16
  - 24
  - 32
  - 64
---

# Acme design system

Single source of truth for all product surfaces. MDVP enforces it in CI.
```

## JSON output

In `--json` mode, design compliance is reported under `design_compliance`:

```json
{
  "design_compliance": {
    "name": "Acme",
    "matched": 14,
    "errors": [
      { "field": "color", "value": "rgb(236, 72, 153)", "nearest_token": "#2563eb", "delta_e": 0.14 }
    ],
    "warnings": [
      { "field": "border-radius", "value": "9999px", "scale": [0, 4, 8, 16] }
    ],
    "score_delta": -18
  }
}
```

## Next

- [CI enforcement](ci.md) — wire DESIGN.md into your pipeline
- [Scoring](scoring.md) — what the 4 components measure
