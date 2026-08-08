import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  CrawlerAuthorizationError,
  createCrawlerRpcClient,
} from '../engine/crawler-auth.mjs'

function jsonResponse(status, body) {
  if (status === 204) return new Response(null, { status })
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('crawler RPC authorization', () => {
  it('bootstraps with the API key and sends only the scoped bearer token to RPC', async () => {
    const calls = []
    const client = createCrawlerRpcClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'ds_private',
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        if (url.endsWith('/crawl/authorize')) return jsonResponse(200, { token: 'scoped-token', expires_in: 900 })
        return jsonResponse(204, {})
      },
    })

    await client.request('/crawl/claim', { method: 'POST', body: '{}' })

    assert.equal(calls.length, 2)
    assert.equal(calls[0].init.headers['x-api-key'], 'ds_private')
    assert.equal(new Headers(calls[1].init.headers).get('authorization'), 'Bearer scoped-token')
    assert.equal(new Headers(calls[1].init.headers).has('x-api-key'), false)
  })

  it('refreshes once after an RPC 401 and retries with the new credential', async () => {
    const calls = []
    let issued = 0
    const client = createCrawlerRpcClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'ds_private',
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        if (url.endsWith('/crawl/authorize')) {
          issued += 1
          return jsonResponse(200, { token: `scoped-${issued}`, expires_in: 900 })
        }
        return new Response(null, { status: issued === 1 ? 401 : 204 })
      },
    })

    const response = await client.request('/crawl/claim', { method: 'POST', body: '{}' })

    assert.equal(response.status, 204)
    assert.equal(issued, 2)
    const rpcCalls = calls.filter((call) => call.url.endsWith('/crawl/claim'))
    assert.equal(rpcCalls.length, 2)
    assert.equal(new Headers(rpcCalls[0].init.headers).get('authorization'), 'Bearer scoped-1')
    assert.equal(new Headers(rpcCalls[1].init.headers).get('authorization'), 'Bearer scoped-2')
  })

  it('temporarily falls back only when the pre-cutover authorization endpoint is absent', async () => {
    const calls = []
    const client = createCrawlerRpcClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'ds_private',
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        if (url.endsWith('/crawl/authorize')) return jsonResponse(404, { error: 'Not found' })
        return new Response(null, { status: 204 })
      },
    })

    await client.request('/crawl/claim', { method: 'POST', body: '{}' })
    await client.request('/crawl/claim', { method: 'POST', body: '{}' })

    assert.equal(calls.filter((call) => call.url.endsWith('/crawl/authorize')).length, 1)
    for (const call of calls.filter((entry) => entry.url.endsWith('/crawl/claim'))) {
      assert.equal(new Headers(call.init.headers).has('authorization'), false)
    }
  })

  it('fails explicitly on rejected bootstrap credentials', async () => {
    const client = createCrawlerRpcClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'invalid',
      fetchImpl: async () => jsonResponse(401, { error: 'Invalid API key' }),
    })

    await assert.rejects(
      client.request('/crawl/claim', { method: 'POST', body: '{}' }),
      CrawlerAuthorizationError,
    )
  })

  it('keeps the bundled worker and hire command wired to secret-free env propagation', () => {
    const worker = readFileSync(new URL('../engine/crawler-worker.mjs', import.meta.url), 'utf8')
    const hire = readFileSync(new URL('../commands/hire.mjs', import.meta.url), 'utf8')

    assert.match(worker, /createCrawlerRpcClient/)
    assert.match(worker, /'x-api-key': API_KEY/)
    assert.match(worker, /crawlerRpc\.request\('\/crawl\/claim'/)
    assert.match(worker, /crawlerRpc\.request\('\/crawl\/complete'/)
    assert.match(hire, /MDVP_API_KEY: apiKey/)
    assert.match(hire, /crawler-auth\.mjs/)
    assert.doesNotMatch(worker, /ds_[a-z0-9]{10,}/i)
  })
})
