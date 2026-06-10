import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

import { DEFAULT_THRESHOLDS } from '../engine/thresholds.mjs'

const DEFAULT_CONFIG = {
  thresholds: {
    max_colors: DEFAULT_THRESHOLDS.max_colors,
    max_font_families: DEFAULT_THRESHOLDS.max_font_families,
    max_font_sizes: DEFAULT_THRESHOLDS.max_font_sizes,
    max_border_radii: DEFAULT_THRESHOLDS.max_border_radii,
    min_spacing_grid_pct: DEFAULT_THRESHOLDS.min_spacing_grid_pct,
    min_css_health: DEFAULT_THRESHOLDS.min_css_health,
    min_visual_quality: DEFAULT_THRESHOLDS.min_visual_quality,
    min_structure: DEFAULT_THRESHOLDS.min_structure,
    min_originality: DEFAULT_THRESHOLDS.min_originality,
    min_overall: DEFAULT_THRESHOLDS.min_overall,
  },
  signals: {
    disabled: [],
    penalties: {},
  },
}

function configTemplate() {
  return `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`
}

function workflowTemplate(url = null) {
  const targetExpression = url
    ? JSON.stringify(url)
    : '"${{ github.event.inputs.url || vars.MDVP_TARGET_URL }}"'

  return `name: MDVP design quality

on:
  pull_request:
  workflow_dispatch:
    inputs:
      url:
        description: URL to audit
        required: false
        type: string

jobs:
  design:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Resolve audit URL
        id: target
        shell: bash
        run: |
          URL=${targetExpression}
          if [ -z "$URL" ]; then
            echo "Set repository variable MDVP_TARGET_URL or run this workflow with a url input." >&2
            exit 1
          fi
          echo "url=$URL" >> "$GITHUB_OUTPUT"

      - uses: Tixo-Digital/mdvp-cli/action@main
        with:
          url: \${{ steps.target.outputs.url }}
          fail_on_violation: 'true'
          comment_on_pr: 'true'
`
}

function planFile(cwd, path, contents, opts) {
  const absolutePath = join(cwd, path)
  const exists = existsSync(absolutePath)
  const willWrite = !opts.dryRun && (!exists || opts.force)
  const status = exists
    ? (opts.force ? (opts.dryRun ? 'would-overwrite' : 'overwritten') : 'exists')
    : (opts.dryRun ? 'would-create' : 'created')

  return { path, absolutePath, contents, exists, willWrite, status }
}

function initProject(options = {}) {
  const opts = {
    cwd: process.cwd(),
    dryRun: false,
    force: false,
    githubAction: false,
    url: null,
    ...options,
  }

  const files = [
    planFile(opts.cwd, '.mdvprc', configTemplate(), opts),
  ]

  if (opts.githubAction) {
    files.push(planFile(
      opts.cwd,
      '.github/workflows/mdvp.yml',
      workflowTemplate(opts.url),
      opts
    ))
  }

  for (const file of files) {
    if (!file.willWrite) continue
    mkdirSync(dirname(file.absolutePath), { recursive: true })
    writeFileSync(file.absolutePath, file.contents)
  }

  return {
    ok: true,
    dryRun: opts.dryRun,
    force: opts.force,
    githubAction: opts.githubAction,
    files: files.map(({ path, status }) => ({ path, status })),
    next: [
      'npx @mdvp/cli audit <url> --check',
      opts.githubAction
        ? 'Set repository variable MDVP_TARGET_URL or run the workflow manually with a url input.'
        : 'Run mdvp init --github-action to add a GitHub Actions gate.',
    ],
  }
}

function formatInitText(result) {
  const lines = ['MDVP init', '']
  for (const file of result.files) {
    const verb = file.status === 'exists' ? 'skipped' : file.status
    const suffix = file.status === 'exists' ? ' (already exists; use --force to overwrite)' : ''
    lines.push(`  ${verb} ${file.path}${suffix}`)
  }
  lines.push('', 'Next:')
  for (const item of result.next) lines.push(`  ${item}`)
  return `${lines.join('\n')}\n`
}

async function cmdInit(opts = {}) {
  const result = initProject(opts)
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
    return result
  }
  process.stdout.write(formatInitText(result))
  return result
}

export {
  DEFAULT_CONFIG,
  configTemplate,
  workflowTemplate,
  initProject,
  formatInitText,
  cmdInit,
}
