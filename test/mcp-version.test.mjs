import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const src = readFileSync(fileURLToPath(new URL('../mcp.mjs', import.meta.url)), 'utf8')

describe('mcp server version', () => {
  it('does not contain the hardcoded "version: \\"1.0.0\\"" literal', () => {
    assert.equal(
      src.includes('version: "1.0.0"'),
      false,
      'mcp.mjs still hardcodes version: "1.0.0" — should read from package.json'
    )
  })

  it('references the shared VERSION constant from lib/constants.mjs', () => {
    assert.match(src, /from\s+["']\.\/lib\/constants\.mjs["']/)
    assert.match(src, /version:\s*VERSION/)
  })

  it('package.json version matches the value the MCP server will report', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    assert.equal(pkg.version, '1.32.0')
    assert.notEqual(pkg.version, '1.0.0')
  })
})
