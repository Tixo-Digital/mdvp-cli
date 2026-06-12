import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { analyzeStaticUrl } from '../engine/static-analyzer.mjs'

describe('static analyzer', () => {
  it('extracts DOMMetrics from HTML and same-origin CSS without a browser', async () => {
    let cssRequests = 0
    const server = createServer((req, res) => {
      if (req.url === '/style.css') {
        cssRequests += 1
        res.writeHead(200, { 'content-type': 'text/css' })
        res.end(`
          :root { --color-bg: #ffffff; --space-4: 16px; }
          @container card (min-width: 300px) { .card { padding: 24px; } }
          body { color: #111111; background: #ffffff; font-family: Inter, sans-serif; font-size: 18px; }
          .card { padding: 16px; border-radius: 8px; gap: 16px; box-shadow: 0 8px 20px rgba(0,0,0,.12); }
          .cta { background: #2563eb; color: #ffffff; font-weight: 700; }
        `)
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(`<!doctype html>
        <html lang="en">
          <head>
            <title>Static Analyzer Fixture</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="description" content="A useful product page">
            <link rel="stylesheet" href="/style.css">
          </head>
          <body>
            <nav><a href="/docs">Docs</a><a href="/pricing">Pricing</a></nav>
            <main>
              <h1>Product quality</h1>
              <section class="card"><p>Useful text</p><a class="cta" href="/start">Get started</a></section>
            </main>
          </body>
        </html>`)
    })

    try {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const result = await analyzeStaticUrl(`http://127.0.0.1:${server.address().port}`)
      assert.equal(result.analysis.mode, 'static')
      assert.ok(['rust', 'js-fallback'].includes(result.analysis.analyzer))
      assert.ok(result.analysis.limitations.includes('no browser layout'))
      assert.equal(cssRequests, 1)
      assert.equal(result.metrics.hasViewportMeta, true)
      assert.equal(result.metrics.hasLangAttr, true)
      assert.equal(result.metrics.h1Count, 1)
      assert.ok(result.metrics.totalElements >= 10)
      assert.ok(result.metrics.colors.length >= 3)
      assert.ok(result.metrics.fontSizes.some(([value]) => value === '18px'))
      assert.ok(result.metrics.paddings.some(([value]) => value === '16px'))
      assert.equal(result.metrics.hasContainerQueries, true)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('fetches same-origin stylesheets concurrently while keeping the stylesheet cap', async () => {
    let activeCss = 0
    let maxActiveCss = 0
    let cssRequests = 0
    const server = createServer(async (req, res) => {
      if (req.url?.startsWith('/style-')) {
        activeCss += 1
        cssRequests += 1
        maxActiveCss = Math.max(maxActiveCss, activeCss)
        await new Promise((resolve) => setTimeout(resolve, 75))
        activeCss -= 1
        res.writeHead(200, { 'content-type': 'text/css' })
        res.end(`
          body { color: #111111; font-family: Inter, sans-serif; font-size: 18px; }
          .${req.url.slice(1, -4)} { padding: 16px; }
        `)
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(`<!doctype html>
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="/style-one.css">
            <link rel="stylesheet" href="/style-two.css">
            <link rel="stylesheet" href="/style-three.css">
          </head>
          <body><main><h1>Concurrent CSS</h1><p>Useful text</p></main></body>
        </html>`)
    })

    try {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const result = await analyzeStaticUrl(`http://127.0.0.1:${server.address().port}`, { maxStylesheets: 2 })
      assert.equal(result.analysis.mode, 'static')
      assert.equal(cssRequests, 2)
      assert.ok(maxActiveCss > 1)
      assert.ok(result.metrics.colors.length >= 1)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
