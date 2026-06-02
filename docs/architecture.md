# System Architecture

MDVP has five components: a **client** (CLI), a **scoring engine**, a **crawler**, a **coordinator** (server), and **storage**. The client, engine, and crawler are in this repository. The coordinator and storage are hosted at `api.mdvp.dev` and are not part of this open-source package — but the protocol between them is documented below, so the engine and crawler are fully usable on their own (`--local`) or against a self-hosted coordinator.

---

## Component overview

```
┌─────────────────────────────────────────────────────────────┐
│  This repository (open source, MIT)                          │
│                                                              │
│  CLIENT: @mdvp/cli (npm)          ENGINE: engine/            │
│  ┌──────────────────┐             ┌──────────────────────┐   │
│  │ audit  compare   │  uses       │ scorer.mjs           │   │
│  │ hire   perceive  │────────────>│ color-science.mjs    │   │
│  │ login  mcp       │             │ signals/*.mjs        │   │
│  └──────────────────┘             │ thresholds.mjs       │   │
│                                   └──────────────────────┘   │
│  CRAWLER: engine/crawler-worker.mjs + extract.js             │
│  (Puppeteer; runs locally for --local, or as a swarm node)   │
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

When you run `npx @mdvp/cli audit mysite.com --local`, everything happens on your machine:

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

No network calls. No API key. Bit-identical output for the same DOM snapshot.

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
Content-Type: application/json

{ "job_id": 4711, "status": "done", "site_id": "example.com", "score": 74 }
```

Or on failure:
```json
{ "job_id": 4711, "status": "failed", "error": "Navigation timeout" }
```

The worker source at [`engine/crawler-worker.mjs`](../engine/crawler-worker.mjs) is the full implementation. It also handles stale job recovery: jobs processing for > 15 minutes are automatically reset to `pending`.

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

These are used by the CLI cloud commands. All require `X-API-Key` except the crawler-node endpoints.

| Endpoint | Method | Description |
|---|---|---|
| `/crawl/submit` | POST | Submit a URL to the crawl queue |
| `/crawl/claim` | POST | Claim a job (used by crawler nodes, no auth) |
| `/crawl/complete` | POST | Report job result (used by nodes, no auth) |
| `/dataset` | GET | Paginated dataset listing |
| `/dataset/:id` | GET | Single site: score, metrics, grade |
| `/dataset/stats` | GET | Dataset statistics |
| `/dataset/training` | GET | Full feature vectors for ML use |
| `/perceive` | POST | Full VLM analysis (annotated screenshot) |
| `/mcp` | ALL | MCP server (Streamable HTTP transport) |

---

## What is not open source

The local engine, CLI, MCP server, and GitHub Action in this repo are MIT-licensed and fully self-contained for `--local` mode. The following are not part of the open-source package and live in a separate codebase:

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

The local CLI (`--local` flag) is a fully self-contained alternative — it runs the entire scoring engine without any hosted infrastructure, and is what `npm install @mdvp/cli` actually does.
