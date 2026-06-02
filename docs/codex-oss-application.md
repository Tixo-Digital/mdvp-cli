# Codex for Open Source — Application Draft

Application for the OpenAI Codex for Open Source program.

**Repository:** https://github.com/Tixo-Digital/mdvp-cli  
**Package:** `@mdvp/cli` on npm  
**Site:** https://mdvp.dev

---

## Project description

`@mdvp/cli` is an open-source command-line tool and MCP server that gives coding agents structured visual context for web interfaces. Instead of asking an agent to infer design quality from raw HTML or a screenshot alone, MDVP returns deterministic, structured signals: CSS metrics, entropy analysis, APCA contrast, and component scores — packaged as a compact text block that fits agent context windows.

The core use case is frontend quality gates in AI-assisted development. Teams using v0, Bolt, Lovable, or Cursor to generate UIs have no existing tool to enforce design consistency in CI — visual regression requires a baseline, linters check syntax not rendered quality, and no standard exists for "this page has too many font sizes." MDVP fills this gap: it runs locally with no API key, scores a live URL in under 60 seconds, and exits 1 on configurable violations.

```bash
# Install once, run on any URL
npx @mdvp/cli audit myapp.com --local --check

# In CI (GitHub Action)
- uses: Tixo-Digital/mdvp-cli/action@main
  with:
    url: https://preview.myapp.com
    max_colors: 20
    min_css_health: 65
```

**What makes it useful for Codex users specifically:**

Codex agents review and modify frontend code. When they propose a UI change, the natural next question is "did this make the design better or worse?" MDVP answers that question with a number. The MCP server (`npx @mdvp/cli mcp`) exposes the scoring engine directly to agents — they can call `audit` as a tool, get back a structured report, and use it to validate their own changes.

---

## What's in the repository

The public `@mdvp/cli` package contains:

- **`engine/`** — bundled scoring engine (pure ESM, zero npm dependencies beyond puppeteer for crawling)
  - `scorer.mjs` — 12-category Shannon-entropy + heuristic scoring algorithm
  - `color-science.mjs` — Oklab color space, APCA contrast, palette analysis
  - `thresholds.mjs` — `.mdvprc` config loader and CI violation checker
  - `crawler-worker.mjs` — Puppeteer orchestrator for local crawls
- **`commands/`** — CLI commands: `audit`, `compare`, `perceive`, `submit`
- **`mcp.mjs`** — MCP stdio server (compatible with Claude, Cursor, and any MCP client)
- **`action/`** — GitHub composite Action for CI integration
- **`test/`** — 61 unit tests using Node.js built-in test runner (no test framework)

The hosted API, Cloudflare Workers infrastructure, billing system, and private crawler queues are intentionally separate from the public package.

---

## Maintenance scope

Active maintenance involves:

- **MCP compatibility** — tracking changes in the MCP SDK (`@modelcontextprotocol/sdk`) and maintaining protocol compatibility with Claude, Cursor, and other MCP clients
- **Scoring algorithm** — calibrating heuristics as new AI-generated UI patterns emerge (new Shadcn components, new Tailwind defaults, new AI coding tool output)
- **CI reliability** — Puppeteer and Chromium version compatibility across Node 18/20/22 and GitHub-hosted runners
- **Package quality** — changelog, semantic versioning, security advisories, issue triage
- **Documentation** — methodology transparency (validation study planned, see `docs/validation-study.md`)

---

## How Codex Pro would be used

1. **MCP tool maintenance** — MCP is an evolving protocol. Codex would help maintain compatibility as the SDK changes and new client capabilities are added (sampling, resources, prompts).

2. **Scoring calibration** — the vibe-code detection heuristics need regular updates as AI tools evolve. Codex would help analyze new tool outputs, identify new fingerprint signals, and update the penalty weights.

3. **Test expansion** — the current 61 tests cover the core engine. Codex would help expand coverage to edge cases (malformed metrics, extreme color counts, international sites).

4. **Issue triage** — public GitHub issues from external contributors need review, reproduction, and fixes. Codex would accelerate the turnaround.

5. **Dogfooding** — using MDVP inside Codex workflows to validate UI changes would surface real-world issues and drive roadmap prioritization.

---

## Why this qualifies

- **Active public repository** with CI, tests, documented methodology, and changelog
- **Real utility for AI-assisted development** — the exact workflow Codex is designed for
- **Open protocol** (MIT license, no gating of core functionality behind API key)
- **MCP native** — works today as a tool inside Codex-compatible agents
- **Zero vendor lock-in** — local mode requires no account, no credits, no internet connection after install

---

## Application text (short form)

> `@mdvp/cli` gives coding agents a design quality signal for any live URL — CSS entropy analysis, APCA contrast, AI-pattern detection — packaged as a CLI and MCP server. Local mode runs fully offline via Puppeteer; a GitHub Action provides CI enforcement. The tool directly serves AI-assisted frontend development workflows: agents can call `audit` as an MCP tool, get a structured score, and validate their own UI changes. Maintained actively with 61 unit tests, CI on Node 18/20/22, and documented methodology. Codex Pro would be used to maintain MCP compatibility, expand test coverage, calibrate the AI-pattern detection heuristics as new tools emerge, and dogfood MDVP in frontend review loops.
