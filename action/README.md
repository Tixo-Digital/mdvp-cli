# MDVP GitHub Action

Design quality gate for any URL — no Figma file, no API key, no baseline required.

Works in CI for AI-generated frontends (v0, Bolt, Lovable, Cursor) where visual regression tools can't help because there's no prior snapshot.

## Usage

```yaml
- uses: Tixo-Digital/mdvp-cli/action@main
  with:
    url: https://preview.myapp.com
```

### With threshold config

```yaml
- uses: Tixo-Digital/mdvp-cli/action@main
  with:
    url: https://preview.myapp.com
    max_colors: 20
    max_font_families: 2
    min_spacing_grid_pct: 70
    min_css_health: 65
    min_overall: 50
```

### Using .mdvprc

Create `.mdvprc` in your repo root:

```json
{
  "thresholds": {
    "max_colors": 20,
    "max_font_families": 2,
    "max_font_sizes": 6,
    "min_spacing_grid_pct": 70,
    "min_css_health": 65,
    "min_overall": 50
  }
}
```

Then just:

```yaml
- uses: Tixo-Digital/mdvp-cli/action@main
  with:
    url: https://preview.myapp.com
```

### Full workflow example

```yaml
name: Design quality check

on:
  pull_request:
    branches: [main]

jobs:
  design-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Tixo-Digital/mdvp-cli/action@main
        with:
          url: ${{ github.event.deployment_status.target_url || 'https://your-preview-url.com' }}
          max_colors: 20
          max_font_families: 2
          min_css_health: 65
```

## Outputs

| Output | Description |
|---|---|
| `overall_score` | Design score 0–100 |
| `grade` | Letter grade (A+, A, B+, …, F) |
| `css_health_score` | CSS health component score |
| `violations` | JSON array of threshold violations |
| `report_json` | Full audit report as JSON |

## What it measures

**css_health** — CSS/DOM metrics, most defensible for CI enforcement:
- Unique color count
- Font family count  
- Font size count
- Border-radius variety
- % of spacing values on 4px grid

**visual_quality** — Design craft signals: modernity, polish, sophistication, readability

**structure** — HTML quality, UX patterns, content depth

**originality** — AI-generated design detection (Inter/Poppins font, Tailwind blue palette, pill shapes, sparse content)

## How thresholds work

Thresholds are checked only when explicitly set (via `.mdvprc` or action inputs). Violations cause the step to fail with exit code 1.

Default thresholds are conservative — they catch obvious design health issues without blocking normal development.

## Privacy

The action runs Puppeteer locally on the GitHub Actions runner. No screenshot or DOM data is sent to mdvp.dev.
