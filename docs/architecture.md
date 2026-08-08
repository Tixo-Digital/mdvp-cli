# System Architecture

MDVP has six components: a **client** (CLI), a **static analyzer**, a **scoring engine**, a **crawler**, a **coordinator** (server), and **storage**. The client, static analyzer, engine, and crawler are in this repository. The coordinator and storage are hosted at `api.mdvp.dev` and are not part of this open-source package — but the protocol between them is documented below, so the engine and crawler are fully usable on their own (`audit`, `audit --exact`, `MDVP_USE_CACHE=1 audit --fast`, or `--local`) or against a self-hosted coordinator.

---

## Component overview

```
┌─────────────────────────────────────────────────────────────┐
│  This repository (open source, MIT)                          │
│                                                              │
│  CLIENT: @mdvp/cli (npm)          ENGINE: engine/            │
│  ┌──────────────────┐             ┌──────────────────────┐   │
│  │ audit  compare   │  uses       │ static-analyzer.mjs  │   │
│  │ hire   perceive  │────────────>│ color-science.mjs    │   │
│  │ login  mcp       │             │ signals/*.mjs        │   │
│  └──────────────────┘             │ scorer.mjs           │   │
│                                   └──────────────────────┘   │
│  STATIC: native/mdvp-static (Rust; opt-in cache/fast path)    │
│  CRAWLER: engine/crawler-worker.mjs + extract.js             │
│  (Puppeteer; runs for default audit, artifacts, or swarm)     │
└─────────────────────────────────────────────────────────────┘
                        │ HTTP (documented protocol)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  COORDINATOR + STORAGE: hosted service (not in this repo)    │
│                                                              │
│  Coordinator   /crawl/claim · /crawl/complete · /crawl/submit│
│  Storage       dataset + queued jobs + screenshots           │
│  /perceive     VLM analysis (hosted)                         │
│  /mcp          MCP server (Streamable HTTP transport)        │
└─────────────────────────────────────────────────────────────┘
                        ▲
   SWARM: N contributor crawler nodes, each pulling from the
   coordinator independently (no node-to-node communication)
```

---

## Local scoring engine

When you run `MDVP_USE_CACHE=1 npx @mdvp/cli audit mysite.com --fast`, the static/cache shortcut happens on your machine without Chromium:

```
URL
 │
 ▼
engine/static-analyzer.mjs  — fetches HTML + same-origin CSS
 │
 ▼
native/mdvp-static          — extracts static DOM/CSS metrics without Chromium
 │
 ▼
engine/scorer.mjs           — scores 12 categories, groups into 4 components
```

When you run default `audit`, `audit --exact`, `perceive --live`, screenshots/video flows, or a swarm crawler, the browser-backed crawler path is used:

```
URL
 │
 ▼
engine/crawler-worker.mjs   — launches Puppeteer, navigates to URL
 │
 ▼
engine/extract.js           — page.evaluate(): getComputedStyle on every element
 │                            returns: colors, fonts, sizes, spacing, landmarks, etc.
 ▼
engine/scorer.mjs           — scores 12 categories, groups into 4 components
 │
 ├── engine/color-science.mjs  — Oklab ΔE, APCA contrast, palette harmony
 │
 ├── engine/signals/*.mjs      — one file per AI-pattern detector (registry)
 │                              feeds the originality category
 │
 ├── engine/design-spec.mjs    — DESIGN.md parser + DOM compliance diff
 │                              (off-palette colors via Oklab ΔE, off-scale fonts)
 │
 └── engine/thresholds.mjs     — loads .mdvprc, checks violations + signal config
```

No API key is required. Static output is deterministic for the same fetched HTML/CSS. Exact browser output is deterministic for the same rendered DOM snapshot.

For authenticated local or staging pages, the same exact crawler can connect to a Chrome instance that the developer started with DevTools remote debugging:

```
MDVP_BROWSER_URL=http://127.0.0.1:9222
 │
 ▼
developer-owned Chrome profile  — already logged in, loopback DevTools only
 │
 ▼
engine/crawler-worker.mjs       — puppeteer.connect(), opens a new page
 │
 ▼
engine/extract.js               — local DOM/computed CSS extraction
 │
 ▼
engine/scorer.mjs               — local scoring, normal audit output
```

MDVP disconnects from that browser when the audit finishes instead of closing it. Cookies, local storage, request headers, and passwords remain in the browser profile and are not submitted by default. See [Authenticated page scoring](authenticated-scoring.md) for setup and limitations.

### Signal registry

The `originality` score is driven by a directory of independent detectors —
[`engine/signals/`](../engine/signals/). Each file is one anti-pattern (Inter as the
only font, pill buttons, pulsing dots, an eyebrow chip above the H1, gradient headlines…).
Adding a detector is a one-file change; see [`engine/signals/README.md`](../engine/signals/README.md).

Signals are configurable per project via `.mdvprc` — a team can disable a signal
they intentionally violate, or raise the penalty on one they want banned:

```json
{
  "signals": {
    "disabled": ["system-font-only"],
    "penalties": { "pill-radius": 25 }
  }
}
```

---

## Distributed crawling

The public MDVP dataset is built by contributor-run crawler nodes. Any machine with Node.js 18+ and internet access can become a node.

