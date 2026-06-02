import { apiPost } from '../lib/http.mjs'
import { DIM, GREEN } from '../lib/format.mjs'
import { R } from '../lib/constants.mjs'
import { cmdAuditLocal } from './audit-local.mjs'

export async function cmdAuditSwarm(domain, opts = {}) {
  process.stderr.write(`${DIM}swarm mode: local audit + contribute to public dataset${R}\n`)

  const payload = await cmdAuditLocal(domain, { ...opts, source: "swarm" })

  let contributed = false
  try {
    await apiPost("/swarm/contribute", {
      domain,
      url: `https://${domain}`,
      overall_score: payload.overall_score,
      grade: payload.grade,
      breakdown: payload.scores?.breakdown ?? null,
      components: payload.components ?? null,
      entropy: payload.entropy ?? null,
    })
    contributed = true
  } catch (e) {
    process.stderr.write(`${DIM}swarm submit failed: ${e.message ?? e}${R}\n`)
  }

  if (!opts.json && !opts.text) {
    if (contributed) {
      process.stdout.write(`${GREEN}✓ contributed to public dataset${R}\n`)
    } else {
      process.stdout.write(`${DIM}swarm submit failed — see stderr${R}\n`)
    }
  }
}
