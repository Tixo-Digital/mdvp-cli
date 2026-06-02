# CLI commands

Every command in `@mdvp/cli` v1.31+. All cloud commands (`audit`, `compare`, `top`, `worst`, `perceive`, `submit`, `recrawl`) read the API key from `MDVP_API_KEY` env var or `~/.mdvp/config.json`; offline commands (`--local`) need no key.

## Audit

Score a single URL.

```bash
# Offline — runs Puppeteer locally, no network except the target URL
npx @mdvp/cli audit myapp.com --local

# Cloud — instant lookup from the public dataset (needs API key, no Puppeteer)
npx @mdvp/cli audit myapp.com
```

Flags:

| Flag | What it does |
|---|---|
| `--local` | Run Puppeteer locally instead of querying the dataset |
| `--check` | Enforce `.mdvprc` thresholds and DESIGN.md spec, exit 1 on violation |
| `--json` | Emit machine-readable JSON |
| `--design=PATH` | Diff against a specific DESIGN.md file |
| `--timeout=MS` | Navigation timeout for `--local` (default 60000) |
| `--no-vision` | Skip VLM analysis on the cloud `perceive` command |
| `--no-header` | Suppress the ASCII banner in CLI output |
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
  · Inter + Tailwind purple-blue palette — AI-generated design fingerprint
```

## Compare

Side-by-side comparison of two domains:

```bash
npx @mdvp/cli compare figma.com linear.app
npx @mdvp/cli compare figma.com linear.app --json
```

## Top / worst

Dataset leaderboard.

```bash
npx @mdvp/cli top                # top 10
npx @mdvp/cli top 25             # top 25
npx @mdvp/cli worst              # worst 10
npx @mdvp/cli top --label=premium
```

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

`--local` submits the locally-crawled result without using a remote crawl slot.

## Hire

Become a crawler node — contributes compute to the public dataset. No API key required.

```bash
npx @mdvp/cli hire               # interactive, 2 parallel tabs
npx @mdvp/cli hire --tabs=4      # more throughput
npx @mdvp/cli hire --daemon      # background process
```

The `hire` command copies `engine/crawler-worker.mjs` (from this package) into `~/.mdvp/crawler/` and runs it. The same source file also runs when you do `audit --local`.

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

The key is used for cloud commands and `submit`. The local `--local` mode never touches the network for anything except the target URL itself.

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
