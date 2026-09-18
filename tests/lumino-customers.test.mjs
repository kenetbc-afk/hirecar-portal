import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, syncClientToLumino } from '../functions/api/lumino-customers.js';

test('connection probe reports an encrypted-key-backed successful customer route', async () => {
  const response = await onRequestGet({
    request: new Request('https://example.test/api/lumino-customers?probe=connection'),
    env: {
      LUMINO_API_KEY: 'test-secret',
      LUMINO_FETCH: async (url, init) => {
        assert.equal(url, 'https://core.app.lumino.io/customers?limit=1');
        assert.equal(init.headers.Authorization, 'Bearer test-secret');
        return Response.json({ data: [], total: 0 });
      },
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.authentication_scheme, 'bearer');
  assert.equal(body.endpoint_path, '/customers');
  assert.equal(body.response_shape.array_key, 'data');
});

test('connection probe tries x-api-key after Bearer authentication is rejected', async () => {
  const seen = [];
  const response = await onRequestGet({
    request: new Request('https://example.test/api/lumino-customers?probe=connection'),
    env: {
      LUMINO_API_KEY: 'sk_live_test-secret',
      LUMINO_FETCH: async (_url, init) => {
        seen.push(init.headers);
        if (init.headers['x-api-key']) return Response.json({ data: [] });
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      },
    },
  });
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.authentication_scheme, 'x-api-key');
  assert.equal(body.key_type, 'secret_live');
  assert.equal(seen.length, 2);
});

test('connection probe checks bounded versioned public API paths', async () => {
  const seen = [];
  const response = await onRequestGet({
    request: new Request('https://example.test/api/lumino-customers?probe=connection'),
    env: {
      LUMINO_API_KEY: 'sk_live_test-secret',
      LUMINO_FETCH: async (url) => {
        seen.push(url);
        if (url.includes('/v1/customers')) return Response.json({ data: [] });
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      },
    },
  });
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.endpoint_path, '/v1/customers');
  assert.equal(seen.length, 4);
});

test('customer sync matches by normalized email and persists the Lumino ID', async () => {
  const calls = [];
  const result = await syncClientToLumino({
    LUMINO_API_KEY: 'test-secret',
    ADMIN_API_KEY: 'admin-secret',
    LUMINO_FETCH: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ customers: [{ id: 'cus_lumino_1', email: 'person@example.com' }] });
    },
    HIRECAR_FETCH: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ ok: true });
    },
  }, {
    id: 'client-1',
    name: 'Example Person',
    email: ' Person@Example.com ',
  });

  assert.equal(result.action, 'matched');
  assert.equal(result.customer_id, 'cus_lumino_1');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /search=person%40example\.com/);
  const persisted = JSON.parse(calls[1].init.body);
  assert.equal(persisted.lumino_customer_id, 'cus_lumino_1');
});

test('customer sync creates only minimal customer data when no match exists', async () => {
  const luminoCalls = [];
  const result = await syncClientToLumino({
    LUMINO_API_KEY: 'test-secret',
    ADMIN_API_KEY: 'admin-secret',
    LUMINO_FETCH: async (url, init) => {
      luminoCalls.push({ url, init });
      if (init.method === 'GET') return Response.json({ data: [] });
      return Response.json({ id: 'cus_lumino_2', email: 'new@example.com' }, { status: 201 });
    },
    HIRECAR_FETCH: async () => Response.json({ ok: true }),
  }, {
    id: 'client-2',
    name: 'New Person',
    email: 'new@example.com',
    phone: '555-555-5555',
    caseNumber: 'HC-1234',
  });

  assert.equal(result.action, 'created');
  const payload = JSON.parse(luminoCalls[1].init.body);
  assert.deepEqual(payload, {
    name: 'New Person',
    email: 'new@example.com',
    description: 'HIRECAR customer reference HC-1234',
  });
});
