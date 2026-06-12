import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AUDIT_FLAG_CONFLICTS, AUDIT_SOURCES, selectAuditSource } from '../commands/audit-conflicts.mjs'
import { checkConflicts } from '../lib/conflicts.mjs'

describe('AUDIT_SOURCES', () => {
  it('exposes the valid source kinds', () => {
    assert.deepEqual(AUDIT_SOURCES, ['static', 'local', 'cloud', 'swarm'])
  })
})

describe('selectAuditSource', () => {
  it('defaults to local when no flags are set', () => {
    assert.equal(selectAuditSource({}), 'local')
    assert.equal(selectAuditSource({ cloud: false, swarm: false }), 'local')
  })

  it('returns cloud when --cloud is set', () => {
    assert.equal(selectAuditSource({ cloud: true }), 'cloud')
  })

  it('returns swarm when --swarm is set', () => {
    assert.equal(selectAuditSource({ swarm: true }), 'swarm')
  })

  it('--local flag does not override --cloud or --swarm', () => {
    assert.equal(selectAuditSource({ local: true }), 'local')
    assert.equal(selectAuditSource({ local: true, cloud: true }), 'cloud')
    assert.equal(selectAuditSource({ local: true, swarm: true }), 'swarm')
  })
})

describe('audit command conflict matrix', () => {
  it('flags --cloud and --swarm are mutually exclusive', () => {
    assert.equal(checkConflicts({ cloud: true, swarm: true }, AUDIT_FLAG_CONFLICTS), AUDIT_FLAG_CONFLICTS[0].msg)
  })

  it('--cloud is incompatible with --check', () => {
    assert.equal(checkConflicts({ cloud: true, check: true }, AUDIT_FLAG_CONFLICTS), AUDIT_FLAG_CONFLICTS[1].msg)
  })

  it('--local is incompatible with --cloud and --swarm', () => {
    assert.equal(checkConflicts({ local: true, cloud: true }, AUDIT_FLAG_CONFLICTS), AUDIT_FLAG_CONFLICTS[2].msg)
    assert.equal(checkConflicts({ local: true, swarm: true }, AUDIT_FLAG_CONFLICTS), AUDIT_FLAG_CONFLICTS[3].msg)
  })

  it('--check alone is allowed (local mode)', () => {
    assert.equal(checkConflicts({ check: true }, AUDIT_FLAG_CONFLICTS), null)
  })

  it('--swarm + --check is allowed (contribute after a checked local crawl)', () => {
    assert.equal(checkConflicts({ swarm: true, check: true }, AUDIT_FLAG_CONFLICTS), null)
  })

  it('no flags is valid', () => {
    assert.equal(checkConflicts({}, AUDIT_FLAG_CONFLICTS), null)
  })
})
