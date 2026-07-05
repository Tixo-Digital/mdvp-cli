import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  checkDiff,
  cmdDiff,
  diffSnapshots,
  formatDiffCheckText,
  formatDiffText,
  loadSnapshot,
  normalizeSnapshot,
} from '../commands/diff.mjs'

const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, '')

const before = {
  id: 'preview.example.com',
  url: 'https://preview.example.com',
  grade: 'C+',
  overall_score: 68,
  components: {
    css_health: { score: 61, unique_colors: 18 },
    visual_quality: { score: 72 },
    structure: { score: 80 },
    originality: { score: 58 },
  },
  scores: {
    breakdown: {
      spacing: 64,
      typography: 70,
      color: 55,
      components: 82,
      modernity: 60,
      originality: 58,
      html_quality: 88,
      visual_polish: 69,
      sophistication: 62,
      readability: 75,
      ux_patterns: 80,
      contentDepth: 52,
    },
  },
}

const after = {
  id: 'preview.example.com',
  url: 'https://preview.example.com',
  grade: 'B-',
  overall_score: 74,
  components: {
    css_health: { score: 70, unique_colors: 12 },
    visual_quality: { score: 69 },
    structure: { score: 84 },
    originality: { score: 60 },
  },
  scores: {
    breakdown: {
      spacing: 72,
      typography: 70,
      color: 68,
      components: 82,
      modernity: 64,
      originality: 60,
      html_quality: 90,
      visual_polish: 68,
      sophistication: 65,
      readability: 75,
      ux_patterns: 78,
      contentDepth: 55,
    },
  },
}

const afterNoComponentRegression = {
  ...after,
  components: {
    ...after.components,
    visual_quality: { score: 72 },
  },
}

function tempFile(name, contents) {
  const cwd = mkdtempSync(join(tmpdir(), 'mdvp-diff-'))
  const path = join(cwd, name)
  writeFileSync(path, contents)
  return path
}

describe('normalizeSnapshot', () => {
  it('normalizes local audit JSON', () => {
    const snapshot = normalizeSnapshot(before, 'before.json')

    assert.equal(snapshot.id, 'preview.example.com')
    assert.equal(snapshot.overall, 68)
    assert.equal(snapshot.components.css_health, 61)
    assert.equal(snapshot.categories.spacing, 64)
  })

  it('normalizes cloud raw breakdown arrays', () => {
    const snapshot = normalizeSnapshot({
      id: 'cloud.example.com',
      overall_score: 81,
      scores: {
        breakdown: [
          { c: 'spacing', s: 76 },
          { key: 'color', score: 88 },
        ],
      },
    })

    assert.equal(snapshot.overall, 81)
    assert.equal(snapshot.categories.spacing, 76)
    assert.equal(snapshot.categories.color, 88)
  })

  it('rejects files without score data', () => {
    assert.throws(
      () => normalizeSnapshot({ id: 'bad.example.com' }, 'bad.json'),
      /bad\.json: missing overall_score/,
    )
    assert.throws(
      () => normalizeSnapshot({ id: 'bad.example.com', overall_score: 10 }, 'bad.json'),
      /bad\.json: missing component or category score data/,
    )
  })
})

describe('diffSnapshots', () => {
  it('returns deterministic overall, component, and category changes', () => {
    const diff = diffSnapshots(before, after)

    assert.equal(diff.delta.overall, 6)
    assert.equal(diff.summary.improved, 11)
    assert.equal(diff.summary.regressed, 3)
    assert.deepEqual(diff.changed.slice(0, 4).map((item) => item.key), [
      'overall',
      'css_health',
      'visual_quality',
      'structure',
    ])
    assert.deepEqual(diff.changed.find((item) => item.key === 'color'), {
      scope: 'category',
      key: 'color',
      label: 'Color',
      before: 55,
      after: 68,
      delta: 13,
    })
  })

  it('passes check mode when overall and component scores do not regress', () => {
    const check = checkDiff(diffSnapshots(before, afterNoComponentRegression))

    assert.equal(check.ok, true)
    assert.equal(check.status, 'pass')
    assert.equal(check.policy, 'overall-or-component-regression')
    assert.deepEqual(check.regressions, [])
  })

  it('fails check mode on overall or component regressions', () => {
    const regressed = {
      ...after,
      overall_score: 66,
      components: {
        ...after.components,
        css_health: { score: 59 },
        structure: { score: 79 },
      },
    }
    const check = checkDiff(diffSnapshots(before, regressed))

    assert.equal(check.ok, false)
    assert.equal(check.status, 'fail')
    assert.equal(check.regressionCount, 4)
    assert.deepEqual(check.regressions.map((item) => item.key), [
      'overall',
      'css_health',
      'visual_quality',
      'structure',
    ])
  })

  it('formats text output without enforcing thresholds', () => {
    const output = stripAnsi(formatDiffText(diffSnapshots(before, after)))

    assert.match(output, /preview\.example\.com -> preview\.example\.com/)
    assert.match(output, /Overall\s+68 -> 74\s+\+6/)
    assert.match(output, /css_health\s+61 -> 70\s+\+9/)
    assert.match(output, /Color\s+55 -> 68\s+\+13/)
  })

  it('formats check status as a single script-friendly line', () => {
    const passing = stripAnsi(formatDiffCheckText(checkDiff(diffSnapshots(before, afterNoComponentRegression))))
    const failing = stripAnsi(formatDiffCheckText(checkDiff(diffSnapshots(after, before))))

    assert.match(passing, /Check: PASS no overall\/component regressions/)
    assert.match(failing, /Check: FAIL 4 overall\/component regressions/)
  })
})

describe('loadSnapshot', () => {
  it('loads valid JSON snapshots from disk', () => {
    const path = tempFile('snapshot.json', JSON.stringify(before))
    const snapshot = loadSnapshot(path)

    assert.equal(snapshot.overall, 68)
  })

  it('reports missing and malformed files with script-friendly messages', () => {
    assert.throws(() => loadSnapshot('/tmp/mdvp-diff-missing.json'), /file not found/)

    const malformed = tempFile('bad.json', '{bad json')
    assert.throws(() => loadSnapshot(malformed), /malformed JSON/)
  })
})

describe('cmdDiff', () => {
  it('returns JSON check metadata and sets exitCode on check failure', async () => {
    const beforePath = tempFile('before.json', JSON.stringify(before))
    const afterPath = tempFile('after.json', JSON.stringify({
      ...after,
      overall_score: 60,
    }))
    const originalExitCode = process.exitCode
    const logs = []
    const originalLog = console.log
    console.log = (value) => logs.push(value)
    process.exitCode = undefined

    try {
      const result = await cmdDiff(beforePath, afterPath, { json: true, check: true })

      assert.equal(process.exitCode, 1)
      assert.equal(result.check.ok, false)
      assert.equal(result.check.regressions[0].key, 'overall')
      const parsed = JSON.parse(logs[0])
      assert.equal(parsed.check.policy, 'overall-or-component-regression')
    } finally {
      console.log = originalLog
      process.exitCode = originalExitCode
    }
  })
})
