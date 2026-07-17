import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

import { VERSION } from '../lib/constants.mjs'

function runCli(args) {
  return spawnSync(process.execPath, ['cli.mjs', ...args], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
}

describe('version output', () => {
  for (const args of [['--version'], ['-v'], ['version']]) {
    it(`prints only the package version for mdvp ${args.join(' ')}`, () => {
      const result = runCli(args)

      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.equal(result.stdout, `${VERSION}\n`)
    })
  }

  it('documents the global version flag in help output', () => {
    const result = runCli(['help'])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /mdvp --version/)
    assert.match(result.stdout, /--version\s+-v\s+Print package version/)
  })
})
