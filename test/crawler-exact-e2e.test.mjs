import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'

const puppeteerModules = join(homedir(), '.mdvp/crawler/node_modules')
const hasPuppeteer = existsSync(join(puppeteerModules, 'puppeteer/package.json'))
const crawlerDir = join(homedir(), '.mdvp/crawler')
const puppeteerExecutablePath = hasPuppeteer ? resolvePuppeteerExecutablePath() : null

describe('crawler exact e2e', () => {
  it('keeps --exact from using the fast request-abort path', { skip: hasPuppeteer ? false : 'requires ~/.mdvp/crawler/node_modules/puppeteer' }, async () => {
    const tempDir = mkdtempSync(join(crawlerDir, 'e2e-'))
    const serverState = { imageRequests: 0 }
    const server = createServer((req, res) => {
      if (req.url === '/pixel.png') {
        serverState.imageRequests += 1
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
        res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'))
        return
      }

      const blocks = Array.from({ length: 120 }, (_, i) => `<div class="card">Item ${i}</div>`).join('')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(`<!doctype html>
<html>
  <head>
    <style>
      :root { --color-bg: #ffffff; --color-text: #151515; --space-4: 16px; --radius-md: 8px; }
      body { margin: 0; padding: 32px; color: var(--color-text); background: var(--color-bg); font-family: Arial, sans-serif; }
      main { display: grid; gap: var(--space-4); grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .card { padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid #dddddd; }
    </style>
  </head>
  <body>
    <img src="/pixel.png" width="1" height="1" alt="">
    <main>${blocks}</main>
  </body>
</html>`)
    })

    try {
      copyFileSync(new URL('../engine/crawler-worker.mjs', import.meta.url), join(tempDir, 'crawler-worker.mjs'))
      copyFileSync(new URL('../engine/extract.js', import.meta.url), join(tempDir, 'extract.js'))

      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const target = `http://127.0.0.1:${server.address().port}`

      serverState.imageRequests = 0
      await runWorker(tempDir, target, {})
      assert.equal(serverState.imageRequests, 0, 'fast audit should abort image requests before they reach the server')

      serverState.imageRequests = 0
      await runWorker(tempDir, target, { exact: true })
      assert.ok(serverState.imageRequests > 0, 'exact audit should allow browser asset requests')
    } finally {
      await new Promise((resolve) => server.close(resolve))
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})

function runWorker(cwd, target, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['crawler-worker.mjs'], {
      cwd,
      env: {
        ...process.env,
        API_URL: 'http://127.0.0.1:9',
        CRAWL_ONCE: target,
        CRAWL_ONCE_STDOUT: '1',
        CRAWL_FAST_SETTLE_MS: '0',
        NODE_ID: options.exact ? 'e2e-exact' : 'e2e-fast',
        ...(puppeteerExecutablePath ? { PUPPETEER_EXECUTABLE_PATH: puppeteerExecutablePath } : {}),
        TABS: '1',
        ...(options.exact ? { CRAWL_ONCE_EXACT: '1' } : {}),
      },
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`worker timed out\n${stderr}\n${stdout}`))
    }, 45000)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error([signal ? `signal=${signal}` : null, stderr, stdout].filter(Boolean).join('\n')))
        return
      }
      try {
        const payload = JSON.parse(stdout)
        assert.ok(payload.metrics && typeof payload.metrics === 'object')
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  })
}

function resolvePuppeteerExecutablePath() {
  const result = spawnSync(process.execPath, ['-e', "import('puppeteer').then((p) => console.log(p.default.executablePath()))"], {
    cwd: crawlerDir,
    encoding: 'utf8',
    timeout: 10000,
  })
  return result.status === 0 ? result.stdout.trim() : null
}
