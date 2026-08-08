class CrawlerAuthorizationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CrawlerAuthorizationError'
  }
}

function createCrawlerRpcClient({ apiUrl, apiKey, fetchImpl = fetch, now = () => Date.now() }) {
  let credential = null
  let expiresAt = 0
  let legacyMode = false

  async function authorize(force = false) {
    if (legacyMode) return null
    if (!apiKey) throw new CrawlerAuthorizationError('MDVP_API_KEY is required. Run: npx @mdvp/cli login')
    if (!force && credential && expiresAt - now() > 30_000) return credential

    const response = await fetchImpl(`${apiUrl}/crawl/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: '{}',
    })

    // Release compatibility only: the pre-enforcement Worker does not expose
    // the capability endpoint. Once the endpoint exists, auth failures are fatal.
    if (response.status === 404) {
      legacyMode = true
      credential = null
      expiresAt = 0
      return null
    }
    if (!response.ok) {
      throw new CrawlerAuthorizationError(`Crawler authorization failed (${response.status}). Run: npx @mdvp/cli login`)
    }

    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload.token !== 'string' || !payload.token || !Number.isFinite(payload.expires_in)) {
      throw new CrawlerAuthorizationError('Crawler authorization returned an invalid response')
    }
    credential = payload.token
    expiresAt = now() + Math.max(0, payload.expires_in) * 1000
    return credential
  }

  async function request(path, init, retry = true) {
    const token = await authorize()
    const headers = new Headers(init?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetchImpl(`${apiUrl}${path}`, { ...init, headers })

    if (response.status === 401 && retry && !legacyMode) {
      credential = null
      expiresAt = 0
      await authorize(true)
      return request(path, init, false)
    }
    if (response.status === 401) {
      throw new CrawlerAuthorizationError('Crawler credential was rejected. Run: npx @mdvp/cli login')
    }
    return response
  }

  return { request }
}

export { CrawlerAuthorizationError, createCrawlerRpcClient }
