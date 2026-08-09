# CLI commands

Every command in `@mdvp/cli` v1.32+. `audit` runs locally by default (no API key, no credits) and uses the exact rendered browser path unless you opt into static/cache shortcuts. The CLI reads the API key from `MDVP_API_KEY` env var or `~/.mdvp/config.json` only when you pass `--cloud`. `submit`, `compare`, `top`, `worst`, `perceive`, and `recrawl` always read the key.

## Audit

Score a single URL.

```bash
# Default — exact rendered browser audit, no API key, no credits
npx @mdvp/cli audit myapp.com

# Explicit exact — same runtime as the default, useful in scripts
npx @mdvp/cli audit myapp.com --exact

# Static/cache shortcut — approximate and opt-in
MDVP_USE_CACHE=1 npx @mdvp/cli audit myapp.com --fast

# Cloud — instant lookup from the public dataset (--json/--raw costs 1 credit)
npx @mdvp/cli audit myapp.com --cloud

# Swarm — local audit, then contribute the result to the public dataset
npx @mdvp/cli audit myapp.com --swarm

# CI — local audit + enforce .mdvprc thresholds, exit 1 on violation
npx @mdvp/cli audit myapp.com --check

# Authenticated local/staging page — connect to Chrome you already logged into
MDVP_BROWSER_URL=http://127.0.0.1:9222 npx @mdvp/cli audit http://localhost:3000/dashboard --json
```

Flags:

| Flag | What it does |
|---|---|
| _(none)_ | Exact local audit. Launches the browser crawler and scores rendered DOM/computed CSS unless `MDVP_USE_CACHE=1` is set. |
| `--exact` | Explicit alias for the default exact rendered browser path. |
| `--fast` | Static/cache shortcut marker for scripts. Requires `MDVP_USE_CACHE=1`; approximate and marked `source: "static"`. |
| `--cloud` | Look up an existing dataset record. `--json`/`--raw` cost 1 credit. |
| `--swarm` | Local audit + POST the result to the public dataset. |
| `--check` | Enforce `.mdvprc` thresholds and DESIGN.md spec, exit 1 on violation. Local-only (cannot combine with `--cloud`). |
| `--local` | Deprecated alias for the default. Kept so older CI scripts keep working. |
| `--json` | Emit machine-readable JSON |
| `--raw` | Full dataset row including assets URLs (cloud only) |
| `--text` | LLM-optimized compact format |
| `--design=PATH` | Diff against a specific DESIGN.md file |
| `--timeout=MS` | Browser child-process timeout; also applies to the static fetch path when `MDVP_USE_CACHE=1 --fast` is used |
| `--no-vision` | Skip VLM analysis on the cloud `perceive` command |
| `--mdvprc=PATH` | Path to a non-default config file |

Output (text mode):

```
myapp.com  C+  58/100  local audit

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

JSON output adds a `source` field (`"local"`, `"static"`, `"cloud"`, or `"swarm"`) so consumers can tell where the result came from. Default exact results use `"local"`. Static/cache shortcut results use `"static"` and include an `analysis` object that names the analyzer and limitations.

Local and static JSON also include `actions`, a stable remediation list for CI bots and agents. The existing `recommendations` array remains for compatibility; use `actions` when you need category, severity, and source fields without parsing prose.

```json
{
  "category": "typography",
  "severity": "warn",
  "message": "4 font families. Professional limit: 2",
  "source": "score:typography",
  "score": 62
}
```

Environment:

| Variable | What it does |
|---|---|
| `MDVP_USE_CACHE=1` | Opts the current process into the approximate static/cache shortcut for `audit`; use `--exact` to force the browser path for a single command. |

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

## Doctor

Check local first-run prerequisites without crawling a URL, calling mdvp.dev, or downloading Chromium.

```bash
npx @mdvp/cli doctor
npx @mdvp/cli doctor --json
```

`doctor` checks Node.js version, npm availability, browser env overrides, common Chrome/Chromium executable paths, Puppeteer cache writability, existing local crawler dependencies, `MDVP_USE_CACHE`, and optional cargo availability for the native static analyzer. Text output is stable for logs; `--json` returns the same check list for scripts plus a `recommendations` array for every warning or failure.

Each JSON recommendation has stable script-friendly fields:

```json
{
  "id": "browser",
  "severity": "warn",
  "check": "browser",
  "message": "Install Chrome/Chromium, set PUPPETEER_EXECUTABLE_PATH, or allow Puppeteer to download Chromium on first exact audit.",
  "env": {
    "PUPPETEER_EXECUTABLE_PATH": "<absolute path to Chrome or Chromium>"
  }
}
```

Exit 0 means no blocking first-run failures were found. Warnings are advisory, such as "Puppeteer will be installed on first exact audit" or "no system Chrome found; Puppeteer may use its bundled browser."

## Authenticated pages

Default `audit` can score pages behind login by connecting the local crawler to a Chrome instance you started with DevTools remote debugging. This is useful for SaaS dashboards, private staging apps, preview URLs, and local app routes that need cookies or local storage.

```bash
mkdir -p /tmp/mdvp-auth-profile
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/mdvp-auth-profile

# Sign in through that Chrome window, then:
MDVP_BROWSER_URL=http://127.0.0.1:9222 npx @mdvp/cli audit http://localhost:3000/dashboard --json
```

Security boundary:

- Extraction and scoring stay local for default `audit`.
- Cookies, local storage, passwords, and request headers are not printed or POSTed by default.
- Use a dedicated browser profile and bind remote debugging to `127.0.0.1`.
- Do not use `--swarm`, `submit`, or hosted dataset commands for private pages.

See [Authenticated page scoring](authenticated-scoring.md) for the fixture smoke and connector limitations.

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

The `hire` command copies `engine/crawler-worker.mjs` (from this package) into `~/.mdvp/crawler/` and runs it. The same browser worker is used for default `audit`, `audit --exact`, live perception, screenshot/video flows, and `audit --swarm`. The static analyzer is used only for `MDVP_USE_CACHE=1 audit --fast`.

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
| `MDVP_BROWSER_URL` | Connect exact local audit to a local Chrome DevTools HTTP endpoint, for example `http://127.0.0.1:9222` |
| `MDVP_BROWSER_WS_ENDPOINT` | Connect exact local audit to a Chrome DevTools websocket endpoint |
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
