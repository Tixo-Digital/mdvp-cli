import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkConflicts } from '../lib/conflicts.mjs'

describe('checkConflicts', () => {
  const conflicts = [
    { pair: ['cloud', 'swarm'], msg: 'a' },
    { pair: ['cloud', 'check'], msg: 'b' },
    { pair: ['local', 'cloud'], msg: 'c' },
  ]

  it('returns null when no flags are set', () => {
    assert.equal(checkConflicts({}, conflicts), null)
  })

  it('returns null when only one of each pair is set', () => {
    assert.equal(checkConflicts({ cloud: true }, conflicts), null)
    assert.equal(checkConflicts({ swarm: true, check: true }, conflicts), null)
  })

  it('returns msg for the first matching conflict', () => {
    assert.equal(checkConflicts({ cloud: true, swarm: true }, conflicts), 'a')
    assert.equal(checkConflicts({ cloud: true, check: true }, conflicts), 'b')
  })

  it('matches regardless of which side of the pair is checked first', () => {
    assert.equal(checkConflicts({ local: true, cloud: true }, conflicts), 'c')
  })

  it('treats falsy values as unset flags', () => {
    assert.equal(checkConflicts({ cloud: false, swarm: false, check: false }, conflicts), null)
    assert.equal(checkConflicts({ cloud: null, swarm: 1 }, conflicts), null)
  })
})
