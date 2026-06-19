import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { cacheShortcutsEnabled, installCrawlerDependencies, normalizeLocalAuditTarget, normalizeLocalCrawlTimeout, resolveLocalAuditRuntime, runCrawlerWorker } from '../commands/audit-local.mjs'

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

describe('normalizeLocalAuditTarget', () => {
  it('preserves full explicit URLs for local and authenticated audits', () => {
    assert.deepEqual(normalizeLocalAuditTarget('http://localhost:3000/dashboard?tab=design#debug'), {
      id: 'localhost:3000',
      url: 'http://localhost:3000/dashboard?tab=design',
      display: 'localhost:3000/dashboard?tab=design',
    })
  })

  it('keeps bare domains on the existing https default', () => {
    assert.deepEqual(normalizeLocalAuditTarget('www.mdvp.dev'), {
      id: 'mdvp.dev',
      url: 'https://www.mdvp.dev/',
      display: 'mdvp.dev',
    })
  })
})

describe('resolveLocalAuditRuntime', () => {
  it('uses exact browser audit by default', () => {
    assert.deepEqual(resolveLocalAuditRuntime({}, {}), {
      mode: 'browser',
      reason: 'default exact audit',
    })
  })

  it('uses the static/cache shortcut only when MDVP_USE_CACHE is enabled', () => {
    assert.equal(cacheShortcutsEnabled({ MDVP_USE_CACHE: '1' }), true)
    assert.equal(cacheShortcutsEnabled({ MDVP_USE_CACHE: 'true' }), true)
    assert.equal(cacheShortcutsEnabled({ MDVP_USE_CACHE: '0' }), false)
    assert.deepEqual(resolveLocalAuditRuntime({}, { MDVP_USE_CACHE: '1' }), {
      mode: 'static',
      reason: 'MDVP_USE_CACHE',
    })
  })

  it('requires MDVP_USE_CACHE before --fast can use the static shortcut', () => {
    const runtime = resolveLocalAuditRuntime({ fast: true }, {})
    assert.equal(runtime.mode, 'error')
    assert.match(runtime.message, /MDVP_USE_CACHE=1/)

    assert.deepEqual(resolveLocalAuditRuntime({ fast: true }, { MDVP_USE_CACHE: '1' }), {
      mode: 'static',
      reason: 'fast cache shortcut',
    })
  })

  it('--exact forces the browser path even when cache shortcuts are enabled', () => {
    assert.deepEqual(resolveLocalAuditRuntime({ exact: true }, { MDVP_USE_CACHE: '1' }), {
      mode: 'browser',
      reason: 'exact flag',
    })
  })

  it('keeps swarm contribution on the browser path', () => {
    assert.deepEqual(resolveLocalAuditRuntime({ source: 'swarm', fast: true }, { MDVP_USE_CACHE: '1' }), {
      mode: 'browser',
      reason: 'swarm contribution',
    })
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

describe('installCrawlerDependencies', () => {
  it('reports missing npm as an actionable exact-runtime error', async () => {
    const spawnMissingNpm = () => {
      const child = new EventEmitter()
      queueMicrotask(() => {
        const err = new Error('spawn npm ENOENT')
        err.code = 'ENOENT'
        child.emit('error', err)
      })
      return child
    }

    await assert.rejects(
      installCrawlerDependencies('/tmp/mdvp-missing-npm-test', spawnMissingNpm),
      /Exact browser audit requires npm.*MDVP_USE_CACHE=1/s,
    )
  })
})
