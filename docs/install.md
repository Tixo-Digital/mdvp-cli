# Install

`@mdvp/cli` ships as a single npm package. Default `audit` needs Node.js 18+, network access to the target URL, and a browser runtime for the exact rendered audit. The no-Chromium static analyzer is available only when you opt into static/cache shortcuts with `MDVP_USE_CACHE=1`; use `--fast` in scripts to make that shortcut explicit.

## Requirements

| | Minimum | Notes |
|---|---|---|
| Node.js | 18.0 | 20 LTS or 22 recommended |
| RAM | 256 MB | Default `audit` launches a browser; static/cache shortcuts use less |
| Disk | 100 MB | More if Puppeteer downloads Chromium |
| Network | HTTPS egress | Required to crawl target URLs |

The package is JavaScript plus a small Rust static analyzer source. Default `audit` uses the browser-backed crawler. If you run `MDVP_USE_CACHE=1 mdvp audit <url> --fast`, and a Rust toolchain is available, the static analyzer is compiled into `~/.mdvp/native/mdvp-static` on first static use; otherwise the CLI falls back to a no-Chromium JavaScript static analyzer.

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

### Download from GitHub Releases

GitHub Releases include the npm package tarball and a SHA256 checksum:

```bash
npm i -g ./mdvp-cli-<version>.tgz
mdvp audit myapp.com
```

The release tarball is downloadable and reproducible, but it is not a standalone native binary. It still requires Node.js 18+ and, for default exact audits, a browser runtime.

Standalone binary artifacts are being scoped as static-only release assets first, not as a replacement for the full exact/browser CLI. See [Standalone binaries](binaries.md) for the packaging decision, platform archive plan, and Chromium constraints.

## First run

The first default audit may download Puppeteer's bundled Chromium (~150 MB, cached at `~/.cache/puppeteer/`) if no compatible browser is already available. To skip that download and use your system Chrome instead:

```bash
PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  npx @mdvp/cli audit myapp.com
```

The static/cache shortcut does not download Chromium. The env var is the actual opt-in; `--fast` makes it visible in scripts:

```bash
MDVP_USE_CACHE=1 npx @mdvp/cli audit myapp.com --fast
```

If `cargo` is available, that first static shortcut may compile the Rust analyzer once into `~/.mdvp/native/mdvp-static`; subsequent static audits reuse that binary.

Before a first audit in a new shell, CI runner, or container, run:

```bash
npx @mdvp/cli doctor
```

`doctor` does not crawl a URL or download Chromium. It checks Node.js, npm, browser overrides, common Chrome/Chromium paths, cache writability, static/cache mode, and optional cargo availability, then exits nonzero only for blocking local prerequisites.

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

**Puppeteer download blocked** — default `audit` uses the browser-backed exact path. Set `PUPPETEER_DOWNLOAD_BASE_URL` to an internal mirror, use `PUPPETEER_EXECUTABLE_PATH` to point at an existing browser, or opt into the approximate static/cache shortcut with `MDVP_USE_CACHE=1 --fast`.

**Minimal containers** — Alpine, Debian slim, and distroless images usually do not include npm, unzip, Chromium, or browser shared libraries. Use the static/cache profile (`MDVP_USE_CACHE=1 --fast`) or a browser-equipped image for exact mode. See [Containers](container.md).

**Permission errors on `~/.cache/puppeteer`** — set `PUPPETEER_CACHE_DIR` to a writable location.

**Sandbox / no-sandbox** — on minimal containers, pass `--no-sandbox` via the env var `MDVP_PUPPETEER_ARGS='["--no-sandbox"]'`.

**Slow first crawl** — the URL itself may be slow, and the first browser-backed run may warm the Chromium cache. Re-run once after the browser install completes; if a heavy SPA still times out, use `--timeout=120000` and file an issue with the URL and local environment details.

## Next

- [All commands](cli.md)
- [Scoring methodology](scoring.md)
- [MCP server](mcp-server.md)
