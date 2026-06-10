import { DIM, BOLD, YELLOW, CATS } from './format.mjs'
import { readFileSync } from 'fs'

const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const VERSION = PKG.version

const R = "\x1b[0m"


const ASCII = `
  ███╗   ███╗██████╗ ██╗   ██╗██████╗
  ████╗ ████║██╔══██╗██║   ██║██╔══██╗
  ██╔████╔██║██║  ██║██║   ██║██████╔╝
  ██║╚██╔╝██║██║  ██║╚██╗ ██╔╝██╔═══╝
  ██║ ╚═╝ ██║██████╔╝ ╚████╔╝ ██║
  ╚═╝     ╚═╝╚═════╝   ╚═══╝  ╚═╝`

const WELCOME = `${DIM}${ASCII}${R}
${YELLOW}MDVP-T/1.0 stripe.com A 87/100${R}
${DIM}[DOM]        77 elements · 4 fonts · 5 colors${R}
${DIM}[ENTROPY]    overall 0.74 · high noise${R}
${DIM}[SALIENCY]   cta low · heading low${R}
${DIM}[RECOMMEND]  raise hierarchy · strengthen cta${R}
${DIM}v${VERSION} · protocol sample · live crawl${R}
${DIM}type 'help' for commands${R}
${DIM}Perceive pages as structured output, not subjective taste.${R}
${DIM}Return DOM, entropy, saliency, and recommendation blocks.${R}
${DIM}Try: perceive mdvp.dev --live · audit stripe.com · compare figma.com linear.app${R}`

const HELP_OVERVIEW = `${WELCOME}

${BOLD}Audit${R}
  mdvp help audit             Perception, scoring, compare, rankings

${BOLD}Account${R}
  mdvp help account           Login, credits, submit

${BOLD}Crawler${R}
  mdvp help crawler           MCP, local node, recrawl

${BOLD}Examples${R}
  mdvp help examples          Command recipes

${BOLD}Usage${R}
  mdvp <command> [args] [flags]
  mdvp help <topic>

${BOLD}Common Flags${R}
  --json                      Output as JSON
  --cloud                     Audit from MDVP dataset (was default before v1.32.0)
  --swarm                     Local audit + contribute result to public dataset
  --check                     Enforce thresholds; exit 1 on violation
  --daemon  -d                Run in background (hire/serve only)
  --tabs=N                    Parallel tabs for crawler

${BOLD}Start Here${R}
  mdvp perceive mdvp.dev --live
  mdvp audit stripe.com
  mdvp audit mdvp.dev --swarm
  mdvp compare figma.com linear.app
  mdvp help audit

${BOLD}Links${R}
  Web   https://mdvp.dev
  Docs  https://mdvp.dev/docs
  Repo  https://github.com/Tixo-Digital/mdvp-cli`

const HELP_AUDIT = `${BOLD}MDVP Help · audit${R}

${BOLD}Commands${R}
  perceive <domain>           Full design perception with MDVP structured output
  perceive <domain> --live    Crawl live page first, then perceive fresh output
  perceive <domain> --no-vision  DOM-only analysis, skip vision pass
  audit <domain>              Score a website (local crawl, no API key)
  audit <domain> --cloud      Score from MDVP dataset (1 credit for --json/--raw)
  audit <domain> --swarm      Local audit + contribute to public dataset
  audit <domain> --check      Local audit + enforce .mdvprc thresholds (exit 1 on fail)
  audit <domain> --json       Return machine-readable score output
  compare <a> <b>             Compare two sites side by side
  top [n]                     Top-scored sites (default 10)
  worst [n]                   Lowest-scored sites
  badge <domain>              Print README badge markdown
  label <label>               Filter by label
  stats                       Show aggregate score stats

${BOLD}Examples${R}
  mdvp perceive mdvp.dev --live
  mdvp perceive stripe.com --no-vision
  mdvp audit stripe.com --json
  mdvp audit mdvp.dev --swarm
  mdvp badge mdvp.dev
  mdvp compare figma.com linear.app

${BOLD}Notes${R}
  Use 'perceive' for protocol output and 'audit' for score-first output.
  As of v1.32.0, 'audit' crawls locally by default (no API key needed).
  Pass --cloud to look up an existing dataset record, --swarm to contribute
  your local result to the public dataset.
  Run 'mdvp <command> --help' on any audit command to reopen this page.
  Run 'mdvp help' to go back to the topic index.`

