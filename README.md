# @mdvp/cli

[![CI](https://github.com/Tixo-Digital/mdvp-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Tixo-Digital/mdvp-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@mdvp/cli)](https://www.npmjs.com/package/@mdvp/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Design quality measurement for any live URL.** Runs locally via Puppeteer — no API key, no account, no baseline needed.

```bash
npx @mdvp/cli audit myapp.com --local
```

---

## The problem with AI-generated UIs

Tools like v0, Bolt, Lovable, and Cursor generate frontends fast. But the output has a fingerprint:

- Inter or Poppins as the primary font
- Tailwind's default purple-blue-pink gradient palette  
- Every button is `border-radius: 9999px`
- 40+ unique CSS colors with no system
- Spacing values that ignore the 4px grid

Visual regression tools can't help — there's no prior snapshot to compare against. Linters check syntax, not rendered quality.

MDVP measures what matters. It instruments the live DOM, extracts computed CSS values, runs perceptual color analysis in Oklab space, and scores against design system heuristics. Fully deterministic: same snapshot → same score, bit-identical.

---

## Quickstart

```bash
# Audit any URL locally (first run installs Puppeteer ~30s)
npx @mdvp/cli audit myapp.com --local

# Enforce thresholds in CI — exits 1 on violation
npx @mdvp/cli audit myapp.com --local --check

# JSON output for scripting
npx @mdvp/cli audit myapp.com --local --json | jq .components.css_health
```

**Output:**

```
myapp.com  C+  58/100  local crawl

  css_health      ████████░░░░  48   32 colors · 4 fonts · 61% on grid
  visual_quality  ██████████░░  67
  structure       ████████████  81
  originality     ████░░░░░░░░  38

entropy 0.82 · apca 94.2 · grid 61%
Lowest: originality (38) · color (44) · spacing (51)
  · 32 unique colors. Professional limit: 8–12
  · 4 font families. Professional limit: 2
  · Inter + Tailwind purple-blue palette — AI-generated design fingerprint
```

---

## CI enforcement

### `.mdvprc`

```json
{
  "thresholds": {
    "max_colors": 20,
    "max_font_families": 2,
    "max_font_sizes": 6,
    "min_spacing_grid_pct": 70,
    "min_css_health": 65
  }
}
```

```bash
npx @mdvp/cli audit myapp.com --local --check
# exits 0 on pass, exits 1 with violation list on fail
```

### GitHub Action

```yaml
name: Design quality

on: [pull_request]

jobs:
  design:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Tixo-Digital/mdvp-cli/action@main
        with:
          url: ${{ env.PREVIEW_URL }}
          max_colors: 20
          max_font_families: 2
          min_css_health: 65
          fail_on_violation: 'true'
```

The action runs Puppeteer locally on the runner. No screenshot or DOM data sent anywhere. Full docs: [action/README.md](action/README.md)

---

## What it measures

### `css_health` — objective CSS metrics

Computed directly from `getComputedStyle()` on every rendered element. No model, no heuristic — these are facts about what's in the DOM.

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

### `originality` — AI-generated UI detection

13 signals for AI-generated aesthetics. Each contributes a penalty when matched:

| Signal | Why it matters |
|---|---|
| Inter / Poppins / Nunito / Outfit as primary font | Default in v0, Lovable, Bolt templates |
| ≥ 2 Tailwind purple-pink-blue accents | Default Tailwind gradient palette |
| All `border-radius: 9999px` | Shadcn/Tailwind button defaults |
| < 5 CSS custom properties | No design token system |
| < 3 headings + < 150 words | Placeholder / sparse content |
| System font stack only | No custom typeface decision |

A high originality penalty caps the overall score regardless of other categories. A human-designed site with Inter and a tight system shouldn't be penalised heavily — the `isUtilitySite()` heuristic relaxes rules for tools and dashboards.

---

## JSON schema

```json
{
  "url": "https://myapp.com",
  "overall_score": 58,
  "grade": "C+",
  "components": {
    "css_health": {
      "score": 48,
      "unique_colors": 32,
      "unique_font_families": 4,
      "unique_font_sizes": 11,
      "unique_border_radii": 3,
      "spacing_on_grid_pct": 61,
      "custom_properties": 4,
      "has_dark_mode": false
    },
    "visual_quality": { "score": 67 },
    "structure":      { "score": 81 },
    "originality":    { "score": 38 }
  },
  "entropy": {
    "overall": 0.82,
    "typography": 0.71,
    "color": 0.87,
    "spacing": 0.91,
    "spacing_grid_pct": 61,
    "apca_risk": "none"
  },
  "violations": [
    { "field": "unique_colors", "value": 32, "limit": 20, "msg": "32 unique colors (limit: 20)" }
  ],
  "recommendations": [
    "32 unique colors. Professional limit: 8–12",
    "4 font families. Professional limit: 2",
    "Inter + Tailwind blue palette — AI-generated design pattern"
  ]
}
```

---

## All commands

| Command | Mode | Description |
|---|---|---|
| `audit <url> --local` | offline | Score any live URL, fully local |
| `audit <url> --local --check` | offline | Enforce `.mdvprc` thresholds, exit 1 on violation |
| `audit <url> --local --json` | offline | JSON output |
| `audit <domain>` | cloud | Instant score from dataset (no Puppeteer) |
| `compare <a> <b>` | cloud | Side-by-side comparison |
| `top [n]` / `worst [n]` | cloud | Dataset leaderboard |
| `perceive <domain> --live` | cloud | Full MDVP-T/1.0 analysis for AI agents |
| `mcp` | local | Run as MCP server |
| `login` | — | Store API key for cloud commands |

### MCP server (Claude, Cursor, etc.)

```bash
npx @mdvp/cli mcp
```

```json
{
  "mcpServers": {
    "mdvp": {
      "command": "npx",
      "args": ["-y", "@mdvp/cli@latest", "mcp"]
    }
  }
}
```

---

## Architecture

```mermaid
flowchart LR
    URL --> Puppeteer["crawler-worker.mjs\nPuppeteer"]
    Puppeteer -->|page.evaluate| Extract["extract.js\ngetComputedStyle on every element"]
    Extract --> Scorer["scorer.mjs\nShannon entropy · 12 categories"]
    Scorer --> Colors["color-science.mjs\nOklab · APCA"]
    Scorer --> Groups["css_health\nvisual_quality\nstructure\noriginality"]
    Groups --> Thresholds["thresholds.mjs\n.mdvprc"]
    Thresholds -->|exit 1| CI
```

Engine is bundled in the npm package (`engine/`). No cloud download. See [docs/methodology.md](docs/methodology.md) for algorithm details.

---

## Development

```bash
git clone https://github.com/Tixo-Digital/mdvp-cli
cd mdvp-cli
npm ci
npm test          # 61 tests, node:test built-in, zero devDeps
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT. Cloud API, Workers infrastructure, billing, and private datasets are separate and not in this repository.
