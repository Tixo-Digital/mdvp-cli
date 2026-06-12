# Roadmap

Public open-source CLI surface only (`@mdvp/cli`). Hosted API infrastructure is separate.

## In progress

- **Validation study** — Spearman ρ between css_health scores and human aesthetic ratings using the [Webthetics](https://github.com/carrenD/Webthetics) public dataset. Script ready at `scripts/compute-correlation.mjs`.
- **perceive --local** — full MDVP-T/1.0 analysis offline (DOM metrics work offline; cloud LLM for text block to be replaced)

## Planned

- **Badge generator** — `npx @mdvp/cli badge mysite.com` → markdown badge for README
- **Watch mode** — `npx @mdvp/cli watch myapp.com --local` — re-scores on file changes during development
- **More vibe-code signals** — expand originality detection as new AI tools emerge (Figma AI, Webflow AI, etc.)
- **MCP resources** — expose score history and dataset entries as MCP resources

## Not planned

- Open-sourcing hosted API, billing, crawler queues, or private datasets
- Storing screenshots or customer data in git
