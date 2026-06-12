#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

const CLI = new URL('../cli.mjs', import.meta.url)
const args = process.argv.slice(2)
const target = args.find((arg) => !arg.startsWith('--')) || 'mdvp.dev'
const includeAudit = !args.includes('--no-audit')
const includeMemory = args.includes('--memory')
const auditExact = args.includes('--exact') || args.includes('--audit-exact')

const commands = [
  { name: 'help', args: ['help'] },
  { name: 'top5', args: ['top', '5'] },
  { name: 'stats-json', args: ['stats', '--json'] },
  ...(includeAudit ? [{ name: auditExact ? 'audit-exact-json' : 'audit-static-json', args: ['audit', target, ...(auditExact ? ['--exact'] : []), '--json'] }] : []),
]

const rows = []
for (const command of commands) {
  const nodeArgs = [CLI.pathname, ...command.args]
  const timed = buildTimedCommand(nodeArgs)
  const started = performance.now()
  const result = spawnSync(timed.command, timed.args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const durationMs = Math.round(performance.now() - started)
  const maxRssKb = parseMaxRssKb(result.stderr, timed.parser)
  rows.push({
    name: command.name,
    command: `node cli.mjs ${command.args.join(' ')}`,
    ok: result.status === 0,
    status: result.status,
    durationMs,
    ...(maxRssKb ? { maxRssKb } : {}),
    stderrTail: result.stderr.trim().split('\n').slice(-3).join('\n'),
  })
}

const summary = {
  generatedAt: new Date().toISOString(),
  target,
  auditMode: auditExact ? 'exact' : 'static',
  rows,
}

if (args.includes('--json')) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log('\nMDVP CLI performance')
  for (const row of rows) {
    const seconds = (row.durationMs / 1000).toFixed(2)
    const memory = row.maxRssKb ? `  ${(row.maxRssKb / 1024).toFixed(1)} MB max RSS` : ''
    console.log(`${row.ok ? 'ok ' : 'err'} ${row.name.padEnd(10)} ${seconds}s${memory}  ${row.command}`)
  }
  console.log()
}

if (rows.some((row) => !row.ok)) process.exit(1)

function buildTimedCommand(nodeArgs) {
  if (!includeMemory || !existsSync('/usr/bin/time')) {
    return { command: process.execPath, args: nodeArgs, parser: null }
  }
  if (process.platform === 'darwin') {
    return { command: '/usr/bin/time', args: ['-l', process.execPath, ...nodeArgs], parser: 'darwin' }
  }
  if (process.platform === 'linux') {
    return { command: '/usr/bin/time', args: ['-v', process.execPath, ...nodeArgs], parser: 'linux' }
  }
  return { command: process.execPath, args: nodeArgs, parser: null }
}

function parseMaxRssKb(stderr, parser) {
  if (!parser) return null
  if (parser === 'darwin') {
    const match = stderr.match(/^\s*(\d+)\s+maximum resident set size/m)
    return match ? Math.round(Number(match[1]) / 1024) : null
  }
  const match = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/)
  return match ? Number(match[1]) : null
}
