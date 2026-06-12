import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { normalizeLocalCrawlTimeout, runCrawlerWorker } from '../commands/audit-local.mjs'

function tempScript(contents) {
  const cwd = mkdtempSync(join(tmpdir(), 'mdvp-audit-timeout-'))
  const script = join(cwd, 'worker.mjs')
  writeFileSync(script, contents)
  return { cwd, script }
}

describe('normalizeLocalCrawlTimeout', () => {
  it('accepts positive integer timeout values', () => {
    assert.equal(normalizeLocalCrawlTimeout('1234'), 1234)
  })

  it('falls back for missing, zero, or invalid values', () => {
    assert.equal(normalizeLocalCrawlTimeout(null, 500), 500)
    assert.equal(normalizeLocalCrawlTimeout('0', 500), 500)
    assert.equal(normalizeLocalCrawlTimeout('nope', 500), 500)
  })
})

describe('runCrawlerWorker', () => {
  it('parses crawler JSON output', async () => {
    const { cwd, script } = tempScript('process.stdout.write(JSON.stringify({ metrics: { totalElements: 1 } }) + "\\n")\n')

    const result = await runCrawlerWorker({
      cwd,
      workerPath: script,
      env: process.env,
      timeoutMs: 1000,
    })

    assert.equal(result.metrics.totalElements, 1)
  })

  it('times out a stuck crawler process', async () => {
    const { cwd, script } = tempScript('setInterval(() => {}, 1000)\n')

    await assert.rejects(
      runCrawlerWorker({
        cwd,
        workerPath: script,
        env: process.env,
        timeoutMs: 50,
      }),
      /local crawl timed out after 50ms/,
    )
  })
})
