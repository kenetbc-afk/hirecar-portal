const WORKER_BASE = 'https://hirecar-api.hirecar.workers.dev';
const SESSION_SECRET = 'hc-admin-session-2026-06-14-portal';

export async function onRequestGet(context) {
  return json({ ok: false, error: 'Not found' }, 404);
}

export async function onRequestPost(context) {
  const auth = await verifySession(context.request, context.env);
  if (!auth.ok) return json({ ok: false, error: 'Unauthorized' }, 401);
  if (!context.env?.LUMINO_API_KEY) {
    return json({ ok: false, error: 'Lumino API key is not configured' }, 503);
  }
  if (!context.env?.LUMINO_API_BASE) {
    return json({ ok: false, error: 'Lumino public API base URL is not configured' }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const client = body?.client;
  const email = normalizeEmail(client?.email);
  const name = String(client?.legalName || client?.name || client?.preferredName || '').trim();
  if (!validEmail(email) || !name) {
    return json({ ok: false, error: 'A customer name and valid email are required' }, 400);
  }

  try {
    const result = await syncClientToLumino(context.env, client);
    return json({ ok: true, lumino: result });
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

export async function syncClientToLumino(env, client) {
  const email = normalizeEmail(client.email);
  const existing = await findLuminoCustomerByEmail(env, email);
  let customer = existing;
  let action = 'matched';

  if (!customer) {
    const payload = {
      name: String(client.legalName || client.name || client.preferredName || email).trim(),
      email,
      description: luminoDescription(client),
    };
    const created = await luminoRequest(env, 'POST', '/customers', payload);
    if (!created.ok) throw new Error(luminoError(created, 'Lumino customer creation failed'));
    customer = unwrapCustomer(created.body);
    if (!customer?.id) throw new Error('Lumino customer creation returned no customer ID');
    action = 'created';
  }

  const state = {
    lumino_customer_id: String(customer.id),
    lumino_sync_status: 'synced',
    lumino_sync_error: '',
    lumino_synced_at: new Date().toISOString(),
  };
  await persistLuminoState(env, client.id, state);

  return { action, client_id: client.id || '', customer_id: state.lumino_customer_id };
}

async function findLuminoCustomerByEmail(env, email) {
  const query = new URLSearchParams({ search: email, limit: '100' });
  const response = await luminoRequest(env, 'GET', '/customers?' + query.toString());
  if (!response.ok) throw new Error(luminoError(response, 'Lumino customer lookup failed'));
  const customers = customerRows(response.body);
  return customers.find(row => normalizeEmail(row?.email) === email) || null;
}

async function luminoRequest(env, method, path, payload, authStyle = 'bearer') {
  const fetcher = env.LUMINO_FETCH || fetch;
  const key = String(env.LUMINO_API_KEY || '').trim();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authStyle === 'x-api-key') headers['x-api-key'] = key;
  else if (authStyle === 'authorization-raw') headers.Authorization = key;
  else headers.Authorization = 'Bearer ' + key;
  const apiBase = String(env.LUMINO_API_BASE || '').trim().replace(/\/$/, '');
  if (!apiBase) throw new Error('Lumino public API base URL is not configured');
  const response = await fetcher(apiBase + path, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
  return { ok: response.ok, status: response.status, body };
}

async function persistLuminoState(env, clientId, state) {
  if (!clientId) return;
  const apiKey = String(env.ADMIN_API_KEY || env.API_KEY || env.HIRECAR_API_KEY || '').trim();
  if (!apiKey) throw new Error('HIRECAR Admin API key is not configured');
  const fetcher = env.HIRECAR_FETCH || fetch;
  const response = await fetcher(WORKER_BASE + '/api/clients/' + encodeURIComponent(clientId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error('Lumino customer was created but its HIRECAR link could not be saved');
}

function customerRows(body) {
  if (Array.isArray(body)) return body;
  const candidates = [body?.data, body?.items, body?.customers, body?.results, body?.data?.items, body?.data?.customers];
  return candidates.find(Array.isArray) || [];
}

function unwrapCustomer(body) {
  if (!body || Array.isArray(body)) return null;
  return body.customer || body.data?.customer || body.data || body;
}

function luminoDescription(client) {
  const reference = String(client.caseNumber || client.hcNumber || client.id || '').trim();
  return reference ? 'HIRECAR customer reference ' + reference : 'HIRECAR customer';
}

function luminoError(response, fallback) {
  return String(response.body?.message || response.body?.error || response.body?.detail || fallback) + ' (' + response.status + ')';
}

function safeError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 300);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function verifySession(request, env) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  const headerToken = request.headers.get('x-hc-admin-token');
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)hc_admin_token=([^;]+)/);
  const token = queryToken || headerToken || (match ? match[1] : '');
  if (!token) return { ok: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false };
  const payloadJson = verifySignature(env, parts[0], parts[1]);
  if (!payloadJson) return { ok: false };
  try {
    const payload = JSON.parse(payloadJson);
    if (!payload?.u || !payload?.exp || Date.now() > payload.exp) return { ok: false };
    return { ok: true, user: payload.u, access: payload.a || 'limited' };
  } catch (_) {
    return { ok: false };
  }
}

function verifySignature(env, payloadB64, sigHex) {
  const secret = String(env.ADMIN_SESSION_SECRET || env.ADMIN_API_KEY || SESSION_SECRET);
  const expected = simpleHash(secret + '|' + payloadB64);
  if (!timingSafeEqual(expected, sigHex)) return null;
  return decodeURIComponent(payloadB64);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
