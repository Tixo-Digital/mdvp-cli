import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { VERSION } from '../lib/constants.mjs'

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
