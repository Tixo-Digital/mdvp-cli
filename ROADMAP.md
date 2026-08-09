# Roadmap

Public open-source CLI surface only (`@mdvp/cli`). Hosted API infrastructure is separate.

## Shipped in the public CLI

- **Rendered local audit default** - `npx @mdvp/cli audit mysite.com` runs locally with rendered-DOM evidence and no API key.
- **CI onboarding** - `npx @mdvp/cli init --github-action` creates starter threshold config and a GitHub Actions workflow.
- **Score badge generator** - `npx @mdvp/cli badge mysite.com` prints README-ready shields.io markdown.
- **Snapshot diff** - `npx @mdvp/cli diff before.json after.json` compares saved audit JSON for reviewable score changes.
- **MCP server** - `npx @mdvp/cli mcp` exposes design-quality tools to agent clients.
- **Authenticated local scoring prototype** - exact audits can connect to a developer-owned Chrome session for logged-in local or staging pages.

## Current work

- **Validation study** — Spearman ρ between css_health scores and human aesthetic ratings using the [Webthetics](https://github.com/carrenD/Webthetics) public dataset. Script ready at `scripts/compute-correlation.mjs`.
- **perceive --local** — full MDVP-T/1.0 analysis offline (DOM metrics work offline; cloud LLM for text block to be replaced)
- **Signal detector expansion** - continue adding explainable generated-UI detectors with tests, docs, and before/after examples.

## Next public CLI improvements

- **Watch mode** - `npx @mdvp/cli watch myapp.com` re-scores on file changes during development.
- **MCP resources** - expose score history and local snapshot entries as MCP resources without requiring hosted infrastructure.
- **Release artifact polish** - static-only standalone binary archives for low-resource environments while keeping the full exact/browser CLI on npm.
- **Actionable signal requests** - turn recurring user reports into small signal-detector issues with evidence, acceptance criteria, and fixture guidance.

## Not planned

- Open-sourcing hosted API, billing, crawler queues, or private datasets
- Storing screenshots or customer data in git
