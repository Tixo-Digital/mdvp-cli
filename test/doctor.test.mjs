import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createDoctorReport, formatDoctorText } from '../commands/doctor.mjs'

function fakeFs({ executablePaths = new Set(), existingPaths = new Set(), writable = true } = {}) {
  return {
    accessSync(path) {
      if (!executablePaths.has(path)) throw new Error('not executable')
    },
    mkdirSync() {
      if (!writable) throw new Error('permission denied')
    },
    writeFileSync() {
      if (!writable) throw new Error('permission denied')
    },
    unlinkSync() {},
    existsSync(path) {
      return existingPaths.has(path)
    },
  }
}

function fakeRunner(versions = {}) {
  return (command) => {
    if (!versions[command]) return { status: 127, stdout: '', stderr: '', error: { code: 'ENOENT' } }
    return { status: 0, stdout: `${versions[command]}\n`, stderr: '' }
  }
}

describe('createDoctorReport', () => {
  it('returns a stable passing JSON-friendly report', () => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const report = createDoctorReport({
      env: { PUPPETEER_EXECUTABLE_PATH: chrome, MDVP_USE_CACHE: '1' },
      platform: 'darwin',
      arch: 'arm64',
      home: '/tmp/mdvp-home',
      nodeVersion: 'v22.0.0',
      spawnSync: fakeRunner({ npm: '10.0.0', cargo: 'cargo 1.80.0' }),
      fs: fakeFs({
        executablePaths: new Set([chrome]),
        existingPaths: new Set(['/tmp/mdvp-home/.mdvp/crawler/node_modules/puppeteer']),
      }),
    })

    assert.equal(report.ok, true)
    assert.equal(report.exactAuditReady, true)
    assert.equal(report.staticShortcutReady, true)
    assert.equal(report.runtime.node.requiredMajor, 18)
    assert.equal(report.runtime.npm.available, true)
    assert.equal(report.browser.configuredExecutable[0].exists, true)
    assert.deepEqual(report.recommendations, [])
    assert.deepEqual(report.checks.map((check) => check.id), [
      'node',
      'npm',
      'cargo',
      'browser',
      'puppeteer-cache',
      'crawler-deps',
      'static-shortcut',
    ])
  })

  it('fails only blocking prerequisites', () => {
    const report = createDoctorReport({
      env: {},
      platform: 'linux',
      arch: 'x64',
      home: '/tmp/mdvp-home',
      nodeVersion: 'v16.20.0',
      spawnSync: fakeRunner({ cargo: 'cargo 1.80.0' }),
      fs: fakeFs(),
    })

    assert.equal(report.ok, false)
    assert.equal(report.checks.find((check) => check.id === 'node').status, 'fail')
    assert.equal(report.checks.find((check) => check.id === 'npm').status, 'fail')
    assert.equal(report.checks.find((check) => check.id === 'browser').status, 'warn')
    assert.deepEqual(report.recommendations.map((recommendation) => recommendation.id), [
      'node',
      'npm',
      'browser',
      'crawler-deps',
      'static-shortcut',
    ])
    assert.equal(report.recommendations.find((recommendation) => recommendation.id === 'node').severity, 'fail')
    assert.equal(report.recommendations.find((recommendation) => recommendation.id === 'browser').severity, 'warn')
    assert.deepEqual(
      report.recommendations.find((recommendation) => recommendation.id === 'static-shortcut').env,
      { MDVP_USE_CACHE: '1' }
    )
  })

  it('recommends fixing a configured browser path that is not executable', () => {
    const chrome = '/missing/chrome'
    const report = createDoctorReport({
      env: { PUPPETEER_EXECUTABLE_PATH: chrome },
      platform: 'darwin',
      arch: 'arm64',
      home: '/tmp/mdvp-home',
      nodeVersion: 'v22.0.0',
      spawnSync: fakeRunner({ npm: '10.0.0' }),
      fs: fakeFs(),
    })

    const browserRecommendation = report.recommendations.find((recommendation) => recommendation.id === 'browser')
    assert.equal(browserRecommendation.severity, 'warn')
    assert.match(browserRecommendation.message, /Fix PUPPETEER_EXECUTABLE_PATH/)
    assert.deepEqual(browserRecommendation.env, { PUPPETEER_EXECUTABLE_PATH: chrome })
  })
})

describe('formatDoctorText', () => {
  it('formats stable script-friendly text', () => {
    const report = createDoctorReport({
      env: {},
      platform: 'linux',
      arch: 'x64',
      home: '/tmp/mdvp-home',
      nodeVersion: 'v22.0.0',
      spawnSync: fakeRunner({ npm: '10.0.0' }),
      fs: fakeFs(),
    })
    const text = formatDoctorText(report)

    assert.match(text, /^MDVP doctor/)
    assert.match(text, /pass Node\.js:/)
    assert.match(text, /warn Browser runtime:/)
    assert.match(text, /Result: ready for exact browser audits\./)
    assert.match(text, /\nNext:\n/)
    assert.match(text, /warn browser: Install Chrome\/Chromium/)
  })
})
