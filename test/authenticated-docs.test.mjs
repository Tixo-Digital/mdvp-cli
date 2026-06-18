import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { HELP_TOPICS } from '../lib/constants.mjs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const readme = read('README.md')
const cliDocs = read('docs/cli.md')
const runtimeDocs = read('docs/runtime.md')
const architectureDocs = read('docs/architecture.md')
const authenticatedDocs = read('docs/authenticated-scoring.md')
const crawlerWorker = read('engine/crawler-worker.mjs')

describe('authenticated page scoring surface', () => {
  it('documents the authenticated scoring workflow from the public entry points', () => {
    assert.match(readme, /\[Authenticated page scoring\]\(docs\/authenticated-scoring\.md\)/)
    assert.match(readme, /MDVP_BROWSER_URL=http:\/\/127\.0\.0\.1:9222 npx @mdvp\/cli audit http:\/\/localhost:3000\/dashboard --json/)
    assert.match(cliDocs, /## Authenticated pages/)
    assert.match(cliDocs, /MDVP_BROWSER_URL=http:\/\/127\.0\.0\.1:9222 npx @mdvp\/cli audit http:\/\/localhost:3000\/dashboard --json/)
    assert.match(HELP_TOPICS.authenticated, /MDVP_BROWSER_URL=http:\/\/127\.0\.0\.1:9222 mdvp audit http:\/\/localhost:3000\/dashboard --json/)
  })

  it('keeps the privacy boundary explicit', () => {
    for (const doc of [cliDocs, authenticatedDocs]) {
      assert.match(doc, /Cookies, local storage, .*request headers.*not (printed|printed or POSTed)/s)
      assert.match(doc, /dedicated browser profile/)
      assert.match(doc, /127\.0\.0\.1/)
      assert.match(doc, /(Do not use|not appropriate).*(--swarm|swarm).*submit/s)
    }
  })

  it('connects to developer-owned Chrome without closing it', () => {
    assert.match(runtimeDocs, /MDVP_BROWSER_URL=http:\/\/127\.0\.0\.1:9222 audit <url>/)
    assert.match(architectureDocs, /puppeteer\.connect\(\), opens a new page/)
    assert.match(authenticatedDocs, /The crawler disconnects when it is done/)
    assert.match(crawlerWorker, /puppeteer\.connect/)
    assert.match(crawlerWorker, /browser\.disconnect\(\)/)
  })
})
