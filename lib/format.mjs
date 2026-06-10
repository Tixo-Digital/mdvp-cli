const CATS = {
  spacing: "Spacing", typography: "Typography", color: "Color",
  components: "Components", modernity: "Modernity", originality: "Originality",
  html_quality: "HTML Quality", visual_polish: "Visual Polish",
  sophistication: "Sophistication", readability: "Readability",
  ux_patterns: "UX Patterns", contentDepth: "Content Depth",
}

const DIM = "\x1b[2m"
const BOLD = "\x1b[1m"
const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"

const scoreColor = (s) => s >= 80 ? GREEN : s >= 60 ? YELLOW : RED
const bar = (s) => "█".repeat(Math.round(s / 10)) + "░".repeat(10 - Math.round(s / 10))
const parseDomain = (s) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")

function badgeForDomain(input) {
  const domain = parseDomain(input)
  const endpointUrl = `https://api.mdvp.dev/badge/${encodeURIComponent(domain)}`
  const imageUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpointUrl)}`
  const targetUrl = "https://mdvp.dev"
  return {
    domain,
    endpointUrl,
    imageUrl,
    targetUrl,
    markdown: `[![MDVP](${imageUrl})](${targetUrl})`,
  }
}

function toTextFormat(site, bd) {
  const sorted = [...bd].sort((a, b) => a.s - b.s)
  const worst = sorted.slice(0, 3).map(b => `${b.c}:${b.s}`).join(' ')
  const best = sorted.slice(-3).reverse().map(b => `${b.c}:${b.s}`).join(' ')
  const all = Object.keys(CATS).map(c => {
    const s = bd.find(b => b.c === c)?.s ?? 0
    return `${c}:${s}`
  }).join(' ')
  const base = `https://api.mdvp.dev/dataset/${site.id}/file`
  return [
    `MDVP/1.0 ${site.id} ${site.grade} ${site.overall_score}/100 label:${site.label}`,
    `scores: ${all}`,
    `worst: ${worst}  best: ${best}`,
    `assets: ${base}/desktop-1440.jpg ${base}/scroll.webm ${base}/console.json`,
  ].join('\n')
}


export { CATS, DIM, BOLD, RED, GREEN, YELLOW, scoreColor, bar, parseDomain, badgeForDomain, toTextFormat }
