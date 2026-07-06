# Contributing

Issues and PRs welcome.

## Setup

```bash
git clone https://github.com/Tixo-Digital/mdvp-cli
cd mdvp-cli
npm ci
npm test
```

Use `node ./cli.mjs ...` during development to exercise the local checkout.

## Good contributions

- Bug fixes in the CLI or scoring engine
- Scoring calibration — if a site scores wrong, open an issue with the JSON output
- New vibe-code signals — AI tools update their defaults, the detection needs to keep up. Start with the [signal catalog](docs/signals.md) so the detector is narrow, explainable, and testable.
- Docs improvements
- CI/action reliability improvements
- Improvements to `engine/crawler-worker.mjs` — the distributed crawler

## Running a crawler node

Contribute crawl capacity to the public MDVP dataset:

```bash
npx @mdvp/cli hire          # interactive
npx @mdvp/cli hire --daemon # background
npx @mdvp/cli hire --tabs=4 # 4 parallel tabs
```

The worker source is [`engine/crawler-worker.mjs`](engine/crawler-worker.mjs). It polls `api.mdvp.dev/crawl/claim`, crawls the URL, and reports the result. No API key required.

## Not in scope

- Hosted API, billing, or cloud infrastructure
- Private datasets or customer data

## Before opening a PR

- `npm test` passes
- If you changed scoring behaviour, include before/after scores for at least 2 URLs
- If you added or changed a signal, update [docs/signals.md](docs/signals.md) and include `test/signals.test.mjs` coverage
- If you changed the engine, `npm pack --dry-run` shows no secrets and only expected files
