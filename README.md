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

**DOM analysis for any live URL.** Counts, ratios, and a pattern registry for HTML/CSS quality. Runs locally with a static Rust analyzer by default — no API key, no account, no browser baseline needed.

```bash
npx @mdvp/cli audit myapp.com
```

### Pipeline

![MDVP scoring pipeline](docs/assets/algorithm-flow.gif)

Static audit fetches HTML + same-origin CSS → Rust extracts design metrics → 12 categories score into 4 components → a pattern registry highlights common design heuristics. Use `--exact` when you need a rendered browser audit with `getComputedStyle()`, screenshots, or motion artifacts. See [How it works](#how-it-works) below for the full walkthrough.

---

## Why

Tools like v0, Bolt, Lovable, and Cursor generate frontends fast — but the output often shares common patterns: Inter as the primary font, Tailwind's default purple-blue-pink gradient palette, every button is `border-radius: 9999px`, 40+ unique CSS colors with no system. Visual regression tools can't help (no prior snapshot to compare against); linters check syntax, not rendered quality.

MDVP gives you numbers on the page structure and design system. The default audit is a no-Chromium static pass over HTML/CSS for fast CI feedback; `--exact` instruments the rendered page, extracts computed CSS values via `getComputedStyle()`, and is the right mode for disputed results or screenshot-backed evidence. The scoring is deterministic for the same input.

## Quickstart

```bash
# Score any URL locally without launching Chromium
npx @mdvp/cli audit myapp.com

# Use the slower rendered browser path when validating a disputed result
npx @mdvp/cli audit myapp.com --exact

# Enforce thresholds in CI — exits 1 on violation
npx @mdvp/cli audit myapp.com --check

# Look up a known site from the public dataset (no local crawl)
npx @mdvp/cli audit myapp.com --cloud

# Contribute your local result to the public dataset
npx @mdvp/cli audit myapp.com --swarm

# JSON output for scripting
npx @mdvp/cli audit myapp.com --json | jq .components.css_health

# Print a README badge for your site
npx @mdvp/cli badge myapp.com
```

**Output:**

```
myapp.com  C+  58/100  static audit

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

Default audit fetches the page and same-origin stylesheets, runs the static analyzer, groups 12 categories into four named components, and uses independent heuristic detectors to score common AI-generated UI patterns. `--exact` switches to Puppeteer for rendered DOM and computed style evidence. See [the methodology paper](docs/methodology.md) for the full algorithm, weight table, and prior-work comparison.

## Documentation

- [Install](docs/install.md) — requirements, install, first run, troubleshooting
- [CLI commands](docs/cli.md) — every flag, every subcommand, exit codes
- [Scoring](docs/scoring.md) — what the four components measure, the signal registry
- [DESIGN.md compliance](docs/design-md.md) — diff audited page metrics against your design system
- [CI enforcement](docs/ci.md) — `.mdvprc`, GitHub Action, exit codes, other CI systems
- [MCP server](docs/mcp-server.md) — plug into Claude, OpenCode, Cursor, Windsurf, Cline
- [Architecture](docs/architecture.md) — components, job protocol, self-hosting
- [Methodology](docs/methodology.md) — full scoring paper (4 pillars, weight table)
- [Benchmark](docs/benchmark.md) — sensitivity / ablation + live reference panel
- [Development](docs/development.md) — setup, tests, adding a signal, cutting a release

## Add a score badge to your project

Show your MDVP score in your project's README: [docs/badge.md](docs/badge.md). Submit your site, then generate the shields.io markdown:

```bash
npx @mdvp/cli badge myapp.com
```

## Contributing

Bug reports and feature requests: [GitHub Issues](https://github.com/Tixo-Digital/mdvp-cli/issues). Code and signal detectors: see [CONTRIBUTING.md](CONTRIBUTING.md). Adding a signal is a one-file change — see [the development guide](docs/development.md#adding-a-signal).

## Citing

If you use MDVP in research, cite via the "Cite this repository" button (powered by [`CITATION.cff`](CITATION.cff)). A preprint draft of the methodology is in [`docs/paper.md`](docs/paper.md).

## License

MIT. The local scoring engine, CLI, MCP server, and GitHub Action are in this repository. The hosted coordination layer and dataset are not part of this open-source package — see [docs/architecture.md](docs/architecture.md#what-is-not-open-source) for the boundary.
