# MDVP Open-Source Readiness

This brief prepares the public `@mdvp/cli` package for an open-source launch and a Codex for Open Source application.

## Public Artifact

The public artifact should be `@mdvp/cli` at:

- GitHub: https://github.com/Tixo-Digital/mdvp-cli
- Package: `@mdvp/cli`
- Product site: https://mdvp.dev
- Public capability: CLI and MCP server for MDVP-T/1.0 design perception, audit lookup, comparison, crawl submission, and local crawler workflows.

The hosted MDVP API, Cloudflare Workers, billing system, D1/R2 resources, private crawler queues, production secrets, and private datasets should remain separate unless a later issue explicitly sanitizes and releases them.

## Maintainer Story

MDVP gives coding agents a compact visual protocol for web interfaces. Instead of asking an agent to infer design quality from raw HTML or a screenshot alone, MDVP returns structured signals: DOM-derived layout, computed styling, visual complexity, saliency, motion, interaction, token candidates, diagnosis, and recommendations.

For Codex users, the useful open-source surface is:

- `mdvp audit <domain>` for quick score lookup.
- `mdvp perceive <domain> --live` for fresh MDVP-T/1.0 output.
- `mdvp compare <a> <b>` for comparative design context.
- `mdvp mcp` for agent/IDE integration over MCP.
- `mdvp submit <domain> --local` for local crawler execution during development.

## Codex for OSS Fit

OpenAI's Codex for OSS terms say the program is designed to support maintainers of important open-source software and may consider repository usage, ecosystem importance, active maintenance, and maintainer role. MDVP should frame the application around agentic developer workflows:

- The project improves how coding agents inspect, debug, and improve frontends.
- The CLI and MCP server are directly useful inside Codex-like workflows.
- The protocol is text-first, so it fits agent context windows and review comments.
- The tool can reduce subjective UI review by returning reproducible signals.
- Maintainer work involves docs, MCP compatibility, package quality, security handling, and protocol stability.

Do not submit confidential metrics, private customer data, API keys, internal deploy details, or private screenshots in the application.

## Current Readiness

Ready:

- npm package name, binary, repository URL, homepage, license field, and Node.js engine exist.
- CLI help is available through `mdvp help`.
- MCP stdio server is included.
- Public README explains core commands and protocol sections.
- Repository now has license, contribution, security, code-of-conduct, and roadmap files.

Needs follow-up:

- Add package `files`, `bugs`, and `publishConfig` fields after the current `program#101` dirty package changes are reconciled.
- Add command-level tests or smoke scripts.
- Add GitHub issue templates.
- Confirm the GitHub repository visibility and branch protection before launch.
- Confirm that no private screenshots, secrets, local crawler output, or customer data are present in the publish tarball.
- Reconcile local-only `products/mdvp/backend` and `products/mdvp/ui` hosting gaps so public users are not confused about what is open source.

## Package Metadata Target

After `program#101` package changes are resolved, consider this metadata shape:

```json
{
  "bugs": {
    "url": "https://github.com/Tixo-Digital/mdvp-cli/issues"
  },
  "files": [
    "cli.mjs",
    "mcp.mjs",
    "commands",
    "lib",
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "ROADMAP.md",
    "docs"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

## Verification Before Applying

Run from `products/mdvp/cli`:

```bash
git diff --check
node ./cli.mjs help
node ./cli.mjs help audit
node ./cli.mjs help account
node ./cli.mjs help crawler
node ./cli.mjs mcp-config
npm pack --dry-run
```

For a network smoke check, run:

```bash
node ./cli.mjs audit stripe.com --json
```

Skip network checks only when the API is unavailable; record the failure in the issue handoff.

## Application Draft

Use a concise application narrative:

```text
MDVP CLI is an open-source command-line and MCP tool that gives coding agents structured visual context for web interfaces. It converts live pages or dataset entries into MDVP-T/1.0 text blocks covering DOM layout, computed styling, visual complexity, saliency, interaction, tokens, diagnosis, and recommendations. This helps Codex-style agents review frontend work, compare interfaces, and produce more grounded UI fixes without relying on vague visual impressions.

The repository maintained at https://github.com/Tixo-Digital/mdvp-cli is the public artifact. I maintain the CLI, MCP server, docs, protocol examples, local crawler workflow, and package release surface. Hosted API infrastructure, billing, private datasets, and production Workers are intentionally separate from the public package.

Codex Pro would be used to maintain MCP compatibility, improve tests and package quality, write clearer docs, triage public issues, and dogfood MDVP in frontend review workflows.
```

## Launch Checklist

- Public repository visibility confirmed.
- README command examples match actual CLI behavior.
- License and policies present.
- `npm pack --dry-run` reviewed for accidental private files.
- GitHub issues enabled with security redirect.
- Package metadata includes `files`, `bugs`, and public publish config.
- Maintainer application does not include confidential information.
