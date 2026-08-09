# MCP server

`@mdvp/cli` ships a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible agent — Claude, Cursor, OpenCode, Windsurf, Cline, Continue — can score URLs, get the full design perception, inspect MDVP's built-in signal catalog, and submit sites to the dataset, with no API key for the public-dataset paths.

## Run the server

```bash
npx @mdvp/cli mcp
```

The server speaks stdio transport. Most clients launch it as a subprocess.

## Configure your client

The exact config location and JSON shape varies per client, but the command is always the same:

```bash
npx -y @mdvp/cli@latest mcp
```

### Claude Desktop

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

```json
{
  "mcpServers": {
    "mdvp": {
      "command": "npx",
      "args": ["-y", "@mdvp/cli@latest", "mcp"]
    }
  }
}
```

### OpenCode

Config file: `opencode.json` (project) or `~/.config/opencode/opencode.json` (global).

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mdvp": {
      "type": "local",
      "command": ["npx", "-y", "@mdvp/cli@latest", "mcp"]
    }
  }
}
```

### Cursor

Config file: `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global).

```json
{
  "mcpServers": {
    "mdvp": {
      "command": "npx",
      "args": ["-y", "@mdvp/cli@latest", "mcp"]
    }
  }
}
```

### Windsurf

Config file: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "mdvp": {
      "command": "npx",
      "args": ["-y", "@mdvp/cli@latest", "mcp"]
    }
  }
}
```

### Cline / Continue / other clients

Any MCP client that supports stdio can use:

```
command: npx
args: ["-y", "@mdvp/cli@latest", "mcp"]
```

Print a copy-pasteable config snippet for your editor via:

```bash
npx @mdvp/cli mcp-config
```

## Authentication

The server reads the API key (in order):

1. `MDVP_API_KEY` environment variable
2. `~/.mdvp/config.json` (set via `npx @mdvp/cli login`)

The `audit_url`, `perceive_url`, `top_sites`, and `compare_sites` tools work **without a key** against the public dataset. `submit_for_crawl` requires one.

## Tools

| Tool | Auth | What it does |
|---|---|---|
| `audit_url` | — | Score a URL across 12 design dimensions (grade A+–F, 0–100). |
| `perceive_url` | — | Full MDVP-T/1.0 perception — DOM, entropy, saliency, motion, classify, recommendations. |
| `compare_sites` | — | Side-by-side comparison of two domains. |
| `top_sites` | — | Top / worst sites by label (`premium`, `good`, `vibecoded`, `bad`). |
| `get_page_content` | — | Markdown of the page with embedded MDVP scores. |
| `submit_for_crawl` | key | Submit a URL — adds it to the public dataset, results in ~60s. |

The full list of tool parameters is in [`mcp.mjs`](../mcp.mjs).

## Resources

The server also exposes read-only MCP resources for agent context:

| Resource | MIME type | What it returns |
|---|---|---|
| `mdvp://signals` | `application/json` | Built-in originality and generated-UI signal detectors, with `id`, `label`, `penalty`, `weight`, and `rationale`. |

Use `mdvp://signals` when an agent needs to explain what MDVP can detect, choose whether to run an audit, or map an audit finding back to the detector rationale. The JSON is derived from the same registry as:

```bash
npx @mdvp/cli signals --json
```

## Example: scoring from an agent

> **You:** how does our landing page score?
>
> **Agent** *(calls `audit_url` with `yourapp.com`)* — yourapp.com scored **B 71/100**. Lowest: originality (52) — Inter + Tailwind palette matches a common design pattern. `css_health` 78, `structure` 84.

The agent can chain `audit_url` → `perceive_url` to drill from a numeric grade into the full design perception (saliency map, motion taxonomy, recommendations).

## How the server is built

- SDK: [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- Transport: stdio (per the MCP spec)
- Source: [`mcp.mjs`](../mcp.mjs) at the package root, bundled in the npm tarball

## Next

- [CLI commands](cli.md) — non-MCP equivalents
- [Scoring](scoring.md) — what the 4 components measure
