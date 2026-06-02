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
- New vibe-code signals — AI tools update their defaults, the detection needs to keep up
- Docs improvements
- CI/action reliability improvements

## Not in scope

- Hosted API, billing, or cloud infrastructure
- Private datasets or customer data

## Before opening a PR

- `npm test` passes
- If you changed scoring behaviour, include before/after scores for at least 2 URLs
- If you changed the engine, `npm pack --dry-run` still shows 20 files and no secrets
