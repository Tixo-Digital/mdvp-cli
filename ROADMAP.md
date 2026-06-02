# MDVP CLI Roadmap

This roadmap describes the public open-source CLI surface, not the hosted API or production worker infrastructure.

## Now

- Keep `@mdvp/cli` installable through npm and runnable with Node.js 18+.
- Keep `mdvp help` aligned with implemented commands.
- Support score lookup, protocol perception, site comparison, MCP stdio, remote submit, and local crawler workflows.
- Document API-key handling and local config behavior.

## Next

- Add command-level smoke tests for help, MCP config generation, and no-key error paths.
- Add package metadata hardening once the current checkout analytics branch is reconciled: `files`, `bugs`, `publishConfig`, and explicit package smoke scripts.
- Publish a stable MDVP-T/1.0 protocol fixture set for CLI docs and tests.
- Improve offline-friendly examples for contributors without MDVP credits.
- Add a public issue template for CLI bugs, MCP bugs, docs gaps, and security redirects.

## Later

- Version protocol examples separately from CLI release numbers.
- Add compatibility notes for Codex, Claude Desktop, Cursor, and other MCP clients.
- Add optional local-only analysis mode that does not depend on private hosted data.
- Publish a maintainer guide for triaging CLI issues and release candidates.

## Not Planned in This Repository

- Open-sourcing billing, production Cloudflare Workers, private crawler queues, private datasets, or payment-webhook code.
- Renaming production Workers, D1 databases, domains, service bindings, or npm package identity without a dedicated migration issue.
- Storing third-party screenshots, private crawls, or customer data in Git.
