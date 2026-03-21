/**
 * HIRECAR API Worker — Cloudflare Workers + KV
 * Shared backend for member portal ↔ admin dashboard sync
 *
 * Endpoints:
 *   POST /api/clients           — register new client (member portal calls on signup)
 *   GET  /api/clients           — list all clients (admin dashboard)
 *   GET  /api/clients/:id       — get single client
 *   PATCH /api/clients/:id      — update client fields (admin edits)
 *   DELETE /api/clients/:id     — remove client
 *   GET  /api/clients/:id/notifications — get client notifications
 *   POST /api/clients/:id/notifications — add notification for client
 *   PATCH /api/clients/:id/notifications/:nid — mark notification read
 *
 * Auth: Simple shared token in x-api-key header
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

const API_KEY = 'hc-live-2026-k8X9mP3qR7wL';
const CLIENTS_INDEX_KEY = 'clients_index';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

function auth(req) {
  const key = req.headers.get('x-api-key');
  return key === API_KEY;
}

// Get the client index (array of client IDs)
async function getIndex(KV) {
  const raw = await KV.get(CLIENTS_INDEX_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  return [];
}

async function saveIndex(KV, index) {
  await KV.put(CLIENTS_INDEX_KEY, JSON.stringify(index));
}

// Get a single client object from KV
async function getClient(KV, id) {
  const raw = await KV.get('client:' + id);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

async function saveClient(KV, client) {
  await KV.put('client:' + client.id, JSON.stringify(client));
}

async function deleteClient(KV, id) {
  await KV.delete('client:' + id);
}

// Get notifications for a client
async function getNotifications(KV, clientId) {
  const raw = await KV.get('notif:' + clientId);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  return [];
}

async function saveNotifications(KV, clientId, notifs) {
  await KV.put('notif:' + clientId, JSON.stringify(notifs));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const KV = env.KV;

    // Public endpoint: client self-registration (from member portal)
    if (path === '/api/clients' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }

      if (!body.email) return err('Email required');

      // Check for duplicate email
      const index = await getIndex(KV);
      for (const cid of index) {
        const existing = await getClient(KV, cid);
        if (existing && existing.email === body.email) {
          // Return existing client (idempotent)
          return json({ ok: true, client: existing, existing: true });
        }
      }

      // Create new client
      const now = new Date();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const rand = String(Math.floor(1000 + Math.random() * 9000));

      const client = {
        id: body.clientId || ('hc-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8)),
        email: body.email,
        name: body.name || body.email.split('@')[0],
        preferredName: body.preferredName || body.nickname || '',
        phone: body.phone || '',
        dob: body.dob || '',
        address: body.address || '',
        caseNumber: body.caseNumber || ('CR-' + yy + mm + dd + '-' + rand),
        memberSince: body.memberSince || (months[now.getMonth()] + ' ' + now.getFullYear()),
        stage: body.stage || 'Intake',
        status: 'Active',
        pin: String(Math.floor(1000 + Math.random() * 9000)),
        scores: { tu: 0, eq: 0, ex: 0 },
        employer: body.employer || '',
        jobTitle: body.jobTitle || '',
        tenure: body.tenure || '',
        monthlyIncome: body.monthlyIncome || '',
        vehicleInterest: body.vehicleInterest || '',
        vin: body.vin || '',
        emergencyName: body.emergencyName || '',
        emergencyPhone: body.emergencyPhone || '',
        emergencyRelation: body.emergencyRelation || '',
        notes: '',
        documents: [],
        messages: [],
        quotes: [],
        invoices: [],
        paymentCommitments: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: body.source || 'member-portal',
      };

      index.push(client.id);
      await saveIndex(KV, index);
      await saveClient(KV, client);

      // Create welcome notification
      const notifs = [{
        id: 'n_' + Date.now().toString(36),
        type: 'system',
        title: 'Welcome to HIRECAR',
        message: 'Your membership is active. Case #' + client.caseNumber + '. Your advisor will reach out shortly.',
        read: false,
        createdAt: now.toISOString(),
      }];
      await saveNotifications(KV, client.id, notifs);

      return json({ ok: true, client: client, existing: false }, 201);
    }

    // All other endpoints require API key
    if (!auth(request)) {
      return err('Unauthorized', 401);
    }

    // GET /api/clients — list all
    if (path === '/api/clients' && request.method === 'GET') {
      const index = await getIndex(KV);
      const clients = [];
      for (const cid of index) {
        const c = await getClient(KV, cid);
        if (c) clients.push(c);
      }
      return json({ clients, total: clients.length });
    }

    // GET /api/clients/:id
    const singleMatch = path.match(/^\/api\/clients\/([^\/]+)$/);
    if (singleMatch && request.method === 'GET') {
      const c = await getClient(KV, singleMatch[1]);
      if (!c) return err('Client not found', 404);
      return json({ client: c });
    }

    // PATCH /api/clients/:id — update fields
    if (singleMatch && request.method === 'PATCH') {
      const c = await getClient(KV, singleMatch[1]);
      if (!c) return err('Client not found', 404);
      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }
      // Merge fields
      for (const key of Object.keys(body)) {
        if (key !== 'id') c[key] = body[key];
      }
      c.updatedAt = new Date().toISOString();
      await saveClient(KV, c);
      return json({ ok: true, client: c });
    }

    // DELETE /api/clients/:id
    if (singleMatch && request.method === 'DELETE') {
      const index = await getIndex(KV);
      const newIndex = index.filter(id => id !== singleMatch[1]);
      await saveIndex(KV, newIndex);
      await deleteClient(KV, singleMatch[1]);
      return json({ ok: true });
    }

    // GET /api/clients/:id/notifications
    const notifMatch = path.match(/^\/api\/clients\/([^\/]+)\/notifications$/);
    if (notifMatch && request.method === 'GET') {
      const notifs = await getNotifications(KV, notifMatch[1]);
      return json({ notifications: notifs });
    }

    // POST /api/clients/:id/notifications — add notification
    if (notifMatch && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }
      const notifs = await getNotifications(KV, notifMatch[1]);
      const n = {
        id: 'n_' + Date.now().toString(36),
        type: body.type || 'info',
        title: body.title || 'Notification',
        message: body.message || '',
        read: false,
        data: body.data || {},
        createdAt: new Date().toISOString(),
      };
      notifs.unshift(n);
      await saveNotifications(KV, notifMatch[1], notifs);
      return json({ ok: true, notification: n }, 201);
    }

    // PATCH /api/clients/:id/notifications/:nid — mark read
    const notifSingleMatch = path.match(/^\/api\/clients\/([^\/]+)\/notifications\/([^\/]+)$/);
    if (notifSingleMatch && request.method === 'PATCH') {
      const notifs = await getNotifications(KV, notifSingleMatch[1]);
      const n = notifs.find(x => x.id === notifSingleMatch[2]);
      if (n) {
        n.read = true;
        await saveNotifications(KV, notifSingleMatch[1], notifs);
      }
      return json({ ok: true });
    }

    return err('Not found', 404);
  }
};
