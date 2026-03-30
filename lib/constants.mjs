import { DIM, BOLD, YELLOW } from './format.mjs'
import { readFileSync } from 'fs'

const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const VERSION = PKG.version

const CATS = {
  spacing: "Spacing", typography: "Typography", color: "Color",
  components: "Components", modernity: "Modernity", originality: "Originality",
  html_quality: "HTML Quality", visual_polish: "Visual Polish",
  sophistication: "Sophistication", readability: "Readability",
  ux_patterns: "UX Patterns", contentDepth: "Content Depth",
}

const R = "\x1b[0m"


const ASCII = `
  ███╗   ███╗██████╗ ██╗   ██╗██████╗
  ████╗ ████║██╔══██╗██║   ██║██╔══██╗
  ██╔████╔██║██║  ██║██║   ██║██████╔╝
  ██║╚██╔╝██║██║  ██║╚██╗ ██╔╝██╔═══╝
  ██║ ╚═╝ ██║██████╔╝ ╚████╔╝ ██║
  ╚═╝     ╚═╝╚═════╝   ╚═══╝  ╚═╝`

const HELP = `${DIM}${ASCII}${R}
${DIM}  Machine Design Vision Protocol  v${VERSION}${R}

${BOLD}Audit${R}
  perceive <domain>           Full design perception — DOM + vision AI analysis (MDVP protocol)
  perceive <domain> --no-vision  DOM analysis only, no vision pass
  audit <domain>              Score a website
  audit <domain> --json       Output as JSON
  compare <a> <b>             Compare two sites side by side
  top [n]                     Top-scored sites (default 10)
  worst [n]                   Lowest-scored sites
  label <label>               Filter by label (premium/good/vibecoded/bad)
  stats                       Dataset statistics

${BOLD}Account${R}
  login                       Save your API key
  balance                     Check credit balance
  submit <domain>             Submit URL for crawl (1 credit)
  submit <domain> --local     Submit to local crawler node instead

${BOLD}Crawler${R}
  mcp                         Start MCP server (stdio transport, for opencode/claude/cursor)
  mcp-config                  Print MCP server config JSON (with token if logged in)
  recrawl                     Re-queue existing sites for recrawl (updates data)
  recrawl linear.app          Re-queue specific sites
  recrawl --limit=100         Re-queue oldest N sites
  hire                        Become a crawler node (downloads + runs worker)
  hire --daemon               Run crawler in background
  hire --tabs=4               Run with 4 parallel tabs
  apply                       Same as hire
  serve                       Same as hire (global by default)
  serve --local               Run local-only crawler node

${BOLD}Flags${R}
  --json                      Output as JSON
  --local                     Crawl locally via puppeteer (no credits)
  --daemon  -d                Run in background (hire/serve only)
  --tabs=N                    Parallel tabs for crawler

${BOLD}Examples${R}
  npx mdvp audit stripe.com
  npx mdvp audit stripe.com --json | jq .overall_score
  npx mdvp compare figma.com linear.app
  npx mdvp submit myapp.com
  npx mdvp submit myapp.com --local
  npx mdvp hire --daemon --tabs=4

${BOLD}Web${R}  https://mdvp.dev
${BOLD}Docs${R} https://mdvp.dev/docs
`



export { VERSION, CATS, R, ASCII, HELP }
