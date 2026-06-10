import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { badgeForDomain } from '../lib/format.mjs'

describe('badgeForDomain', () => {
  it('normalizes URL input to the badge domain', () => {
    const badge = badgeForDomain('https://www.example.com/path?utm_source=test')

    assert.equal(badge.domain, 'example.com')
    assert.equal(badge.endpointUrl, 'https://api.mdvp.dev/badge/example.com')
    assert.equal(
      badge.imageUrl,
      'https://img.shields.io/endpoint?url=https%3A%2F%2Fapi.mdvp.dev%2Fbadge%2Fexample.com',
    )
    assert.equal(
      badge.markdown,
      '[![MDVP](https://img.shields.io/endpoint?url=https%3A%2F%2Fapi.mdvp.dev%2Fbadge%2Fexample.com)](https://mdvp.dev)',
    )
  })

  it('encodes domains before placing them inside the shields endpoint URL', () => {
    const badge = badgeForDomain('staging.example.com')

    assert.equal(badge.endpointUrl, 'https://api.mdvp.dev/badge/staging.example.com')
    assert.match(badge.imageUrl, /url=https%3A%2F%2Fapi\.mdvp\.dev%2Fbadge%2Fstaging\.example\.com/)
  })
})
