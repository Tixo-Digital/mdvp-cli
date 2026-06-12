# Install

`@mdvp/cli` ships as a single npm package. Default `audit` needs only Node.js 18+ and network access to the target URL. Chromium is used only for `audit --exact`, live perception, screenshots, video, and crawler-node flows.

## Requirements

| | Minimum | Notes |
|---|---|---|
| Node.js | 18.0 | 20 LTS or 22 recommended |
| RAM | 256 MB | `audit --exact` needs more because it launches a browser |
| Disk | 100 MB | More if you use `--exact` and Puppeteer downloads Chromium |
| Network | HTTPS egress | Required to crawl target URLs |

The package is JavaScript plus a small Rust static analyzer source. If a Rust toolchain is available, the analyzer is compiled into `~/.mdvp/native/mdvp-static` on first use; otherwise the CLI falls back to a no-Chromium JavaScript static analyzer. Puppeteer is installed only when a browser-backed command needs it.

## Install

### Run via `npx` (no install)

```bash
npx @mdvp/cli audit myapp.com
```

Pinned to a version:

```bash
npx @mdvp/cli@1.31.4 audit myapp.com
```

### Install globally

```bash
npm i -g @mdvp/cli
mdvp audit myapp.com
```

### Install in a project

```bash
npm i -D @mdvp/cli
npx mdvp audit myapp.com
```

## First run

The first default audit does not download Chromium. If `cargo` is available, it may compile the static Rust analyzer once into `~/.mdvp/native/mdvp-static`; subsequent static audits reuse that binary.

The first `--exact`, `perceive --live`, `submit`, or crawler-node run may download Puppeteer's bundled Chromium (~150 MB, cached at `~/.cache/puppeteer/`). To skip that download and use your system Chrome instead:

```bash
PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  npx @mdvp/cli audit myapp.com --exact
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

**Puppeteer download blocked** — default `audit` does not need Puppeteer. For `--exact` or screenshot/video flows, set `PUPPETEER_DOWNLOAD_BASE_URL` to an internal mirror, or use `PUPPETEER_EXECUTABLE_PATH` to point at an existing browser.

**Permission errors on `~/.cache/puppeteer`** — set `PUPPETEER_CACHE_DIR` to a writable location.

**Sandbox / no-sandbox** — on minimal containers, pass `--no-sandbox` via the env var `MDVP_PUPPETEER_ARGS='["--no-sandbox"]'`.

**Slow first exact crawl** — the URL itself may be slow; the bundled timeout is 60s. Use `--timeout=120000` for heavy SPAs.

## Next

- [All commands](cli.md)
- [Scoring methodology](scoring.md)
- [MCP server](mcp-server.md)
