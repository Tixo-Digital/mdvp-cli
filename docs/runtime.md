# Runtime Direction

The performance target is simple: `audit` should feel like a linter. A warm local audit should be close to one second on simple or already-cached pages, and slow pages should make the bottleneck obvious.

## Current Decision

Use a static analyzer as the default audit path, and reserve the browser crawler for exact or artifact-producing flows.

Rust is the preferred native direction for future CPU-bound runtime work because the scoring engine is deterministic, data-oriented, and a good fit for a small native library or CLI binary. Go is viable for services and orchestration, but Rust is the better first native boundary for a scorer/runtime that may later ship as npm platform binaries.

Do not wrap Chromium in Rust or Go and call that the fix. Chromium startup, page navigation, remote network latency, and JS-rendered page readiness dominate wall-clock time. The low-memory win comes from not launching a browser on the default path.

## No-Chromium Strategy

Do not silently replace the rendered crawler with a fake browser. MDVP currently scores the rendered DOM with browser-computed CSS. That is the correct mode for `perceive`, screenshots, viewport checks, JS-rendered apps, and any result that claims exact computed styles.

The low-memory path is a separate static audit runtime:

1. Fetch HTML and same-origin CSS without launching a browser.
2. Parse HTML with a browser-grade Rust HTML parser.
3. Parse CSS with a browser-grade Rust CSS parser.
4. Score design-system signals that are safe without layout: tokens, font declarations, color systems, radius/spacing scales, utility-class density, framework fingerprints, metadata, and selector complexity.
5. Return the same top-level audit shape with `source: "static"` and a confidence field, while marking unavailable rendered-only dimensions as limited.

This gives users a cheap default for CI and local iteration without pretending it is equivalent to a real browser crawl.

Modes:

- `audit` / `audit --fast`: static analyzer, no Chromium.
- `audit --exact`: rendered DOM audit through the browser path with fast shortcuts disabled.
- `perceive` and screenshot-producing flows: full browser path.

Rejected shortcuts:

- DOM emulators such as jsdom or happy-dom are lower-memory, but they do not provide enough layout, rendering, and `getComputedStyle` parity for exact MDVP scoring.
- Servo is the right family of Rust technology to watch, but embedding a browser engine is still a heavier runtime than a static analyzer and should not be the first npm adoption fix.
- Go is fine for networking and service code, but Rust has stronger parser/runtime options for the first static analyzer boundary.

## What Changed First

Plain local `audit` now uses the static analyzer and returns `source: "static"` with an `analysis` limitations block. The browser crawler is still used by `audit --exact`, `perceive`, screenshots, video, and swarm/public contribution flows.

Artifact-heavy crawling remains available where screenshots and richer page artifacts are the product.

## Native Runtime Boundary

The first native boundary should be one of these:

1. **Static analyzer:** Rust binary for HTML/CSS parsing + safe no-layout scoring. Node owns network fetches; Rust owns metric extraction.
2. **Scorer library:** port `engine/scorer.mjs`, color science, threshold checks, and signal aggregation to Rust, called from Node or shipped as a native CLI.
3. **Packed CLI shell:** keep browser crawling in JS/Puppeteer or Playwright for exact mode, but move scoring and output formatting into a native binary after the metrics JSON is captured.
4. **Later browser replacement:** evaluate browser-control alternatives only after metrics-only audit is fast, because replacing Puppeteer does not remove network and page-render waits.

## Non-Goals

- No hard 1s guarantee for arbitrary remote URLs.
- No native binary publish in this spike.
- No loss of existing JSON/text output shapes.
- No claim that static audit is equivalent to a rendered browser audit.

## Measurement

Run:

```bash
node scripts/measure-audit-perf.mjs mdvp.dev
node scripts/measure-audit-perf.mjs mdvp.dev --exact --memory
```

The script reports `help`, `top 5`, `stats --json`, and warm local `audit --json` timings. Add `--memory` to capture peak RSS on platforms with `/usr/bin/time`.

Use it before and after runtime changes, and publish both latency and memory results in performance PRs.
