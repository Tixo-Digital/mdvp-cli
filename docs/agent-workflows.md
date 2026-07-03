# Agent Workflows

This guide is for coding agents, editor assistants, and CI bots that use MDVP as a design-quality signal while changing frontend code.

MDVP is not a taste oracle. Treat it like a rendered-DOM linter: it reports repeatable signals about color, type, spacing, structure, contrast risk, design-token usage, and common generated-UI patterns. Use the score to find concrete follow-up work, then cite the specific evidence in your handoff.

## Operating Model

1. Preflight the local runtime before the first crawl:

```bash
npx @mdvp/cli doctor
```

2. Audit the target page with the default rendered browser path:

```bash
npx @mdvp/cli audit https://preview.example.com
```

3. Use JSON when another tool or script needs to decide what to do next:

```bash
npx @mdvp/cli audit https://preview.example.com --json
```

4. Gate a pull request only after thresholds are explicit in the repository:

```bash
npx @mdvp/cli init --github-action
npx @mdvp/cli audit https://preview.example.com --check
```

5. Expose the same scoring surface to MCP-compatible agents:

```bash
npx @mdvp/cli mcp-config
npx @mdvp/cli mcp
```

## What To Report

Good agent handoffs mention the score, source, weakest component, and one or two fixable findings:

```text
MDVP audit: B 71/100, source=local.
Weakest component: originality 52.
Fix next: reduce default Tailwind purple-blue gradient usage and consolidate 4 font families to 2 or fewer.
```

Avoid reporting only the overall score. A score without the component breakdown does not tell a maintainer what to change.

## JSON Consumption

For automation, read stable top-level fields first:

```bash
npx @mdvp/cli audit https://preview.example.com --json \
  | jq '{score: .overall_score, grade: .grade, source: .source, components: .components}'
```

Use `source` to distinguish evidence paths:

- `local`: rendered browser audit, the default and most defensible path.
- `static`: approximate shortcut from `MDVP_USE_CACHE=1 --fast`.
- `cloud`: public dataset lookup from `--cloud`.
- `swarm`: local audit that also contributes the result to the public dataset.

When the target page is private, do not use `--swarm`, `submit`, or hosted dataset commands. Keep the default local audit path, or connect to a dedicated Chrome profile with `MDVP_BROWSER_URL`.

## Fix Loop

Use MDVP after each visible frontend change, not after every code edit:

1. Run the app or deploy a preview URL.
2. Run `npx @mdvp/cli audit <url> --json`.
3. Pick the lowest component and the most concrete finding.
4. Patch the UI.
5. Re-run the same command and compare the score plus component deltas.

For saved snapshots, use:

```bash
npx @mdvp/cli diff before.json after.json
```

## MCP Tool Choice

When MDVP is available through MCP:

- Start with `audit_url` for a fast score.
- Use `perceive_url` when the user asks for deeper design perception or recommendations.
- Use `compare_sites` only when the user explicitly wants a side-by-side comparison.
- Use `top_sites` for examples or calibration.
- Do not call `submit_for_crawl` unless the user wants to add a public URL to the dataset.

## Safety Boundaries

- Do not claim MDVP proves a design is good or bad universally.
- Do not upload private app pages to public dataset commands.
- Do not hide the runtime source; say whether the result was local, static, cloud, or swarm.
- Do not block a release on a new threshold unless the repository has opted into that threshold.
- Do not ask for stars. Convert useful feedback into issues, docs, signals, or tests.

## Related Docs

- [CLI commands](cli.md)
- [MCP server](mcp-server.md)
- [Authenticated page scoring](authenticated-scoring.md)
- [CI enforcement](ci.md)
- [Scoring](scoring.md)
