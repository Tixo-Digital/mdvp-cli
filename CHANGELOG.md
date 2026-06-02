# Changelog

All notable changes to `@mdvp/cli` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.31.3] — 2026-06-02

### Added

- **Offline local mode** (`--local`) — scoring engine bundled in `engine/` directory. No cloud download on first run. Works fully offline after `puppeteer` install.
- **Component scores** — `groupComponents()` groups 12 raw categories into four named outputs:
  - `css_health` — typography + spacing + color + components + raw counts (unique_colors, unique_font_families, unique_font_sizes, spacing_on_grid_pct, custom_properties)
  - `visual_quality` — modernity + visual polish + sophistication + readability
  - `structure` — html_quality + ux_patterns + contentDepth
  - `originality` — AI-generated design detection (vibe-code score)
- **Shannon entropy metrics** — `computeEntropyMetrics()` returns overallDesignEntropy, typographyEntropy, colorEntropy, spacingEntropy, spacingGridAdherence, apcaContrastRisk
- **`.mdvprc` threshold config** — load per-project thresholds from `.mdvprc` or `mdvp.config.json`
- **`--check` flag** — enforces thresholds, exits 1 on violation (CI use)
- **GitHub Action** (`action/action.yml`) — composite action runs MDVP locally on any ubuntu-latest runner; supports inline threshold overrides; outputs overall_score, grade, css_health_score, violations, report_json
- **Signal registry** (`engine/signals/`) — every AI-pattern detector is now one file. Adding a signal is a one-file change + one registry line. New detectors: `pulse-animation`, `eyebrow-chip`, `status-dot`, `gradient-text`, `emoji-icons`, `no-design-tokens`, `oversized-hero`
- **Configurable signals** — `.mdvprc` `signals.disabled` and `signals.penalties` let a project opt out of a rule or harden one without forking the engine
- **New extracted metrics** — `extract.js` now captures `pulseAnimationCount`, `gradientTextCount`, `statusDotCount`, `eyebrowCount`
- **DESIGN.md compliance** (`engine/design-spec.mjs`) — diff the live DOM against a [Google design.md](https://github.com/google-labs-code/design.md) spec (YAML front matter: colors, typography, rounded, spacing). Auto-discovers `DESIGN.md` in cwd or `--design=path`. Colors matched perceptually in Oklab (ΔE). Soft penalty by default; hard violations under `--check`. Reported as `design_compliance` in `--json`
- **89 unit tests** — `node:test` built-in, zero devDependencies; covers color-science, thresholds, scorer, signals, design-spec
- **CI workflow** — Node 18/20/22 matrix, pack integrity check, secret scan
- **docs/methodology.md** — full scoring methodology: 4 pillars (CSS/DOM metrics, Oklab/APCA, Shannon entropy, vibe-code detection), weight table, prior work comparison
- **scripts/compute-correlation.mjs** — Spearman ρ analysis script for scoring validation; `--demo` mode included
- `package.json` — explicit `files` array, `bugs.url`, `publishConfig.access`

### Changed

- `--local` mode no longer downloads crawler files from api.mdvp.dev — uses bundled `engine/crawler-worker.mjs` and `engine/extract.js`
- `hire` command uses bundled `engine/crawler-worker.mjs` instead of downloading from R2 — transparent, works offline, same source as repository
- README rewritten: problem statement, component score table, JSON schema, methodology links, badges, distributed crawling architecture diagram

### Engine files (new, bundled in package)

- `engine/scorer.mjs` — ported from backend/src/dom-scorer.ts, pure ESM
- `engine/color-science.mjs` — ported from backend/src/color-science.ts, pure ESM
- `engine/thresholds.mjs` — new, .mdvprc + CI violation logic

---

## [1.30.x] — prior versions

Internal releases. Changelog maintained from 1.31.3 onward.
