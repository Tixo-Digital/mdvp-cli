import { apiGet, pickModule, API } from '../lib/http.mjs'
import { loadConfig, saveConfig } from '../lib/config.mjs'
import { DIM, BOLD, RED, GREEN, YELLOW } from '../lib/format.mjs'
import { R, VERSION, CATS } from '../lib/constants.mjs'
import { createInterface } from 'readline'

async function cmdLogin() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${BOLD}MDVP API Key${R} (from mdvp.dev): `, (key) => {
      rl.close()
      key = key.trim()
      if (!key.startsWith("ds_")) { console.error(`${RED}Invalid key — must start with ds_${R}`); process.exit(1) }
      saveConfig({ apiKey: key })
      console.log(`${DIM}Saved to ~/.mdvp/config.json${R}\n${BOLD}Logged in.${R} Try: npx mdvp audit stripe.com`)
      resolve()
    })
  })
}

async function cmdBalance({ json, apiKey }) {
  if (!apiKey) { console.error(`${RED}No API key. Run: npx mdvp login${R}`); process.exit(1) }
  const d = await new Promise((resolve, reject) => {
    const { get } = pickModule(API)
    get(`${API}/token/balance`, { headers: { Accept: "application/json", "x-api-key": apiKey } }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => resolve(JSON.parse(body)))
    }).on("error", reject)
  })
  if (json) { console.log(JSON.stringify(d, null, 2)); return }
  console.log(`\n  Key:      ${d.token}\n  Balance:  $${d.balance_usd}\n  Credits:  ${d.credits_remaining} audits remaining\n`)
}

export { cmdLogin, cmdBalance }