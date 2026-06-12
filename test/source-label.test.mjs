import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sourceLabel } from '../lib/source-label.mjs'

describe('sourceLabel', () => {
  it('returns human-readable label for each known source', () => {
    assert.equal(sourceLabel('static'), 'static audit')
    assert.equal(sourceLabel('local'), 'local crawl')
    assert.equal(sourceLabel('swarm'), 'local + swarm submit')
    assert.equal(sourceLabel('cloud'), 'cloud lookup')
  })

  it('passes through unknown sources', () => {
    assert.equal(sourceLabel('experimental'), 'experimental')
    assert.equal(sourceLabel(''), '')
  })
})
