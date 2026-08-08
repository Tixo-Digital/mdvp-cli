import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig, saveConfig } from '../lib/config.mjs'

const permissionBits = (path) => statSync(path).mode & 0o777

describe('API key config permissions', { skip: process.platform === 'win32' }, () => {
  it('creates the config directory as 0700 and the key file as 0600', () => {
    const root = mkdtempSync(join(tmpdir(), 'mdvp-config-test-'))
    const configFile = join(root, '.mdvp', 'config.json')
    try {
      saveConfig({ apiKey: 'ds_test' }, configFile)

      assert.equal(permissionBits(join(root, '.mdvp')), 0o700)
      assert.equal(permissionBits(configFile), 0o600)
      assert.deepEqual(JSON.parse(readFileSync(configFile, 'utf8')), { apiKey: 'ds_test' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('repairs permissions on an existing config before reading it', () => {
    const root = mkdtempSync(join(tmpdir(), 'mdvp-config-test-'))
    const configDir = join(root, '.mdvp')
    const configFile = join(configDir, 'config.json')
    try {
      mkdirSync(configDir, { mode: 0o755 })
      writeFileSync(configFile, JSON.stringify({ apiKey: 'ds_existing' }), { mode: 0o644 })
      chmodSync(configDir, 0o755)
      chmodSync(configFile, 0o644)

      assert.deepEqual(loadConfig(configFile), { apiKey: 'ds_existing' })
      assert.equal(permissionBits(configDir), 0o700)
      assert.equal(permissionBits(configFile), 0o600)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
