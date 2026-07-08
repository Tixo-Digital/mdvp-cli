import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('GitHub issue templates', () => {
  it('collects actionable evidence for signal detector requests', () => {
    const template = read('.github/ISSUE_TEMPLATE/signal_request.yml')

    assert.match(template, /^name: Signal detector request/m)
    assert.match(template, /^labels: \[signal\]/m)

    for (const id of [
      'pattern',
      'examples',
      'evidence',
      'expected_detection',
      'false_positive_risk',
      'contribution',
    ]) {
      assert.match(template, new RegExp(`id: ${id}`), `missing field: ${id}`)
    }

    assert.match(template, /rendered DOM or CSS/)
    assert.match(template, /Do not include private dashboards, secrets, or customer data/)
    assert.match(template, /Can you contribute a fixture or test/)
  })
})
