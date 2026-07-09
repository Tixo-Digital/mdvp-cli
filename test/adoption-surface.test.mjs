import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const readme = read('README.md')
const adoption = read('docs/adoption.md')
const agentWorkflows = read('docs/agent-workflows.md')
const developmentProof = read('docs/development-proof.md')
const cliDocs = read('docs/cli.md')
const binaries = read('docs/binaries.md')
const development = read('docs/development.md')
const roadmap = read('ROADMAP.md')
const pkg = JSON.parse(read('package.json'))

describe('public adoption surface', () => {
  it('keeps the README first viewport focused on the public use case', () => {
    const firstViewport = readme.split('\n').slice(0, 28).join('\n')

    assert.match(firstViewport, /^# @mdvp\/cli/m)
    assert.match(firstViewport, /Design linter for AI-generated frontends/)
    assert.match(firstViewport, /no API key, no account, and no screenshot baseline/)
    assert.match(firstViewport, /npx @mdvp\/cli audit myapp\.com/)
    assert.match(firstViewport, /docs\/assets\/cli-audit-mdvp-dev\.png/)
    assert.equal(firstViewport.includes('DOM analysis for any live URL'), false)
    assert.equal(firstViewport.trimStart().startsWith('```'), false)
  })

  it('keeps developer workflow proof linked from the README', () => {
    assert.equal(existsSync(new URL('../docs/assets/cli-audit-mdvp-dev.png', import.meta.url)), true)
    assert.equal(existsSync(new URL('../docs/assets/cli-audit-mdvp-dev.svg', import.meta.url)), true)
    assert.match(readme, /## Development Proof/)
    assert.match(readme, /5 font families/)
    assert.match(readme, /consolidate the site typography stack/)
    assert.match(readme, /\[Development proof\]\(docs\/development-proof\.md\)/)
    assert.match(readme, /\[Benchmark\]\(docs\/benchmark\.md\)/)
  })

  it('links the adoption playbook from README documentation', () => {
    assert.match(readme, /\[Adoption playbook\]\(docs\/adoption\.md\)/)
    assert.match(adoption, /^# Adoption Playbook/m)
    assert.match(adoption, /Design linter for AI-generated frontends/)
    assert.match(adoption, /\[Development proof\]\(development-proof\.md\)/)
  })

  it('documents agent workflows without overstating design judgment', () => {
    assert.match(adoption, /\[Agent workflows\]\(agent-workflows\.md\)/)
    assert.match(agentWorkflows, /^# Agent Workflows/m)
    assert.match(agentWorkflows, /rendered-DOM linter/)
    assert.match(agentWorkflows, /npx @mdvp\/cli doctor/)
    assert.match(agentWorkflows, /npx @mdvp\/cli audit https:\/\/preview\.example\.com --json/)
    assert.match(agentWorkflows, /npx @mdvp\/cli init --github-action/)
    assert.match(agentWorkflows, /npx @mdvp\/cli mcp-config/)
    assert.match(agentWorkflows, /audit_url/)
    assert.match(agentWorkflows, /perceive_url/)
    assert.match(agentWorkflows, /Do not claim MDVP proves a design is good or bad universally/)
  })

  it('documents standalone binary constraints without replacing the full CLI', () => {
    assert.match(readme, /\[Standalone binaries\]\(docs\/binaries\.md\)/)
    assert.match(binaries, /^# Standalone Binaries/m)
    assert.match(binaries, /The first standalone binary should be a \*\*static-only audit binary\*\*/)
    assert.match(binaries, /The full CLI stays on npm/)
    assert.match(binaries, /Chromium should remain an external runtime/)
  })

  it('documents proof as actionable development workflow, not only tests', () => {
    assert.match(developmentProof, /Dogfood Audit Found A Real Fix/)
    assert.match(developmentProof, /5 font families/)
    assert.match(developmentProof, /The fix is concrete/)
    assert.match(developmentProof, /Before\/After Workflow/)
    assert.match(developmentProof, /Pull Request Gate/)
    assert.match(developmentProof, /What This Does Not Prove/)
  })

  it('documents runnable conversion commands that are covered by CLI docs', () => {
    const commands = [
      'npx @mdvp/cli audit myapp.com',
      'npx @mdvp/cli init --github-action',
      'npx @mdvp/cli badge myapp.com',
    ]

    for (const command of commands) {
      assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.match(adoption, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }

    assert.match(cliDocs, /npx @mdvp\/cli audit myapp\.com/)
    assert.match(cliDocs, /npx @mdvp\/cli init --github-action/)
    assert.match(cliDocs, /npx @mdvp\/cli badge mysite\.com/)
  })

  it('aligns npm metadata with discoverable adoption terms', () => {
    assert.match(pkg.description, /Design linter for AI-generated frontends/)
    assert.match(pkg.description, /CI gates/)
    assert.match(pkg.description, /MCP/)
    assert.ok(pkg.files.includes('docs/'), 'docs should ship so npm README links and proof assets resolve')
    assert.equal(pkg.files.includes('action/'), false, 'GitHub Action files should stay out of the npm package')
    assert.equal(pkg.files.includes('.github/'), false, 'GitHub metadata should stay out of the npm package')

    for (const keyword of [
      'design-linter',
      'frontend-quality',
      'ai-ui',
      'vibe-code',
      'visual-regression',
      'github-action',
      'mcp',
      'design-system',
      'accessibility',
    ]) {
      assert.ok(pkg.keywords.includes(keyword), `missing keyword: ${keyword}`)
    }
  })

  it('keeps roadmap claims aligned with shipped adoption features', () => {
    assert.match(roadmap, /## Shipped in the public CLI/)
    assert.match(roadmap, /Score badge generator/)
    assert.match(roadmap, /Snapshot diff/)
    assert.match(roadmap, /## Current work/)
    assert.match(roadmap, /## Next public CLI improvements/)
    assert.equal(
      /## Next public CLI improvements[\s\S]*Badge generator/.test(roadmap),
      false,
      'badge generator should not be listed as future work after shipping',
    )
  })

  it('documents local nightly automation before cloud fallback', () => {
    assert.match(development, /## Local Codex \/ Devbox/)
    assert.match(development, /local canonical checkout by default/)
    assert.match(development, /isolated worktree from `origin\/main`/)
    assert.match(development, /npm ci/)
    assert.match(development, /npm pack --dry-run/)
    assert.match(development, /Cloud Codex remains a manual fallback environment/)
    assert.equal(
      development.includes('Nightly automation runs in Cloud Codex'),
      false,
      'development docs should not describe Cloud Codex as the default nightly runner',
    )
  })
})
