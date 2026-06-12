import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../engine/crawler-worker.mjs', import.meta.url), 'utf8')

describe('crawler fast audit path', () => {
  it('keeps CRAWL_ONCE_STDOUT on a metrics-only fast path by default', () => {
    assert.match(src, /async function crawlUrl\(browser, url, options = \{\}\)/)
    assert.match(src, /const artifacts = options\.artifacts !== false/)
    assert.match(src, /const fast = options\.fast === true/)
    assert.doesNotMatch(src, /const fast = options\.fast === true \|\| !artifacts/)
    assert.match(src, /artifacts:\s*!stdoutMode \|\| includeScreenshots/)
    assert.match(src, /fast:\s*!exactMode && \(forceFast \|\| \(stdoutMode && !includeScreenshots\)\)/)
  })

  it('does not run video, page html, or screenshots when artifacts are disabled', () => {
    assert.match(src, /if \(artifacts\) \{[\s\S]*page\.content\(\)[\s\S]*page\.screencast/m)
    assert.match(src, /if \(!artifacts\) \{[\s\S]*screenshots: \{\}[\s\S]*video: null[\s\S]*html: null/m)
    assert.match(src, /if \(!fast && elCount < 100\)/)
  })

  it('keeps metrics-only exact waits shorter than artifact-producing crawls', () => {
    assert.match(src, /CRAWL_EXACT_STYLE_SETTLE_MS'[\s\S]*artifacts \? 1500 : 150/)
    assert.match(src, /CRAWL_EXACT_MUTATION_SETTLE_MS'[\s\S]*artifacts \? 2000 : 400/)
    assert.match(src, /CRAWL_EXACT_SPARSE_DOM_WAIT_MS'[\s\S]*artifacts \? 4000 : 350/)
    assert.match(src, /async function waitForDomStability/)
  })

  it('keeps artifact exact navigation stricter than metrics-only exact navigation', () => {
    assert.match(src, /const exactWaitUntil = artifacts \? 'networkidle2' : \(process\.env\.CRAWL_EXACT_WAIT_UNTIL \|\| 'load'\)/)
    assert.match(src, /const exactTimeout = envInt\('CRAWL_EXACT_TIMEOUT_MS', artifacts \? 25000 : 12000\)/)
  })

  it('keeps screenshot capture available only for artifact-producing crawls', () => {
    assert.match(src, /const includeScreenshots = process\.env\.CRAWL_ONCE_SCREENSHOTS === '1'/)
    assert.match(src, /const exactMode = process\.env\.CRAWL_ONCE_EXACT === '1'/)
    assert.match(src, /const forceFast = process\.env\.CRAWL_ONCE_FAST === '1'/)
    assert.match(src, /\.\.\.\(includeScreenshots \? \{ screenshots: result\.screenshots \} : \{\}\)/)
  })
})
