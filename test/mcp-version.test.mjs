import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { VERSION } from '../lib/constants.mjs'
import { SIGNALS_RESOURCE_URI, listResources, readResource } from '../mcp.mjs'
import { signalRows } from '../commands/signals.mjs'

const mcpSrc = readFileSync(fileURLToPath(new URL('../mcp.mjs', import.meta.url)), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('mcp server version', () => {
  it('does not contain the hardcoded "version: \\"1.0.0\\"" literal', () => {
    assert.equal(
      mcpSrc.includes('version: "1.0.0"'),
      false,
      'mcp.mjs still hardcodes version: "1.0.0" — should read from package.json'
    )
  })

  it('references the shared VERSION constant from lib/constants.mjs', () => {
    assert.match(mcpSrc, /from\s+["']\.\/lib\/constants\.mjs["']/)
    assert.match(mcpSrc, /version:\s*VERSION/)
  })

  it('VERSION exported from lib/constants.mjs equals package.json version', () => {
    assert.equal(VERSION, pkg.version)
    assert.notEqual(VERSION, '1.0.0', 'VERSION should not still be the placeholder 1.0.0')
    assert.match(VERSION, /^\d+\.\d+\.\d+(-[\w.]+)?$/, 'VERSION should be a semver string')
  })
})

describe('mcp resources', () => {
  it('advertises the stable signal catalog resource', () => {
    const result = listResources()

    assert.equal(Array.isArray(result.resources), true)
    assert.deepEqual(result.resources, [
      {
        uri: SIGNALS_RESOURCE_URI,
        name: 'MDVP signal catalog',
        description: 'Built-in originality and generated-UI signal detectors exposed as stable JSON.',
        mimeType: 'application/json',
      },
    ])
  })

  it('reads signal catalog JSON from the same rows as the CLI command', () => {
    const result = readResource(SIGNALS_RESOURCE_URI)
    const parsed = JSON.parse(result.contents[0].text)

    assert.deepEqual(result.contents.map((item) => item.uri), [SIGNALS_RESOURCE_URI])
    assert.equal(result.contents[0].mimeType, 'application/json')
    assert.deepEqual(parsed, signalRows())
    assert.deepEqual(Object.keys(parsed[0]), ['id', 'label', 'penalty', 'weight', 'rationale'])
  })

  it('rejects unknown resource URIs with a script-friendly message', () => {
    assert.throws(
      () => readResource('mdvp://unknown'),
      /Unknown resource: mdvp:\/\/unknown/
    )
  })
})
