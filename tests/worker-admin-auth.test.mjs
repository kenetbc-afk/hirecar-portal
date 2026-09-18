import assert from 'node:assert/strict'
import test from 'node:test'
import worker from '../worker/index.js'

const env = {
  ADMIN_API_KEY: 'test-rotated-admin-key',
  KV: {
    async get(key) {
      return key === 'clients_index' ? JSON.stringify([]) : null
    },
  },
}

const context = { waitUntil() {} }

test('client list accepts the configured Worker admin secret', async () => {
  const request = new Request('https://hirecar-api.example/api/clients', {
    headers: { 'x-api-key': env.ADMIN_API_KEY },
  })
  const response = await worker.fetch(request, env, context)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { clients: [], total: 0 })
})

test('client list rejects a missing or mismatched admin secret', async () => {
  for (const key of ['', 'wrong-key']) {
    const headers = key ? { 'x-api-key': key } : {}
    const response = await worker.fetch(new Request('https://hirecar-api.example/api/clients', { headers }), env, context)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Unauthorized' })
  }
})

test('client list fails closed when the Worker secret is not configured', async () => {
  const response = await worker.fetch(new Request('https://hirecar-api.example/api/clients', {
    headers: { 'x-api-key': env.ADMIN_API_KEY },
  }), { ...env, ADMIN_API_KEY: '' }, context)
  assert.equal(response.status, 401)
})
