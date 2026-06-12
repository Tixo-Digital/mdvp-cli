# CLI commands

Every command in `@mdvp/cli` v1.32+. `audit` now crawls locally by default (no API key, no credits) and reads the API key from `MDVP_API_KEY` env var or `~/.mdvp/config.json` only when you pass `--cloud`. `submit`, `compare`, `top`, `worst`, `perceive`, and `recrawl` always read the key.

## Audit

Score a single URL.

```bash
# Default since v1.32.0 — local Puppeteer crawl, no API key, no credits
npx @mdvp/cli audit myapp.com

# Cloud — instant lookup from the public dataset (--json/--raw costs 1 credit)
npx @mdvp/cli audit myapp.com --cloud

# Swarm — local audit, then contribute the result to the public dataset
npx @mdvp/cli audit myapp.com --swarm

# CI — local audit + enforce .mdvprc thresholds, exit 1 on violation
npx @mdvp/cli audit myapp.com --check
```

Flags:

| Flag | What it does |
|---|---|
| _(none)_ | Local Puppeteer crawl. Default since v1.32.0. |
| `--cloud` | Look up an existing dataset record. `--json`/`--raw` cost 1 credit. |
| `--swarm` | Local audit + POST the result to the public dataset. |
| `--check` | Enforce `.mdvprc` thresholds and DESIGN.md spec, exit 1 on violation. Local-only (cannot combine with `--cloud`). |
| `--local` | Deprecated alias for the default. Kept so older CI scripts keep working. |
| `--json` | Emit machine-readable JSON |
| `--raw` | Full dataset row including assets URLs (cloud only) |
| `--text` | LLM-optimized compact format |
| `--design=PATH` | Diff against a specific DESIGN.md file |
| `--timeout=MS` | Overall timeout for the local crawler child process (default 60000) |
| `--no-vision` | Skip VLM analysis on the cloud `perceive` command |
| `--mdvprc=PATH` | Path to a non-default config file |

Output (text mode):

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

JSON output adds a `source` field (`"local"`, `"cloud"`, or `"swarm"`) so consumers can tell where the result came from.

## Init

Create starter project files for local checks and CI.

```bash
# Create .mdvprc with conservative thresholds
npx @mdvp/cli init

# Also create a GitHub Actions workflow
npx @mdvp/cli init --github-action

# Preview changes for scripts without writing files
npx @mdvp/cli init --dry-run --json
```

Flags:

| Flag | What it does |
|---|---|
| `--github-action` | Also create `.github/workflows/mdvp.yml` |
| `--url=URL` | Bake a fixed URL into the generated workflow |
| `--dry-run` | Report planned file changes without writing |
| `--force` | Overwrite existing target files |
| `--json` | Emit a stable machine-readable summary |

`init` never requires an API key. Existing files are skipped unless `--force` is set. When `--github-action` is used without `--url`, the workflow reads a repository variable named `MDVP_TARGET_URL` or a manual workflow input named `url`.

## Compare

Side-by-side comparison of two domains:

```bash
npx @mdvp/cli compare figma.com linear.app
npx @mdvp/cli compare figma.com linear.app --json
```

## Diff

Compare two saved audit JSON snapshots without crawling or calling the API:

```bash
npx @mdvp/cli audit https://preview.example.com --json > before.json
npx @mdvp/cli audit https://preview.example.com --json > after.json
npx @mdvp/cli diff before.json after.json
npx @mdvp/cli diff before.json after.json --json
```

The command reads local files only. Text output reports overall, component, and category score deltas; `--json` returns `before`, `after`, `delta`, `summary`, `changes`, and `changed` fields for scripts. Successful comparisons exit 0 and do not enforce thresholds. Missing files, malformed JSON, and files without MDVP score data exit 3.

## Top / worst

Dataset leaderboard.

```bash
npx @mdvp/cli top                # top 10
npx @mdvp/cli top 25             # top 25
npx @mdvp/cli worst              # worst 10
npx @mdvp/cli top --label=premium
```

## Badge

Print README-ready shields.io markdown for a public MDVP score badge:

```bash
npx @mdvp/cli badge mysite.com
npx @mdvp/cli badge https://www.mysite.com/path --json
```

The command normalizes protocol, `www.`, and paths before building the badge URL. Default output is markdown for copy/paste; `--json` includes `domain`, `endpointUrl`, `imageUrl`, `targetUrl`, and `markdown` for scripts.

## Perceive

Full MDVP-T/1.0 design perception for AI agents (DOM, entropy, saliency, motion taxonomy, classify, tokens, diagnosis, recommendations). `--live` crawls the URL on demand:

```bash
npx @mdvp/cli perceive yoursite.com --live
npx @mdvp/cli perceive stripe.com --no-vision    # skip VLM, faster
```

## Submit / recrawl

Add a URL to the public dataset (cloud command, requires API key).

```bash
npx @mdvp/cli submit mysite.com         # add to dataset
npx @mdvp/cli recrawl figma.com         # re-score an existing site
```

`--local` flag is gone from `submit` in v1.32.0 — `audit --swarm` is the per-audit contribution path; `submit` is the full credit-spending remote crawl.

## Hire

Become a persistent crawler node — contributes compute to the public dataset. No API key required.

```bash
npx @mdvp/cli hire               # interactive, 2 parallel tabs
npx @mdvp/cli hire --tabs=4      # more throughput
npx @mdvp/cli hire --daemon      # background process
```

The `hire` command copies `engine/crawler-worker.mjs` (from this package) into `~/.mdvp/crawler/` and runs it. The same source file also runs when you do `audit` (the local default) or `audit --swarm`.

## MCP

Run the Model Context Protocol server for integration with Claude, Cursor, OpenCode, and other MCP-compatible agents. See [MCP server](mcp-server.md) for the full setup.

```bash
npx @mdvp/cli mcp                 # stdio transport
npx @mdvp/cli mcp-config          # print the JSON snippet for your editor's config
```

## Login

Store your API key (one-time):

```bash
npx @mdvp/cli login
# → prompts for key, saves to ~/.mdvp/config.json
```

The key is used for cloud commands and `submit`. The local mode (default `audit`) never touches the network for anything except the target URL itself. `--swarm` is the only flag that POSTs back to the MDVP API from local mode.

## Config

The CLI reads (in order, last-wins):

1. Built-in defaults
2. `~/.mdvp/config.json` (set by `mdvp login`)
3. `.mdvprc` or `mdvp.config.json` in the current directory
4. CLI flags

`--mdvprc=PATH` overrides the per-project config location.

## Environment variables

| Var | Purpose |
|---|---|
| `MDVP_API_KEY` | API key for cloud commands (overrides config file) |
| `PUPPETEER_EXECUTABLE_PATH` | Use an existing Chrome / Chromium instead of the bundled one |
| `PUPPETEER_CACHE_DIR` | Override the Puppeteer download location |
| `MDVP_PUPPETEER_ARGS` | JSON array of extra Chromium flags (e.g. `["--no-sandbox"]`) |
| `NO_COLOR` | Disable ANSI color in CLI output |

## Exit codes

| Code | When |
|---|---|
| 0 | Audit completed, no violations (or `--check` not set) |
| 1 | `--check` failed: threshold or DESIGN.md violation |
| 2 | Crawl error (navigation timeout, Puppeteer crash) |
| 3 | Invalid arguments / config |
| 4 | Network / API error |

## Next

- [Scoring methodology](scoring.md)
- [CI enforcement](ci.md)
- [MCP server](mcp-server.md)