> **Swarm, not peer-to-peer.** Nodes do not talk to each other. There is no peer discovery, gossip, or DHT. Every node independently pulls work from a central coordinator backed by a hosted queue, crawls it, and reports back. This is the classic worker-pool / pull-queue pattern (think Sidekiq or Celery workers), which keeps deduplication, prioritisation, and abuse-prevention in one place. True P2P would add a lot of machinery for little benefit here — a crawler still needs consensus on who crawls what.

### Starting a node

```bash
npx @mdvp/cli login           # one-time API key setup
npx @mdvp/cli hire            # interactive, 2 parallel tabs
npx @mdvp/cli hire --tabs=4   # more throughput
npx @mdvp/cli hire --daemon   # background process
```

The `hire` command copies `engine/crawler-worker.mjs` (this repo) to `~/.mdvp/crawler/` and runs it.

### Job protocol

Nodes poll for work using a simple HTTP protocol:

**Claim a job**

```
POST api.mdvp.dev/crawl/claim
Authorization: Bearer <short-lived-crawler-credential>
Content-Type: application/json

{ "worker_id": "mdvp-abc123" }
```

Response (200 — job assigned):
```json
{ "id": 4711, "url": "https://example.com", "source": "submitted", "priority": 0 }
```

Response (204 — queue empty, retry after POLL_INTERVAL).

**Complete a job**

```
POST api.mdvp.dev/crawl/complete
Authorization: Bearer <short-lived-crawler-credential>
Content-Type: application/json

{ "job_id": 4711, "status": "done", "site_id": "example.com", "score": 74 }
```

Or on failure:
```json
{ "job_id": 4711, "status": "failed", "error": "Navigation timeout" }
```

The worker source at [`engine/crawler-worker.mjs`](../engine/crawler-worker.mjs) is the full implementation. A saved MDVP API key is used only to bootstrap a 15-minute crawler credential; queue RPC receives that scoped credential, not the API key. It also handles stale job recovery: jobs processing for > 15 minutes are automatically reset to `pending`.

### What the crawler collects

Each crawl extracts:

- Computed CSS metrics (colors, fonts, spacing, border-radii, custom properties)
- Shannon entropy per dimension
- APCA contrast values
- CSS design DNA (OKLab usage, container queries, `:has()` selectors, variable fonts)
- DOM landmarks and heading hierarchy
- Screenshot (desktop + mobile viewport)
- Scroll video (WebM)
- Network requests (first 80)
- Raw HTML

Crawler nodes contribute compute to the shared dataset.

---

## Submitting a URL to the dataset

Anyone with an API key can submit a URL for crawling:

```bash
npx @mdvp/cli submit mysite.com
```

Or directly:

```
POST api.mdvp.dev/crawl/submit
X-API-Key: <your-key>
Content-Type: application/json

{ "domain": "mysite.com", "url": "https://mysite.com" }
```

Results appear in the dataset within ~60 seconds, once a crawler node picks up the job.

---

## Hosted API endpoints (api.mdvp.dev)

These are used by the CLI cloud commands. User-facing writes require `X-API-Key`; crawler queue RPC requires a short-lived scoped bearer credential.

| Endpoint | Method | Description |
|---|---|---|
| `/crawl/submit` | POST | Submit a URL to the crawl queue |
| `/crawl/authorize` | POST | Exchange a valid API key for a short-lived crawler credential |
| `/crawl/claim` | POST | Claim a job using a crawler credential |
| `/crawl/complete` | POST | Report job result using a crawler credential |
| `/dataset` | GET | Paginated dataset listing |
| `/dataset/:id` | GET | Single site: score, metrics, grade |
| `/dataset/stats` | GET | Dataset statistics |
| `/dataset/training` | GET | Full feature vectors for ML use |
| `/perceive` | POST | Full VLM analysis (annotated screenshot) |
| `/mcp` | ALL | MCP server (Streamable HTTP transport) |

---

## What is not open source

The local static analyzer, exact crawler, scoring engine, CLI, MCP server, and GitHub Action in this repo are MIT-licensed and fully self-contained for local audit modes. The following are not part of the open-source package and live in a separate codebase:

- **Hosted coordinator** — the queue, job dispatcher, and rate-limit logic
- **Storage layer** — the scored site database and the crawl queue
- **Hosted VLM inference** — the `/perceive` endpoint and its prompt engineering
- **Account management** — API keys, credits, account state

The local CLI works end-to-end without any of the above. To replicate the hosted behaviour, you can self-host a coordinator that speaks the [job protocol](#job-protocol); see the [self-hosting section](#self-hosting) below for the requirements.

---

## Self-hosting

The hosted service runs on serverless infrastructure. A self-hosted instance that speaks the same job protocol would need:

1. An HTTP endpoint for `/crawl/claim` and `/crawl/complete`
2. Persistent storage for sites and the crawl queue
3. A screenshot store (or skip screenshots and serve only scores)
4. An API-key table for cloud-command authentication

The local CLI is a fully self-contained alternative — default `audit` runs the browser-backed crawler locally for rendered evidence, and `MDVP_USE_CACHE=1 audit --fast` runs the static analyzer without hosted infrastructure when you explicitly accept approximate shortcut output.
