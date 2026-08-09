#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "./lib/constants.mjs";
import { signalRows } from "./commands/signals.mjs";
import https from "https";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

// Load API key — env var takes precedence over config file
let apiKey = process.env.MDVP_API_KEY || "";
if (!apiKey) {
  try {
    const cfg = JSON.parse(await readFile(join(homedir(), ".mdvp", "config.json"), "utf8"));
    apiKey = cfg.apiKey || "";
  } catch {}
}

const API_BASE = "https://api.mdvp.dev";
const SIGNALS_RESOURCE_URI = "mdvp://signals";

function request(method, path, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;
    if (data) headers["Content-Length"] = Buffer.byteLength(data);

    const req = https.request(url, { method, headers, timeout: timeoutMs }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    if (data) req.write(data);
    req.end();
  });
}

function domainFrom(url) {
  try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname; } catch { return url; }
}

const server = new Server(
  { name: "mdvp", version: VERSION },
  { capabilities: { tools: {}, resources: {} } }
);

function listResources() {
  return {
    resources: [
      {
        uri: SIGNALS_RESOURCE_URI,
        name: "MDVP signal catalog",
        description: "Built-in originality and generated-UI signal detectors exposed as stable JSON.",
        mimeType: "application/json",
      },
    ],
  };
}

function readResource(uri) {
  if (uri !== SIGNALS_RESOURCE_URI) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  return {
    contents: [
      {
        uri: SIGNALS_RESOURCE_URI,
        mimeType: "application/json",
        text: JSON.stringify(signalRows(), null, 2),
      },
    ],
  };
}

server.setRequestHandler(ListResourcesRequestSchema, async () => listResources());

server.setRequestHandler(ReadResourceRequestSchema, async (req) => readResource(req.params.uri));

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "audit_url",
      description: "Score a website across 12 design dimensions. Returns grade A+-F and score 0-100.",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string", description: "URL or domain to audit" } },
        required: ["url"],
      },
    },
    {
      name: "perceive_url",
      description: "Get full MDVP-T/1.0 design perception of a website. Returns [DOM][ENTROPY][SALIENCY][TEMPORAL][MOTION-TAXONOMY][INTERACTION][CLASSIFY][TOKENS][DIAGNOSIS][RECOMMENDATIONS] sections. Use live=true for sites not in dataset (crawls on-demand).",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain to perceive, e.g. 'stripe.com' or 'mdvp.dev'" },
          include_vision: { type: "boolean", description: "Include GPT-4.1 vision analysis (default: true)" },
          live: { type: "boolean", description: "Crawl site live if not in dataset (default: false)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "top_sites",
      description: "Get top or worst scoring sites from the dataset.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of results (default 10, max 50)" },
          label: { type: "string", enum: ["premium", "good", "vibecoded", "bad"] },
          order: { type: "string", enum: ["top", "worst"], description: "top=highest first, worst=lowest first" },
        },
      },
    },
    {
      name: "compare_sites",
      description: "Compare design quality of two websites side by side.",
      inputSchema: {
        type: "object",
        properties: {
          domain_a: { type: "string" },
          domain_b: { type: "string" },
        },
        required: ["domain_a", "domain_b"],
      },
    },
    {
      name: "submit_for_crawl",
      description: "Submit a URL for design quality crawl. Costs 1 credit. Results available in ~60 seconds.",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
    {
      name: "get_page_content",
      description: "Get full page content as Markdown with embedded MDVP design scores (Toon format). Use this to feed page content into LLM context alongside design analysis.",
      inputSchema: {
        type: "object",
        properties: { domain: { type: "string", description: "Domain, e.g. 'stripe.com'" } },
        required: ["domain"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let result;

  try {
    if (name === "audit_url") {
      const domain = domainFrom(args.url);
      const data = await request("GET", `/dataset/${domain}`);
      if (typeof data === "string" && data.includes("404")) {
        return { content: [{ type: "text", text: `"${domain}" is not in the MDVP dataset yet.\n\nTo crawl it, run:\n  npx @mdvp/cli perceive ${domain} --live\n\nThen call audit_url again.` }] };
      }
      result = data;
    } else if (name === "perceive_url") {
      const domain = domainFrom(args.domain);
      const include_vision = args.include_vision !== false;
      const data = await request("POST", "/perceive", { domain, include_vision }, 30000);
      if (typeof data === "string" && (data.includes("not in dataset") || data.includes("404"))) {
        return { content: [{ type: "text", text: `"${domain}" is not in the MDVP dataset yet.\n\nTo analyze it, run this command in your terminal:\n  npx @mdvp/cli perceive ${domain} --live\n\nOnce done (~90s), call perceive_url again and it will return the full MDVP-T/1.0 analysis.` }] };
      }
      result = data;
    } else if (name === "top_sites") {
      const params = new URLSearchParams();
      if (args.limit) params.set("limit", String(args.limit));
      if (args.label) params.set("label", args.label);
      if (args.order) params.set("order", args.order);
      result = await request("GET", `/dataset?${params}`);
    } else if (name === "compare_sites") {
      const [a, b] = await Promise.all([
        request("GET", `/dataset/${domainFrom(args.domain_a)}`),
        request("GET", `/dataset/${domainFrom(args.domain_b)}`),
      ]);
      result = { domain_a: a, domain_b: b };
    } else if (name === "submit_for_crawl") {
      const url = args.url.startsWith("http") ? args.url : `https://${args.url}`;
      result = await request("POST", "/crawl/submit", { url, domain: domainFrom(url) });
    } else if (name === "get_page_content") {
      result = await request("GET", `/md/${domainFrom(args.domain)}`, null, 15000);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }

  return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] };
});

async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  await startServer();
}

export {
  SIGNALS_RESOURCE_URI,
  listResources,
  readResource,
  startServer,
};
