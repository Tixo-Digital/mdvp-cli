# Changelog

All notable changes to `@mdvp/cli` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Container packaging docs** — added a distroless static container recipe and a runtime matrix for Alpine, Debian slim, Apple Container, Nix/devbox, and exact/browser images.
- **Nix flake entrypoints** — added `flake.nix` with `nix develop`, `nix run .#verify`, `nix run .#smoke`, and `nix run .#static-audit`.

### Fixed

- **Minimal container exact errors** — exact/browser audits now report a concise runtime requirement when npm is unavailable instead of crashing with a Node `spawn npm ENOENT` stacktrace.

---

## [1.34.1] — 2026-06-12

### Changed

- **Exact audit default** — plain `audit <domain>` now uses the rendered browser path by default. Static/cache shortcuts are approximate and require `MDVP_USE_CACHE=1`; use `--fast` with that env var to make the shortcut explicit in scripts. `--exact` remains as an explicit alias for the default browser path.
- **CLI screenshot asset** — README now uses the real terminal screenshot for the exact `mdvp.dev` audit output.

---

## [1.34.0] — 2026-06-12

### Added

- **Generic marketing copy signal** — `originality` now flags repeated broad phrases already counted by the DOM extractor, such as "revolutionize" and "next-generation".
- **Snapshot diff command** — `mdvp diff <before.json> <after.json>` compares saved audit JSON locally with deterministic component/category deltas for scripts and PR review.
- **Adoption proof docs** — README/docs now include a concrete development-proof workflow, benchmark caveats, richer npm keywords, and packaged docs for adoption/onboarding.
- **Static Rust analyzer** — default `audit <domain>` now uses a no-Chromium static HTML/CSS analyzer with a Rust implementation and JS fallback. JSON identifies `source: "static"` and includes analyzer limitations.
- **Exact audit e2e** — browser-backed `--exact` has an e2e test that proves it does not use the static/fast request-abort path.

### Changed

- **Faster exact audits** — metrics-only `audit --exact --json` keeps the rendered browser path but uses shorter waits and `load` navigation by default. `mdvp.dev` local smoke improved from about 6.12s to 2.55s while preserving score/source.
- **Faster static audits** — same-origin CSS fetching is concurrent and capped. `mdvp.dev` static smoke was about 360ms with the Rust analyzer.
- **Nightly release workflow** — prerelease tags publish through Trusted Publishing under npm dist-tag `nightly` and create GitHub prereleases.

### Fixed

- **Bounded local browser child** — browser-backed local crawls keep the parent-side timeout/cleanup from the previous timeout work so stuck child processes are terminated.

---

## [1.33.0] — 2026-06-10

### Added

- **README badge generator** — `mdvp badge <domain>` prints README-ready shields.io markdown that links to `https://mdvp.dev`. URL input is normalized through the existing domain parser, and `--json` returns the same badge data in a script-friendly shape.
- **Project init command** — `mdvp init` creates a conservative starter `.mdvprc` for local/CI threshold checks. `mdvp init --github-action` also creates `.github/workflows/mdvp.yml` for GitHub Actions onboarding.
- **Init automation flags** — `mdvp init` supports `--dry-run`, `--json`, `--force`, and `--url=...` so agents and scripts can preview or generate setup files without secrets.
- Tests for badge generation and init file planning/writes.

### Changed

- CLI help and docs now include `badge` and `init` onboarding paths.
- `CHANGELOG.md` is included in the published npm tarball.

---

## [1.32.1] — 2026-06-02

### Fixed

- **MCP server version** — the stdio MCP server (`npx @mdvp/cli mcp`) now reports the actual package version (1.32.1) to clients during the `initialize` handshake, instead of the hardcoded `1.0.0` it shipped with. This means Claude, Cursor, OpenCode, Windsurf, and Cline will now show the correct version in their MCP server list, and any client that logs the server version will see a real number.

### Changed

- README now surfaces the algorithm GIF in a `### Pipeline` section right after the install block, so the visual walkthrough is the first thing readers see. The detailed `## How it works` section is unchanged further down.

---

## [1.32.0] — 2026-06-02

### Changed

- **BREAKING**: `audit <domain>` now crawls locally by default (no API key, no credits). The previous default was a cloud dataset lookup.
  - Migration: pass `--cloud` to restore the old cloud-lookup behavior.
  - CI scripts that ran `audit <url> --local` keep working — `--local` is now a deprecated alias for the default.
- Release workflow now uses Node 22 + `npm@latest` (npm 11+ is required for OIDC Trusted Publishing; Node 20 ships npm 10 which does not support it).
- `lib/format.mjs` now defines `CATS` (was in `lib/constants.mjs`) to break a circular import that surfaced once `commands/audit.mjs` was loaded before `lib/constants.mjs` (e.g. from tests).

### Added

- **`--swarm` flag** — local audit + POST the result to the public dataset (`POST /swarm/contribute`). Opt-in per audit, not the default. Use it when you want your local audit to be a one-shot contribution. For persistent contribution, `mdvp hire` is still the right command.
- **`--cloud` flag** — explicit cloud dataset lookup. This is what `audit` did by default before v1.32.0.
- **`source` field in JSON output** — every audit result now reports `"local"`, `"cloud"`, or `"swarm"` so consumers can tell where the data came from.
- **Conflict detection** — `--cloud` and `--swarm` are mutually exclusive; `--cloud` and `--check` are mutually exclusive (--check requires a local crawl); `--local` with `--cloud` or `--swarm` is a hard error (since v1.32.0 `--local` is the default and the combination is meaningless).
- 18 new unit tests for the conflict matrix, source label, and audit flag routing.

### Notes

- Version bump is minor (1.31.x → 1.32.0) despite the default-behavior change. Reasoning: the change is reversible by adding one flag (`--cloud`), there is no schema or wire-format break, and `1.32.0` is less disruptive for downstream pin files than `2.0.0`. The CHANGELOG and migration guide are explicit so the break is documented.
- The `submit` command no longer accepts `--local`; the equivalent is now `audit <domain> --swarm`. `submit` is reserved for the credit-spending remote crawl.
- npm unpublish of the v1.32.0-rc.0 test publish is queued (publishing under `--tag=next` kept `latest` at 1.31.5 throughout the test).

---

## [1.31.5] — 2026-06-02

### Fixed

- OIDC Trusted Publishing release workflow now actually publishes (was failing in CI on every prior tag push). The fix required Node 22 + `npm@latest` since npm 10 (shipped with Node 20) does not support OIDC token exchange. Manual `npm publish` for 1.31.5 was used as a stopgap.

## [1.31.4] — 2026-06-02

### Fixed

- `release.yml` switched to npm Trusted Publisher (OIDC) — required removing `NPM_TOKEN` secret from repo settings and configuring the publisher on npmjs.com. First run still failed; root cause was `setup-node` injecting `NODE_AUTH_TOKEN` into `.npmrc` and overriding the OIDC exchange. Fix landed in 1.31.5.

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
