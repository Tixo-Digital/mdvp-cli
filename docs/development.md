# Development

Setup, run the test suite, add a signal, ship a release.

## Setup

```bash
git clone https://github.com/Tixo-Digital/mdvp-cli
cd mdvp-cli
npm ci
```

Node 18+ is required. No system dependencies — the engine is pure JS and Puppeteer's Chromium downloads on first `audit --local`.

## Run the tests

```bash
npm test                  # 89 tests, node:test built-in, zero devDeps
```

Tests cover color science (Oklab ΔE, APCA contrast), the scorer, threshold enforcement, all signals, and DESIGN.md compliance parsing.

## Repo layout

```
cli.mjs                — entry point, command dispatch
mcp.mjs                — MCP server (stdio transport)
lib/                   — shared constants, output formatting
commands/              — one file per CLI subcommand
  audit.mjs            — local + cloud audit
  compare.mjs
  perceive.mjs
  submit.mjs
  hire.mjs             — crawler node
  mcp-config.mjs
engine/                — the scoring engine (also bundled in the npm package)
  crawler-worker.mjs   — Puppeteer orchestration
  extract.js           — page.evaluate(): getComputedStyle on every element
  scorer.mjs           — 12 categories → 4 components
  color-science.mjs    — Oklab ΔE, APCA contrast
  signals/             — one file per AI-pattern detector (registry)
  thresholds.mjs       — .mdvprc loader
  design-spec.mjs      — DESIGN.md parser + DOM compliance diff
test/                  — 89 node:test suites
action/                — composite GitHub Action
scripts/               — benchmark + correlation scripts
data/                  — reproducible benchmark outputs
docs/                  — all documentation
```

## Adding a signal

Each AI-pattern detector is one file. The registry is auto-discovered.

1. Create `engine/signals/<your-signal>.mjs`:

   ```js
   export default {
     id: "your-signal",
     penalty: 12,
     hint: "What this signal means and how to fix it.",
     detect(metrics, dom) {
       // Return true if the page matches the pattern
       return dom.gradientTextCount > 2;
     },
   };
   ```

2. That's it. No registration step — `engine/signals/index.mjs` discovers all `*.mjs` files in the directory.

3. Add a unit test in `test/signals.test.mjs`.

4. Document the new signal in [`docs/scoring.md`](scoring.md#originality--ai-generated-ui-detection).

5. Open a PR. The signal registry CI will check for unlisted detectors (you shouldn't need to edit any other file).

## Adding a CLI command

1. Create `commands/<name>.mjs` exporting a default async function `(args, opts) => { ... }`.
2. Register it in `cli.mjs` (`if (cmd === "<name>") await import(...)`).
3. Update [`docs/cli.md`](cli.md).

## Adding an editor / platform integration

For new MCP clients or alternative transports (HTTP, SSE, WebSocket), see [`mcp.mjs`](../mcp.mjs) and the [MCP spec](https://modelcontextprotocol.io). The server is intentionally small and well-commented.

## Cutting a release

The release pipeline is fully automated via GitHub Actions. To ship a new version:

```bash
npm run release:patch   # 1.31.4 → 1.31.5
npm run release:minor   # 1.31.4 → 1.32.0
npm run release:major   # 1.31.4 → 2.0.0
```

Each script bumps the version in `package.json` / `package-lock.json`, creates a commit, and tags it. Then:

```bash
git push && git push --tags
```

The [release workflow](../.github/workflows/release.yml) runs the full CI matrix, verifies the tag matches `package.json`, publishes to npm with OIDC provenance, and creates a GitHub Release with auto-generated notes.

The package uses [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — no `NPM_TOKEN` secret is required. The workflow uses OIDC identity tokens directly against npmjs.com.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the contribution policy, code of conduct, and the contributor license.

## Reporting security issues

See [SECURITY.md](../SECURITY.md) — do not open a public GitHub issue for security reports.

## Next

- [Architecture](architecture.md) — system overview, what is and isn't open source
- [Methodology](methodology.md) — full scoring paper
