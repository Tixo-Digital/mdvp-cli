# CI enforcement

MDVP is designed to be a build-time gate. `--check` exits 1 on any threshold violation or DESIGN.md error, with a stable exit code and machine-readable output.

## Quick start

Generate starter files:

```bash
npx @mdvp/cli init --github-action
```

This creates `.mdvprc` and `.github/workflows/mdvp.yml` when they are missing. Existing files are skipped unless you pass `--force`. The generated workflow reads a repository variable named `MDVP_TARGET_URL`, or you can bake in a fixed target with:

```bash
npx @mdvp/cli init --github-action --url=https://preview.example.com
```

Manual setup:

```yaml
# .github/workflows/design-quality.yml
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

The action runs the exact browser audit locally on the runner. No screenshot or DOM data is sent anywhere by default. If you intentionally want the lower-resource static/cache shortcut, run the CLI directly with `MDVP_USE_CACHE=1 --fast`. Full reference: [`action/README.md`](../action/README.md).

## Configuration: `.mdvprc`

Drop a `.mdvprc` (or `mdvp.config.json`) in your project root. Both formats are equivalent.

### Threshold config

```json
{
  "thresholds": {
    "max_colors": 20,
    "max_font_families": 2,
    "max_font_sizes": 6,
    "min_spacing_grid_pct": 70,
    "min_css_health": 65,
    "min_overall": 70
  }
}
```

| Field | Default | Meaning |
|---|---|---|
| `max_colors` | 30 | Unique colors from the audited page metrics |
| `max_font_families` | 3 | Distinct font families |
| `max_font_sizes` | 8 | Distinct font sizes |
| `min_spacing_grid_pct` | 60 | % of spacing values on a 4px grid |
| `min_css_health` | — | Minimum `css_health` component score |
| `min_overall` | — | Minimum overall score |

### Signal config

```json
{
  "signals": {
    "disabled": ["system-font-only"],
    "penalties": { "pill-radius": 25 }
  }
}
```

- `disabled` — skip these signals entirely
- `penalties` — override the default penalty of one or more signals

### Design spec path

```json
{
  "design_spec": "docs/DESIGN.md"
}
```

Equivalent to passing `--design=docs/DESIGN.md` on the CLI.

## Running the gate

```bash
npx @mdvp/cli audit myapp.com --check
# exits 0 on pass, exits 1 with violation list on fail
```

(`--local` is no longer needed — `audit` runs locally by default. Kept as a deprecated alias so older scripts keep working.)

### Example failure

```
myapp.com  C  62/100  local audit — FAIL

  ✗ unique_colors: 32 (limit 20)  [css_health]
  ✗ unique_font_families: 4 (limit 2)  [css_health]
  · originality: 38 (warning, no threshold)
```

Exit code is 1; the message is human-readable; `--json` mode is also available for log parsers.

## GitHub Action

Composite action — see [`action/README.md`](../action/README.md) for inputs, outputs, and examples. Posts a PR comment with the score breakdown.

```yaml
- uses: Tixo-Digital/mdvp-cli/action@main
  with:
    url: ${{ steps.deploy.preview_url }}
    fail_on_violation: 'true'
    comment_on_pr: 'true'
```

## Other CI systems

The CLI is a single static binary contract: `exit 0 = pass`, `exit 1 = fail`, `--json` for machine parsing. Any CI that can run Node can run MDVP.

| System | How |
|---|---|
| GitLab CI | `npx @mdvp/cli audit $URL --check` in a job |
| CircleCI | `run: npx @mdvp/cli audit $URL --check` |
| Buildkite | Same — single command |
| Vercel | Use the GitHub Action in the deploy workflow |
| Netlify | Use the Netlify build plugin or run via `npx` in `postBuild` |

## Pre-commit

Run MDVP on staged changes (against a local preview) before they reach CI:

```bash
# .husky/pre-commit
npx @mdvp/cli audit $PREVIEW_URL --check
```

## Next

- [CLI commands](cli.md) — full flag reference
- [DESIGN.md compliance](design-md.md)
- [Action source](../action/README.md)
