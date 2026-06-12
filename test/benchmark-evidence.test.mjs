import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))

const sensitivity = readJson('data/sensitivity-results.json')
const reference = readJson('data/benchmark-results-live.json')

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

describe('benchmark evidence artifacts', () => {
  it('records a monotonic sensitivity drop when generated-UI factors stack', () => {
    assert.equal(sensitivity.monotonicNonIncreasing, true)
    assert.ok(sensitivity.delta.overall >= 30, `overall delta too small: ${sensitivity.delta.overall}`)
    assert.ok(sensitivity.delta.originality >= 90, `originality delta too small: ${sensitivity.delta.originality}`)

    const cumulative = sensitivity.cumulative.filter((row) => row.step !== 'reference vibecoded fixture')
    for (let i = 1; i < cumulative.length; i += 1) {
      assert.ok(
        cumulative[i].overall <= cumulative[i - 1].overall,
        `${cumulative[i].step} increased overall from ${cumulative[i - 1].overall} to ${cumulative[i].overall}`,
      )
    }
  })

  it('keeps the live reference panel from broadly flagging respected design systems as generated', () => {
    assert.equal(reference.succeeded, reference.n)
    assert.ok(reference.n >= 8)

    const okRows = reference.rows.filter((row) => row.ok)
    const originalityMedian = median(okRows.map((row) => row.originality))
    const overallMean = okRows.reduce((sum, row) => sum + row.overall, 0) / okRows.length

    assert.ok(originalityMedian >= 85, `originality median too low: ${originalityMedian}`)
    assert.ok(overallMean >= 70, `overall mean too low: ${overallMean}`)
    assert.ok(okRows.every((row) => row.grade && typeof row.overall === 'number'))
  })
})
