# Add a score badge to your README

Once a site is in the public dataset, show its current MDVP score with a shields.io endpoint badge in your project's README.

## Submit your site

```bash
# Cloud submit (requires MDVP API key)
npx @mdvp/cli submit yoursite.com

# Or: crawl locally first, then push the result
npx @mdvp/cli submit yoursite.com --local
```

`--local` crawls with Puppeteer on your machine and ships the score to the public dataset — no API key, no credits. A crawler node picks it up for parity scoring if needed; results appear in the dataset within ~60 seconds.

## Add the badge

In your project's README:

```markdown
[![MDVP](https://img.shields.io/endpoint?url=https://api.mdvp.dev/badge/yoursite.com)](https://mdvp.dev)
```

Replace `yoursite.com` with your domain (no protocol, no path). The badge image will render as:

- **label**: `design`
- **message**: e.g. `A 87` (the current grade + score)
- **color**: by grade (green for A/A+, blue for B, yellow for C, red for D/F)

It reflects the latest crawl for that domain, so it updates automatically as your site changes.

## How it works

The endpoint at `https://api.mdvp.dev/badge/:domain` returns a [shields.io endpoint](https://shields.io/badges/endpoint-badge) JSON payload:

```json
{
  "schemaVersion": 1,
  "label": "design",
  "message": "A 87",
  "color": "brightgreen"
}
```

shields.io proxies this payload and serves it as a static SVG. The badge updates whenever the dataset score for your domain changes.

## Privacy

The endpoint serves only the public score (grade + number) for the requested domain. No per-crawl metadata, screenshots, or DOM data is exposed via the badge URL.

## Next

- [CLI commands](cli.md) — submit, recrawl, and the rest
- [Architecture](architecture.md) — how the public dataset is built
- [Methodology](methodology.md) — what the four components measure
