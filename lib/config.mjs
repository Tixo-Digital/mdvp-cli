import { homedir } from 'os'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const CONFIG_DIR = `${homedir()}/.mdvp`
const CONFIG_FILE = `${CONFIG_DIR}/config.json`

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) } catch { return {} }
}

function saveConfig(data) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2))
}

export { CONFIG_DIR, CONFIG_FILE, loadConfig, saveConfig }
