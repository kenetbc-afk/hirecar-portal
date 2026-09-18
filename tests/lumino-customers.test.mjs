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
  assert.equal(body.response_shape.array_key, 'data');
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
