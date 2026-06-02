```
  ███╗   ███╗██████╗ ██╗   ██╗██████╗
  ████╗ ████║██╔══██╗██║   ██║██╔══██╗
  ██╔████╔██║██║  ██║██║   ██║██████╔╝
  ██║╚██╔╝██║██║  ██║╚██╗ ██╔╝██╔═══╝
  ██║ ╚═╝ ██║██████╔╝ ╚████╔╝ ██║
  ╚═╝     ╚═╝╚═════╝   ╚═══╝  ╚═╝
```

# @mdvp/cli

[![CI](https://github.com/Tixo-Digital/mdvp-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Tixo-Digital/mdvp-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@mdvp/cli)](https://www.npmjs.com/package/@mdvp/cli)
[![npm downloads](https://img.shields.io/npm/dm/@mdvp/cli)](https://www.npmjs.com/package/@mdvp/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**DOM analysis for any live URL.** Counts, ratios, and a pattern registry for the rendered HTML. Runs locally via Puppeteer — no API key, no account, no baseline needed.

```bash
npx @mdvp/cli audit myapp.com
```

### Pipeline

![MDVP scoring pipeline](docs/assets/algorithm-flow.gif)

Puppeteer opens the URL → `getComputedStyle()` reads every element → 12 categories score into 4 components → a pattern registry highlights common design heuristics. See [How it works](#how-it-works) below for the full walkthrough.

---

## Why

Tools like v0, Bolt, Lovable, and Cursor generate frontends fast — but the output often shares common patterns: Inter as the primary font, Tailwind's default purple-blue-pink gradient palette, every button is `border-radius: 9999px`, 40+ unique CSS colors with no system. Visual regression tools can't help (no prior snapshot to compare against); linters check syntax, not rendered quality.

MDVP gives you numbers on the rendered DOM. It instruments the page, extracts computed CSS values via `getComputedStyle()`, runs perceptual color analysis in Oklab space, and counts against design-system heuristics. The scoring is deterministic: the same DOM produces the same score, bit-identical.

## Quickstart

```bash
# Score any URL locally (first run downloads Puppeteer's Chromium, ~30s)
npx @mdvp/cli audit myapp.com

# Enforce thresholds in CI — exits 1 on violation
npx @mdvp/cli audit myapp.com --check

# Look up a known site from the public dataset (no local crawl)
npx @mdvp/cli audit myapp.com --cloud

# Contribute your local result to the public dataset
npx @mdvp/cli audit myapp.com --swarm

# JSON output for scripting
npx @mdvp/cli audit myapp.com --json | jq .components.css_health
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
  · Inter + Tailwind purple-blue palette — common design pattern
```

## How it works

Puppeteer opens the URL, `getComputedStyle()` is read on every element, the scorer groups 12 categories into four named components, and a pattern registry of independent heuristic detectors deducts from the `originality` component when common patterns match. See [the methodology paper](docs/methodology.md) for the full algorithm, weight table, and prior-work comparison.

## Documentation

- [Install](docs/install.md) — requirements, install, first run, troubleshooting
- [CLI commands](docs/cli.md) — every flag, every subcommand, exit codes
- [Scoring](docs/scoring.md) — what the four components measure, the signal registry
- [DESIGN.md compliance](docs/design-md.md) — diff your rendered DOM against your design system
- [CI enforcement](docs/ci.md) — `.mdvprc`, GitHub Action, exit codes, other CI systems
- [MCP server](docs/mcp-server.md) — plug into Claude, OpenCode, Cursor, Windsurf, Cline
- [Architecture](docs/architecture.md) — components, job protocol, self-hosting
- [Methodology](docs/methodology.md) — full scoring paper (4 pillars, weight table)
- [Benchmark](docs/benchmark.md) — sensitivity / ablation + live reference panel
- [Development](docs/development.md) — setup, tests, adding a signal, cutting a release

## Add a score badge to your project

Show your MDVP score in your project's README: [docs/badge.md](docs/badge.md). Submit your site, drop in a shields.io endpoint, done.

## Contributing

Bug reports and feature requests: [GitHub Issues](https://github.com/Tixo-Digital/mdvp-cli/issues). Code and signal detectors: see [CONTRIBUTING.md](CONTRIBUTING.md). Adding a signal is a one-file change — see [the development guide](docs/development.md#adding-a-signal).

## Citing

If you use MDVP in research, cite via the "Cite this repository" button (powered by [`CITATION.cff`](CITATION.cff)). A preprint draft of the methodology is in [`docs/paper.md`](docs/paper.md).

## License

MIT. The local scoring engine, CLI, MCP server, and GitHub Action are in this repository. The hosted coordination layer and dataset are not part of this open-source package — see [docs/architecture.md](docs/architecture.md#what-is-not-open-source) for the boundary.
