import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

import { SIGNALS } from '../engine/signals/index.mjs'
import { formatSignalsText, signalRows } from '../commands/signals.mjs'

function runCli(args) {
  return spawnSync(process.execPath, ['cli.mjs', ...args], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
}

describe('signals command', () => {
  it('serializes the signal registry in declaration order', () => {
    const rows = signalRows()

    assert.equal(rows.length, SIGNALS.length)
    assert.deepEqual(rows.map((row) => row.id), SIGNALS.map((signal) => signal.id))
    assert.deepEqual(Object.keys(rows[0]), ['id', 'label', 'penalty', 'weight', 'rationale'])
    assert.equal(typeof rows[0].rationale, 'string')
  })

  it('formats stable text output without requiring network access', () => {
    const output = formatSignalsText(signalRows())

    assert.match(output, /\d+ signal detectors/)
    assert.match(output, /id\s+label\s+penalty\s+weight/)
    assert.match(output, /inter-font\s+Generic default font as primary typeface/)
    assert.match(output, /generic-marketing-copy\s+Generic marketing copy/)
  })

  it('prints JSON as a machine-readable array', () => {
    const result = runCli(['signals', '--json'])

    assert.equal(result.status, 0, result.stderr)
    const parsed = JSON.parse(result.stdout)
    assert.equal(Array.isArray(parsed), true)
    assert.equal(parsed.length, SIGNALS.length)
    assert.deepEqual(Object.keys(parsed[0]), ['id', 'label', 'penalty', 'weight', 'rationale'])
  })

  it('routes command help to the audit topic', () => {
    const result = runCli(['signals', '--help'])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /MDVP Help .* audit/)
    assert.match(result.stdout, /signals\s+List built-in originality signal detectors/)
  })
})
