import { apiGet, apiPost, API } from '../lib/http.mjs'
import { DIM, BOLD, RED, scoreColor, bar, toTextFormat } from '../lib/format.mjs'
import { CATS, R } from '../lib/constants.mjs'

export async function cmdAuditCloud(domain, opts) {
  const { json, raw, text, apiKey } = opts

  if ((json || raw || text) && !apiKey) {
    console.error(`${RED}--json and --raw require an API key (costs 1 credit).${R}`)
    console.error(`${DIM}Run: npx @mdvp/cli login  or  npx @mdvp/cli balance${R}`)
    process.exit(1)
  }

  process.stderr.write(`${DIM}fetching ${domain}...${R}\n`)
  const headers = apiKey ? { "x-api-key": apiKey } : {}

  let site = null
  try {
    const direct = await apiGet(`/dataset/${domain}`, API, headers)
    if (direct?.error && /api key/i.test(direct.error)) {
      console.error(`${RED}${direct.error}${R}`)
      console.error(`${DIM}Run: npx @mdvp/cli login${R}`)
      process.exit(1)
    }
    if (direct && direct.id) site = direct
  } catch (_) {}

  if (!site) {
    const data = await apiGet(`/dataset?limit=1000`, API, headers)
    if (data?.error && /api key/i.test(data.error)) {
      console.error(`${RED}${data.error}${R}`)
      console.error(`${DIM}Run: npx @mdvp/cli login${R}`)
      process.exit(1)
    }
    site = (data.sites ?? []).find((s) => s.id === domain) ?? null
  }

  if (!site) {
    if (json || raw) { console.log(JSON.stringify({ error: "not_in_dataset", domain }, null, 2)); process.exit(1) }
    console.error(`${RED}not in dataset: ${domain}${R}`)
    console.error(`${DIM}submit for crawl: npx @mdvp/cli submit ${domain}${R}`)
    process.exit(1)
  }

  const bd = site.scores?.breakdown ?? []
  const sorted = [...bd].sort((a, b) => a.s - b.s)

  if (raw) {
    const output = {
      id: site.id,
      url: site.url,
      domain: site.domain ?? site.id,
      source: "cloud",
      grade: site.grade,
      overall_score: site.overall_score,
      label: site.label,
      category: site.category,
      scored_at: site.scored_at ?? null,
      scores: {
        overall: site.overall_score,
        grade: site.grade,
        breakdown: bd.map((b) => ({ category: CATS[b.c] ?? b.c, key: b.c, score: b.s })),
        worst: sorted.slice(0, 3).map((b) => ({ key: b.c, category: CATS[b.c] ?? b.c, score: b.s })),
        best: sorted.slice(-3).reverse().map((b) => ({ key: b.c, category: CATS[b.c] ?? b.c, score: b.s })),
      },
      metrics: site.metrics ?? null,
      assets: (() => {
        const base = `https://api.mdvp.dev/dataset/${site.id}/file`
        return {
          screenshots: {
            desktop: `${base}/desktop-1440.jpg`,
            mobile: `${base}/iphone-390.jpg`,
            tablet: `${base}/ipad-1024.jpg`,
          },
          video: `${base}/scroll.webm`,
          dom: {
            html: `${base}/page.html`,
            metrics: `${base}/metrics.json`,
            scores: `${base}/scores.json`,
            features: `${base}/features.json`,
          },
          diagnostics: {
            console: `${base}/console.json`,
            network: `${base}/network.json`,
            a11y: `${base}/a11y.json`,
            css_coverage: `${base}/css-coverage.json`,
          },
          files_index: `https://api.mdvp.dev/dataset/${site.id}/files`,
        }
      })(),
      mdvp: { version: "1", api: "https://api.mdvp.dev", dataset_url: `https://api.mdvp.dev/dataset/${site.id}` },
    }
    console.log(JSON.stringify(output, null, 2))
    if (apiKey) await apiPost("/audit/charge", { domain, type: "raw", amount: 0.20 }, apiKey).catch(() => {})
    return
  }

  if (text) {
    console.log(toTextFormat(site, bd))
    if (apiKey) await apiPost("/audit/charge", { domain, type: "json", amount: 0.10 }, apiKey).catch(() => {})
    return
  }

  if (json) {
    const output = {
      id: site.id,
      url: site.url,
      source: "cloud",
      grade: site.grade,
      overall_score: site.overall_score,
      label: site.label,
      scored_at: site.scored_at ?? null,
      scores: {
        overall: site.overall_score,
        grade: site.grade,
        breakdown: Object.fromEntries(bd.map((b) => [b.c, b.s])),
        worst: sorted.slice(0, 3).map((b) => ({ key: b.c, score: b.s })),
      },
    }
    console.log(JSON.stringify(output, null, 2))
    if (apiKey) await apiPost("/audit/charge", { domain, type: "json", amount: 0.10 }, apiKey).catch(() => {})
    return
  }

  console.log(`\n${BOLD}${site.id}${R}  ${scoreColor(site.overall_score)}${site.grade}  ${site.overall_score}/100${R}  ${DIM}${site.label}${R}\n`)
  for (const cat of Object.keys(CATS)) {
    const s = bd.find((b) => b.c === cat)?.s ?? 0
    console.log(`  ${CATS[cat].padEnd(16)}  ${scoreColor(s)}${bar(s)}${R}  ${s}`)
  }
  console.log(`\n${DIM}Lowest: ${sorted.slice(0, 3).map((i) => `${CATS[i.c] ?? i.c} (${i.s})`).join(" · ")}${R}\n`)
}
