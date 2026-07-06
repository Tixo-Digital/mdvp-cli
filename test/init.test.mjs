import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { initProject, workflowTemplate } from '../commands/init.mjs'

function tempProject() {
  return mkdtempSync(join(tmpdir(), 'mdvp-init-'))
}

function actionInputNames() {
  const metadata = readFileSync(new URL('../action/action.yml', import.meta.url), 'utf8')
  const inputsBlock = metadata.split('\noutputs:')[0].split('\ninputs:')[1]
  return new Set([...inputsBlock.matchAll(/^  ([a-z][a-z0-9_]*):$/gm)].map((match) => match[1]))
}

describe('initProject', () => {
  it('creates .mdvprc by default', () => {
    const cwd = tempProject()
    const result = initProject({ cwd })

    assert.deepEqual(result.files, [{ path: '.mdvprc', status: 'created' }])
    const config = JSON.parse(readFileSync(join(cwd, '.mdvprc'), 'utf8'))
    assert.equal(config.thresholds.max_colors, 30)
    assert.equal(config.thresholds.min_overall, 40)
  })

  it('does not overwrite existing files by default', () => {
    const cwd = tempProject()
    const target = join(cwd, '.mdvprc')
    writeFileSync(target, '{"custom":true}\n')

    const result = initProject({ cwd })

    assert.deepEqual(result.files, [{ path: '.mdvprc', status: 'exists' }])
    assert.equal(readFileSync(target, 'utf8'), '{"custom":true}\n')
  })

  it('overwrites existing files with force', () => {
    const cwd = tempProject()
    const target = join(cwd, '.mdvprc')
    writeFileSync(target, '{"custom":true}\n')

    const result = initProject({ cwd, force: true })

    assert.deepEqual(result.files, [{ path: '.mdvprc', status: 'overwritten' }])
    const config = JSON.parse(readFileSync(target, 'utf8'))
    assert.equal(config.thresholds.max_font_families, 3)
  })

  it('creates a GitHub Actions workflow when requested', () => {
    const cwd = tempProject()
    const result = initProject({ cwd, githubAction: true, url: 'https://preview.example.com' })
    const workflowPath = join(cwd, '.github/workflows/mdvp.yml')

    assert.deepEqual(result.files, [
      { path: '.mdvprc', status: 'created' },
      { path: '.github/workflows/mdvp.yml', status: 'created' },
    ])
    assert.ok(existsSync(workflowPath))
    const workflow = readFileSync(workflowPath, 'utf8')
    assert.ok(workflow.includes('Tixo-Digital/mdvp-cli/action@main'))
    assert.ok(workflow.includes('https://preview.example.com'))
  })

  it('dry-run reports planned files without writing', () => {
    const cwd = tempProject()
    const result = initProject({ cwd, dryRun: true, githubAction: true })

    assert.deepEqual(result.files, [
      { path: '.mdvprc', status: 'would-create' },
      { path: '.github/workflows/mdvp.yml', status: 'would-create' },
    ])
    assert.equal(existsSync(join(cwd, '.mdvprc')), false)
    assert.equal(existsSync(join(cwd, '.github/workflows/mdvp.yml')), false)
  })

  it('returns a stable JSON-friendly summary shape', () => {
    const cwd = tempProject()
    const result = initProject({ cwd, dryRun: true })

    assert.equal(result.ok, true)
    assert.equal(result.dryRun, true)
    assert.equal(result.force, false)
    assert.equal(result.githubAction, false)
    assert.deepEqual(Object.keys(result.files[0]), ['path', 'status'])
    assert.ok(result.next.every((line) => typeof line === 'string'))
  })
})

describe('workflowTemplate', () => {
  it('uses MDVP_TARGET_URL repository variable by default', () => {
    const workflow = workflowTemplate()
    assert.ok(workflow.includes('vars.MDVP_TARGET_URL'))
    assert.match(workflow, /workflow_dispatch/)
  })

  it('only passes declared action inputs', () => {
    const workflow = workflowTemplate()
    const actionInputs = actionInputNames()

    for (const input of ['url', 'fail_on_violation', 'comment_on_pr']) {
      assert.ok(workflow.includes(`${input}:`), `workflow should pass ${input}`)
      assert.ok(actionInputs.has(input), `action should declare ${input}`)
    }
  })
})

describe('GitHub Action metadata', () => {
  it('wires outputs and writes review-friendly summaries', () => {
    const metadata = readFileSync(new URL('../action/action.yml', import.meta.url), 'utf8')

    assert.match(metadata, /overall_score:[\s\S]*value: \$\{\{ steps\.audit\.outputs\.overall_score \}\}/)
    assert.match(metadata, /report_json:[\s\S]*value: \$\{\{ steps\.audit\.outputs\.report_json \}\}/)
    assert.match(metadata, /GITHUB_STEP_SUMMARY/)
    assert.match(metadata, /actions\/github-script@v7/)
    assert.match(metadata, /mdvp-cli-action-report/)
    assert.match(metadata, /violation_count=\$VIOLATIONS/)
    assert.match(metadata, /MDVP_ANNOTATION_LEVEL=error/)
    assert.match(metadata, /MDVP_ANNOTATION_LEVEL=warning/)
    assert.match(metadata, /MDVP threshold violation/)
    assert.match(metadata, /replace\(\/%\/g, '%25'\)/)
    assert.match(metadata, /name: Enforce thresholds/)
  })

  it('fails clearly when the audit command does not emit JSON', () => {
    const metadata = readFileSync(new URL('../action/action.yml', import.meta.url), 'utf8')
    const auditLine = metadata
      .split('\n')
      .find((line) => line.includes('npx --yes @mdvp/cli@latest audit'))

    assert.ok(auditLine)
    assert.ok(auditLine.includes('> /tmp/mdvp-report.json'))
    assert.equal(auditLine.includes('|| true'), false)
    assert.match(metadata, /MDVP audit did not produce valid JSON output/)
    assert.match(metadata, /MDVP Raw Output/)
    assert.match(metadata, /EXIT_CODE=\$\?/)
  })
})
