#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const releaseType = process.argv[2]
const allowed = new Set(['patch', 'minor', 'major'])

if (!allowed.has(releaseType)) {
  console.error('Usage: node scripts/release-version.mjs <patch|minor|major>')
  process.exit(1)
}

const root = dirname(dirname(fileURLToPath(import.meta.url)))

execSync(`npm version ${releaseType} --no-git-tag-version`, {
  cwd: root,
  stdio: 'inherit',
})

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version

execSync('git add package.json package-lock.json', {
  cwd: root,
  stdio: 'inherit',
})
execSync(`git commit -m "chore: release v${version}"`, {
  cwd: root,
  stdio: 'inherit',
})
execSync(`git tag v${version}`, {
  cwd: root,
  stdio: 'inherit',
})

console.log(`Created tag v${version}. Push with: git push && git push --tags`)
