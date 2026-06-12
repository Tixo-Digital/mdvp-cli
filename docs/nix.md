# Nix

MDVP ships both `devbox.json` and `flake.nix`:

| Tool | Use when | What it provides |
|---|---|---|
| Devbox | automation runners and contributors who want a single command | Node 22, Git, GitHub/GitLab CLIs, jq, Chromium on supported Linux platforms |
| Nix flake | NixOS, macOS with Nix, or teams standardizing on `nix develop` | Node 22 dev shell plus reproducible verify/smoke apps |

## Dev Shell

```bash
nix develop
```

The shell provides Node 22, Git, and jq. On Linux it also includes Chromium and exports `PUPPETEER_EXECUTABLE_PATH` when Chromium is available.

## Checks

Run the same local verification baseline through Nix:

```bash
nix run .#verify
```

This runs:

```bash
npm ci
npm test
npm pack --dry-run
```

Smoke commands:

```bash
nix run .#smoke
nix run .#static-audit
nix run .#static-audit -- example.com
```

`static-audit` sets `MDVP_USE_CACHE=1` and therefore does not need Chromium.

## Browser Audits

Default exact audits need Chromium-compatible browser support. On Linux, the flake dev shell includes Chromium from nixpkgs:

```bash
nix develop
node cli.mjs audit mdvp.dev --json
```

On Apple Silicon macOS, current nixpkgs does not provide the same Chromium path used by the Linux shell. Use a host browser:

```bash
PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  nix run .#smoke
```

For exact/browser behavior on Linux, prefer CI or a Linux container with browser dependencies.

## OCI Images With Nix

Nix can build OCI/Docker-compatible images via `dockerTools`, but Linux images should be built on a Linux builder. From macOS, use a remote Linux builder or keep using the checked-in `containers/static/Containerfile` with Apple Container/Docker/Podman.

The repository keeps the static image recipe as a `Containerfile` because it is the most portable path across Apple Container, Docker-compatible builders, Podman, and Buildah. Use Nix for reproducible local development and verification; use the Containerfile for portable image builds.
