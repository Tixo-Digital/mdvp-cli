import { RED, parseDomain } from '../lib/format.mjs'
import { R } from '../lib/constants.mjs'
import { checkConflicts } from '../lib/conflicts.mjs'
import { AUDIT_FLAG_CONFLICTS, selectAuditSource } from './audit-conflicts.mjs'
import { cmdAuditLocal } from './audit-local.mjs'
import { cmdAuditCloud } from './audit-cloud.mjs'
import { cmdAuditSwarm } from './audit-swarm.mjs'

export async function cmdAudit(domain, opts) {
  const conflict = checkConflicts(opts, AUDIT_FLAG_CONFLICTS)
  if (conflict) {
    console.error(`${RED}${conflict}${R}`)
    process.exit(1)
  }

  const source = selectAuditSource(opts)
  const auditDomain = parseDomain(domain)
  if (source === "cloud") return cmdAuditCloud(auditDomain, opts)
  if (source === "swarm") return cmdAuditSwarm(auditDomain, opts)
  return cmdAuditLocal(domain, { ...opts, source: "local" })
}