const HELP_ACCOUNT = `${BOLD}MDVP Help · account${R}

${BOLD}Commands${R}
  login                       Save your API key locally
  balance                     Check current credit balance
  submit <domain>             Submit URL for remote crawl (1 credit)

${BOLD}Examples${R}
  mdvp login
  mdvp balance
  mdvp submit mdvp.dev

${BOLD}Notes${R}
  Remote submit uses your MDVP account credits.
  For local audit without credits, use 'mdvp audit <domain>'.
  Run 'mdvp help' to go back to the topic index.`

const HELP_CRAWLER = `${BOLD}MDVP Help · crawler${R}

${BOLD}Commands${R}
  mcp                         Start MCP server over stdio
  mcp-config                  Print MCP config JSON for editors and agents
  recrawl                     Re-queue existing sites for recrawl
  recrawl linear.app          Re-queue specific sites
  recrawl --limit=100         Re-queue oldest N sites
  hire                        Become a crawler node
  hire --daemon               Run crawler in background
  hire --tabs=4               Run with 4 parallel tabs
  apply                       Alias for hire
  serve                       Alias for hire
  serve --local               Run local-only crawler node

${BOLD}Examples${R}
  mdvp mcp
  mdvp mcp-config
  mdvp hire --daemon --tabs=4
  mdvp recrawl --limit=100

${BOLD}Notes${R}
  Use 'mcp' when wiring MDVP into Claude, Cursor, or Codex.
  Use 'hire' or 'serve' when you want this machine to execute crawls.
  Run 'mdvp help' to go back to the topic index.`

const HELP_EXAMPLES = `${BOLD}MDVP Help · examples${R}

${BOLD}Protocol${R}
  mdvp perceive mdvp.dev --live
  mdvp perceive stripe.com --no-vision

${BOLD}Scoring${R}
  mdvp audit stripe.com
  mdvp audit stripe.com --cloud
  mdvp audit mdvp.dev --swarm
  mdvp audit stripe.com --json | jq .overall_score
  mdvp audit myapp.com --check
  mdvp badge myapp.com
  mdvp compare figma.com linear.app

${BOLD}Account${R}
  mdvp login
  mdvp balance
  mdvp submit myapp.com

${BOLD}Crawler${R}
  mdvp mcp
  mdvp mcp-config
  mdvp hire --daemon --tabs=4
  mdvp recrawl linear.app stripe.com

${BOLD}Next${R}
  Run 'mdvp help audit', 'mdvp help account', or 'mdvp help crawler'
  for the smaller topic pages.`

const HELP_TOPICS = {
  audit: HELP_AUDIT,
  account: HELP_ACCOUNT,
  crawler: HELP_CRAWLER,
  examples: HELP_EXAMPLES,
  overview: HELP_OVERVIEW,
}

const HELP_TOPIC_BY_COMMAND = {
  perceive: "audit",
  audit: "audit",
  compare: "audit",
  top: "audit",
  worst: "audit",
  label: "audit",
  stats: "audit",
  badge: "audit",
  login: "account",
  balance: "account",
  submit: "account",
  mcp: "crawler",
  "mcp-config": "crawler",
  recrawl: "crawler",
  hire: "crawler",
  apply: "crawler",
  serve: "crawler",
}


export { VERSION, CATS, R, ASCII, WELCOME, HELP_OVERVIEW, HELP_TOPICS, HELP_TOPIC_BY_COMMAND }
