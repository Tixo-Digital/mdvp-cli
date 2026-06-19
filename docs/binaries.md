# Standalone Binaries

MDVP does not currently publish a standalone native `mdvp` binary. GitHub Releases publish the npm package tarball plus a SHA256 checksum, and npm remains the supported full CLI distribution.

This page records the packaging decision for future release work so binary artifacts do not overpromise what they contain.

## Decision

The first standalone binary should be a **static-only audit binary**, not the full exact/browser CLI.

- The full CLI stays on npm because default `audit` depends on Node.js and a Chromium-compatible browser runtime for rendered DOM evidence.
- A static-only binary can be useful for low-resource CI, containers, NixOS, and restricted runners, but it must report `source: "static"` and keep the documented static/cache limitations.
- Chromium should remain an external runtime for exact/browser audits. Bundling a launcher without Chromium is not a self-contained exact binary; bundling Chromium makes the artifact large and platform-sensitive.

The current Rust `native/mdvp-static` program is a metrics extractor used by the opt-in static/cache path. It is not yet a user-facing scored `mdvp audit` replacement, so publishing it directly as `mdvp` would be misleading.

## Approach Comparison

| Approach | Fit | Decision |
|---|---|---|
| Node SEA | Can bundle a Node entrypoint, but dynamic command loading, npm package layout, Puppeteer, and browser discovery still need careful work | Defer for the full CLI; reassess after the command graph is SEA-safe |
| `pkg` / `nexe` style packagers | Historically convenient for CLIs, but maintenance and modern ESM/Node compatibility are riskier than the value here | Do not use as the first binary path |
| Native Rust CLI split | Best fit for deterministic static HTML/CSS analysis and future scorer/runtime work | Preferred first binary direction |
| npm tarball-only release assets | Already implemented, reproducible, and honest about requiring Node/browser runtime | Keep as the current full CLI release artifact |
| Platform-specific static archives | Good distribution shape for a future static-only binary | Add after the static binary has a stable user-facing command contract |

## First Artifact Contract

When the static-only binary is promoted to a public artifact, release archives should be platform-specific and checksumed:

```text
mdvp-static-linux-x64.tar.gz
mdvp-static-linux-arm64.tar.gz
mdvp-static-darwin-x64.tar.gz
mdvp-static-darwin-arm64.tar.gz
*.sha256
```

The command contract should be explicit:

```bash
mdvp-static audit https://example.com --json
```

or, if the binary remains stdin-oriented:

```bash
curl -L https://example.com | mdvp-static https://example.com
```

The JSON must include enough provenance for automation to distinguish it from exact/browser output:

```json
{
  "source": "static",
  "analysis": {
    "mode": "static"
  }
}
```

## Release Workflow Requirements

Before adding static binary assets to `.github/workflows/release.yml`, the workflow should be able to smoke each archive shape:

```bash
mdvp-static --help
printf '<html><body><h1>Example</h1></body></html>' | mdvp-static https://example.com
```

If the binary graduates to a scored `audit` command, also smoke:

```bash
mdvp-static audit https://example.com --json
```

Do not attach a binary named `mdvp` unless it can satisfy the documented `mdvp help`, `mdvp stats --json`, and `mdvp audit <url> --json` behavior for its advertised runtime profile. Static-only artifacts must use a static-specific name or clearly documented mode until they reach full CLI parity.

## Exact Browser Constraint

Exact audits require rendered DOM evidence from a browser:

- `getComputedStyle()` values
- client-rendered DOM after JavaScript
- viewport-dependent layout signals
- screenshots, video, and live perception flows

A standalone static binary cannot provide those signals. Users who need exact/browser evidence should keep using npm with a browser runtime, the browser container image, or GitHub Actions runners with Chromium installed.
