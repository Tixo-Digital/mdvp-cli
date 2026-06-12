# Install

`@mdvp/cli` ships as a single npm package. No system dependencies beyond Node.js 18+ and a Chromium binary (installed automatically on first run).

## Requirements

| | Minimum | Notes |
|---|---|---|
| Node.js | 18.0 | 20 LTS or 22 recommended |
| RAM | 1 GB | Headless Chromium needs ~300 MB |
| Disk | 400 MB | First run downloads Puppeteer's Chromium |
| Network | HTTPS egress | Required to crawl target URLs |

The package is pure JavaScript with one runtime dependency (`@modelcontextprotocol/sdk`) and one peer (Puppeteer, installed on first `audit --local` run).

## Install

### Run via `npx` (no install)

```bash
npx @mdvp/cli audit myapp.com --local
```

Pinned to a version:

```bash
npx @mdvp/cli@1.31.4 audit myapp.com --local
```

### Install globally

```bash
npm i -g @mdvp/cli
mdvp audit myapp.com --local
```

### Install in a project

```bash
npm i -D @mdvp/cli
npx mdvp audit myapp.com --local
```

## First run

The first `--local` audit downloads Puppeteer's bundled Chromium (~150 MB, cached at `~/.cache/puppeteer/`). Subsequent runs reuse the cache.

To skip the download and use your system Chrome instead:

```bash
PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  npx @mdvp/cli audit myapp.com --local
```

## Verify

```bash
npx @mdvp/cli --version
node --test   # in the cloned repo: runs 89 unit tests
```

## Upgrading

```bash
npm i -g @mdvp/cli@latest
```

Releases follow [semver](https://semver.org). The [CHANGELOG](../CHANGELOG.md) is the source of truth for breaking changes.

## Troubleshooting

**Puppeteer download blocked** — set `PUPPETEER_DOWNLOAD_BASE_URL` to an internal mirror, or use `PUPPETEER_EXECUTABLE_PATH` to point at an existing browser.

**Permission errors on `~/.cache/puppeteer`** — set `PUPPETEER_CACHE_DIR` to a writable location.

**Sandbox / no-sandbox** — on minimal containers, pass `--no-sandbox` via the env var `MDVP_PUPPETEER_ARGS='["--no-sandbox"]'`.

**Slow first crawl** — the URL itself may be slow, and the first run also has to warm the Chromium cache. Re-run once after the browser install completes; if a heavy SPA still times out, file an issue with the URL and local environment details.

## Next

- [All commands](cli.md)
- [Scoring methodology](scoring.md)
- [MCP server](mcp-server.md)
