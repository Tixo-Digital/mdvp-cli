# Containers

MDVP has two container-friendly runtime profiles:

| Profile | Use for | Browser | Typical image size |
|---|---|---:|---:|
| Static/cache | fast CI loops, low-memory runners, Docker/Apple Container/Nix smoke checks | no | small |
| Exact/browser | rendered DOM evidence, JS apps, disputed scores, screenshots | yes | large |

## Format Choice

There is no newer universal build-file syntax that replaces Dockerfile syntax. The portable artifact is the OCI image. Apple `container` consumes and produces OCI-compatible images, and Podman/Buildah use `Containerfile` as the neutral name for the same Dockerfile instruction syntax.

For MDVP, the canonical recipes are therefore:

```text
containers/static/Containerfile
containers/browser/Containerfile
```

Use it with Apple Container:

```bash
container build -t mdvp-cli-static:latest containers/static
container build -f containers/browser/Containerfile -t mdvp-cli-browser:latest containers/browser
```

Use the same files with Docker-compatible builders:

```bash
docker build -f containers/static/Containerfile -t mdvp-cli-static:latest containers/static
docker build -f containers/browser/Containerfile -t mdvp-cli-browser:latest containers/browser
```

Use the same file with Podman:

```bash
podman build -f containers/static/Containerfile -t mdvp-cli-static:latest containers/static
podman build -f containers/browser/Containerfile -t mdvp-cli-browser:latest containers/browser
```

Keeping the file named `Containerfile` avoids tying the recipe to Docker Desktop while staying compatible with Docker, Podman, Buildah, and Apple Container. Docker compatibility is syntax-level and build-level; older Docker engines may not auto-discover a file named `Containerfile`, so pass `-f containers/.../Containerfile` as shown above.

The default CLI command outside containers is exact/browser:

```bash
npx @mdvp/cli audit mdvp.dev
```

Minimal containers usually do not include npm, unzip, Chromium, shared browser libraries, or enough `/dev/shm` for a browser. For those environments, use the explicit static/cache profile:

```bash
MDVP_USE_CACHE=1 npx @mdvp/cli audit mdvp.dev --fast --json
```

## Lightweight Static Image

This repository includes the distroless static image recipe above:

```bash
container build \
  -t mdvp-cli-static:latest \
  --build-arg MDVP_VERSION=latest \
  containers/static
```

Docker-compatible engines can use the same file:

```bash
docker build \
  -f containers/static/Containerfile \
  -t mdvp-cli-static:latest \
  --build-arg MDVP_VERSION=latest \
  containers/static
```

Run it:

```bash
container run --rm mdvp-cli-static:latest help
container run --rm mdvp-cli-static:latest audit mdvp.dev --json
```

The image sets `MDVP_USE_CACHE=1`, runs as the distroless `nonroot` user, and has no shell, npm, Puppeteer, or browser. JSON output is marked with:

```json
{
  "source": "static",
  "analysis": {
    "mode": "static"
  }
}
```

Use this image when you want a small scoring container and accept the documented static limitations: no browser layout, no computed styles, no client-rendered DOM after JavaScript, and no screenshots or motion artifacts.

## Exact Browser Containers

Exact mode needs a Chromium-compatible browser runtime. A minimal Node image is not enough.

This repository also includes a browser image recipe:

```bash
container build \
  -f containers/browser/Containerfile \
  -t mdvp-cli-browser:latest \
  --build-arg MDVP_VERSION=latest \
  containers/browser
```

Docker-compatible engines can use the same file:

```bash
docker build \
  -f containers/browser/Containerfile \
  -t mdvp-cli-browser:latest \
  --build-arg MDVP_VERSION=latest \
  containers/browser
```

Run exact mode:

```bash
container run --rm mdvp-cli-browser:latest audit mdvp.dev --json
container run --rm mdvp-cli-browser:latest audit mdvp.dev --exact --json
```

The browser image installs Debian Chromium and pre-installs Puppeteer into `/home/node/.mdvp/crawler` with `PUPPETEER_SKIP_DOWNLOAD=true`, so first run does not download Puppeteer's bundled Chrome. It sets `MDVP_PUPPETEER_ARGS='["--no-sandbox","--disable-dev-shm-usage"]'` for common CI/container runtimes.

Use this image when you need rendered DOM evidence, screenshots, JS apps, or disputed scores. Do not expect it to be small; Chromium and browser shared libraries dominate the image size. On Apple Container linux/arm64, the browser recipe was observed at about 357 MB, versus about 53 MB for the distroless static recipe.

For Debian/Ubuntu-style images, install browser dependencies and either:

- set `PUPPETEER_EXECUTABLE_PATH` to a preinstalled Chrome/Chromium binary, or
- allow Puppeteer to download Chrome and include extraction tools such as `unzip`.

For root containers, pass no-sandbox args:

```bash
MDVP_PUPPETEER_ARGS='["--no-sandbox"]' npx @mdvp/cli audit mdvp.dev --json
```

If you need exact mode in CI, prefer a browser-equipped base image over trying to keep the image tiny. Browser images are often hundreds of MB because Chromium and system libraries dominate the size.

## Runtime Matrix

Observed behavior for `@mdvp/cli@1.34.1`:

| Environment | `help` | `MDVP_USE_CACHE=1 audit --json` | default exact `audit --json` |
|---|---:|---:|---:|
| macOS npm, fresh home | pass | pass | pass |
| Nix Node 20/22 on macOS | pass | pass | not a Linux container test |
| Apple Container `node:22-alpine` | pass | pass with JS static fallback | not recommended; bundled Chrome on Alpine is not a supported target |
| Apple Container `node:22-bookworm-slim` | pass | pass with JS static fallback | fails unless image includes extraction/browser dependencies |
| Apple Container distroless static recipe | pass | pass with JS static fallback | out of scope; no npm/browser by design |
| Apple Container browser recipe | pass | pass | pass with `source: "local"`, but large |
| Browser-equipped amd64 image via Apple Container Rosetta | pass | pass | pass, but large |

The distroless static recipe intentionally optimizes for the second column. Do not use it for `--exact`, `perceive --live`, screenshot capture, video, or authenticated browser sessions.

## Nix And Devbox

The checked-in `devbox.json` pins Node, git, GitHub/GitLab CLIs, jq, and Chromium where the platform supports it. The checked-in `flake.nix` provides native Nix commands for NixOS and non-devbox environments. Use:

```bash
devbox run verify
devbox run smoke
devbox run audit-smoke
nix run .#verify
nix run .#smoke
nix run .#static-audit
```

On Apple Silicon macOS, Chromium is excluded from devbox because current nixpkgs does not provide a compatible Chromium build for that platform. Use the host browser with `PUPPETEER_EXECUTABLE_PATH` or test Linux browser behavior in a container or CI runner. See [Nix](nix.md) for flake details.
