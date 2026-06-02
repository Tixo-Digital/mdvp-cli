# Security Policy

## Supported Surface

Security reports for this repository should focus on the public `@mdvp/cli` package and its MCP server:

- Local config handling under `~/.mdvp/config.json`.
- CLI and MCP request behavior.
- API-key handling in environment variables and local config.
- Local crawler setup invoked by `--live`, `submit --local`, `hire`, `apply`, or `serve`.

Hosted API, billing, worker deployment, and private dataset issues are out of scope for this repository.

## Reporting a Vulnerability

Do not open a public issue for secrets, account access problems, auth bypasses, private screenshots, payment data, or crawler data exposure.

Report privately through one of these channels:

- Email: security@tixo.digital
- Website: https://mdvp.dev

Please include:

- Affected command or MCP tool.
- Reproduction steps.
- Impact.
- Whether the issue requires an API key.
- Any logs with secrets redacted.

## Secret Handling

- Never paste API keys into GitHub issues, pull requests, screenshots, or logs.
- Prefer `MDVP_API_KEY` for temporary sessions.
- If you use `mdvp login`, keep `~/.mdvp/config.json` local and out of Git.
- If a key is exposed, revoke it before filing the report.

## Safe Research Boundaries

Only test URLs, accounts, repositories, and systems you own or are authorized to assess. Do not use MDVP to crawl private, authenticated, or third-party pages without permission.
