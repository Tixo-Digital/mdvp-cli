# Contributing to MDVP CLI

Thanks for helping improve MDVP. This repository is the public CLI and MCP server surface for Machine Design Vision Protocol. Keep contributions narrow, reproducible, and useful to agents that need structured visual context.

## Good First Contributions

- Fix CLI help text that does not match command behavior.
- Improve README examples, protocol examples, or MCP setup docs.
- Make error messages clearer without changing command semantics.
- Add smoke tests or fixtures around command parsing and output formatting.
- Improve local crawler setup for Node.js 18+ environments.

## Out of Scope for This Repository

- Production Cloudflare Worker deploys.
- API billing, Stripe, D1, R2, or hosted crawler infrastructure changes.
- Private datasets, customer screenshots, credentials, or tokens.
- Worker, domain, binding, or package-name renames without a linked migration issue.

## Development Setup

```bash
npm install
node ./cli.mjs help
node ./cli.mjs audit stripe.com --json
node ./cli.mjs mcp-config
npm pack --dry-run
```

Use `node ./cli.mjs ...` while developing so you exercise the local checkout instead of a globally installed package.

## Pull Request Checklist

- Keep the changed surface small and explain the user-facing behavior.
- Run `git diff --check`.
- Run relevant smoke checks from the development setup section.
- Do not commit `.env`, `~/.mdvp/config.json`, API keys, screenshots with private data, or crawler output containing third-party private pages.
- Update README or docs when command behavior changes.
- Keep CLI output stable and script-friendly.

## Commit Style

Use direct, factual commit messages. For Tixo-coordinated work, include the GitLab issue reference when one exists, for example:

```text
program#104 document MDVP CLI open-source readiness
```

## Reporting Issues

Open GitHub issues for public CLI bugs, docs gaps, and MCP interoperability problems. Include:

- Command run.
- Node.js version.
- Operating system.
- Expected output.
- Actual output.
- Whether `MDVP_API_KEY` or `~/.mdvp/config.json` was used, without sharing the secret value.
