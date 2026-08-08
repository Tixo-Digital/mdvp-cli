import { homedir } from 'os'
import { chmodSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const CONFIG_DIR = `${homedir()}/.mdvp`
const CONFIG_FILE = `${CONFIG_DIR}/config.json`

function secureConfigPermissions(configFile) {
  const configDir = dirname(configFile)
  chmodSync(configDir, 0o700)
  chmodSync(configFile, 0o600)
}

function loadConfig(configFile = CONFIG_FILE) {
  try {
    secureConfigPermissions(configFile)
    return JSON.parse(readFileSync(configFile, 'utf8'))
  } catch {
    return {}
  }
}

function saveConfig(data, configFile = CONFIG_FILE) {
  const configDir = dirname(configFile)
  mkdirSync(configDir, { recursive: true, mode: 0o700 })
  chmodSync(configDir, 0o700)
  writeFileSync(configFile, JSON.stringify(data, null, 2), { mode: 0o600 })
  chmodSync(configFile, 0o600)
}

export { CONFIG_DIR, CONFIG_FILE, loadConfig, saveConfig }
