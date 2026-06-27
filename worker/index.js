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
const SLACK_CHANNEL_ALERTS = '#hirecar-alerts';

// Slack notification helper — fires and forgets (non-blocking)
async function notifySlack(env, blocks, text) {
  // Try all available webhook secrets — send to whichever ones work
  const webhooks = [
    env.SLACK_HIRECAR_WEBHOOK_URL,
    env.SLACK_WEBHOOK_URL,
    env.SLACK_HOMEBASE_WEBHOOK_URL,
    env.SLACK_SALES_WEBHOOK_URL,
  ].filter(Boolean);
  if (webhooks.length === 0) { console.warn('[Slack] No webhook URLs configured'); return; }
  // Send to ALL configured webhooks to ensure delivery
  const payload = JSON.stringify({ text, blocks });
  const results = await Promise.allSettled(webhooks.map(url =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).then(r => ({ url: url.slice(0, 50) + '...', status: r.status }))
  ));
  const success = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
  console.log('[Slack] Sent to ' + success.length + '/' + webhooks.length + ' webhooks');
}

function slackNewSignup(env, client) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🆕 New Member Signup', emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Name:*\n' + (client.name || 'Unknown') },
        { type: 'mrkdwn', text: '*Email:*\n' + client.email },
        { type: 'mrkdwn', text: '*Case #:*\n' + client.caseNumber },
        { type: 'mrkdwn', text: '*Client ID:*\n' + client.id },
      ]
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Phone:*\n' + (client.phone || '—') },
        { type: 'mrkdwn', text: '*Stage:*\n' + client.stage },
      ]
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '📍 Source: Member Portal  •  🕐 ' + now }
      ]
    },
    { type: 'divider' }
  ];
  notifySlack(env, blocks, '🆕 New signup: ' + (client.name || client.email) + ' (' + client.caseNumber + ')');
}

function slackReturningLogin(env, client) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '🔓 *Returning Login:* ' + (client.name || client.email) + '\n📋 Case: `' + client.caseNumber + '`  •  Stage: ' + client.stage + '  •  🕐 ' + now }
    }
  ];
  notifySlack(env, blocks, '🔓 Returning login: ' + (client.name || client.email));
}

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

function makeId(prefix = 'hc') {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function toCents(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function paypalBaseUrl(env) {
  if (env.PAYPAL_BASE_URL) return env.PAYPAL_BASE_URL;
  return env.PAYPAL_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

function paypalCompletedStatus(status) {
  const value = String(status || '').toUpperCase();
  return value === 'PAID' || value === 'COMPLETED' || value === 'PARTIALLY_PAID';
}

async function getPayPalAccessToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
  }

  const authValue = btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET);
  const response = await fetch(paypalBaseUrl(env) + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + authValue,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('PayPal token request failed: ' + response.status + ' ' + text.slice(0, 300));
  }

  const data = await response.json();
  if (!data.access_token) throw new Error('PayPal token missing access_token');
  return data.access_token;
}

async function verifyPayPalWebhook(request, env, rawBody) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET || !env.PAYPAL_WEBHOOK_ID) {
    return { verified: false, mode: 'skipped_missing_config' };
  }

  const token = await getPayPalAccessToken(env);
  const body = {
    auth_algo: request.headers.get('paypal-auth-algo') || '',
    cert_url: request.headers.get('paypal-cert-url') || '',
    transmission_id: request.headers.get('paypal-transmission-id') || '',
    transmission_sig: request.headers.get('paypal-transmission-sig') || '',
    transmission_time: request.headers.get('paypal-transmission-time') || '',
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(rawBody),
  };

  const response = await fetch(paypalBaseUrl(env) + '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('PayPal webhook verify failed: ' + response.status + ' ' + text.slice(0, 300));
  }

  const data = await response.json();
  return {
    verified: String(data.verification_status || '').toUpperCase() === 'SUCCESS',
    mode: String(data.verification_status || '').toUpperCase() || 'UNKNOWN',
    raw: data,
  };
}

async function getPayPalInvoiceDetails(env, paypalInvoiceId) {
  const token = await getPayPalAccessToken(env);
  const response = await fetch(paypalBaseUrl(env) + '/v2/invoicing/invoices/' + encodeURIComponent(paypalInvoiceId), {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('PayPal invoice fetch failed: ' + response.status + ' ' + text.slice(0, 300));
  }

  return response.json();
}

function extractPayPalDetails(payload, override = {}) {
  const resource = payload && payload.resource ? payload.resource : {};
  const amountValue =
    override.amount ||
    resource.amount?.value ||
    resource.amount?.breakdown?.paid_amount?.value ||
    resource.primary_recipients?.[0]?.billing_info?.amount?.value ||
    resource.payments?.transactions?.[0]?.amount?.value ||
    resource.payments?.transactions?.[0]?.payment_amount?.value ||
    0;

  const invoiceNumberCandidates = [
    override.invoice_number,
    override.invoiceNumber,
    override.parent_number,
    override.parentNumber,
    override.sku,
    resource.detail?.invoice_number,
    resource.invoice_number,
    resource.invoiceNumber,
    resource.detail?.parent_number,
    resource.parent_number,
    resource.parentNumber,
    resource.detail?.sku,
    resource.sku,
    resource.metadata?.invoice_number,
    resource.metadata?.parent_number,
    resource.metadata?.sku,
    resource.custom_id,
    resource.reference,
  ].filter(Boolean);

  return {
    event_type: override.event_type || payload.event_type || 'PAYPAL_MANUAL_RECONCILE',
    event_status: override.status || resource.status || payload.summary || '',
    paypal_event_id: override.paypal_event_id || payload.id || '',
    invoice_id: override.invoice_id || '',
    paypal_invoice_id: override.paypal_invoice_id || resource.id || resource.invoice_id || '',
    invoice_number: invoiceNumberCandidates[0] || '',
    parent_number: override.parent_number || override.parentNumber || resource.detail?.parent_number || resource.parent_number || resource.parentNumber || '',
    sku: override.sku || resource.detail?.sku || resource.sku || resource.metadata?.sku || '',
    order_details: override.order_details || resource.detail?.order_details || resource.metadata?.order_details || '',
    amount_cents: override.amount_cents || toCents(amountValue),
    currency_code: override.currency_code || resource.amount?.currency_code || resource.amount?.breakdown?.paid_amount?.currency_code || 'USD',
    payer_email: override.payer_email || resource.payer_email || resource.payer?.email_address || resource.invoicer?.email_address || '',
    source_ref: override.source_ref || override.paypal_share_link || resource.href || payload.resource_type || '',
    raw: payload,
  };
}

async function findInvoiceForPayPal(DB, details) {
  const candidates = [details.invoice_id, details.invoice_number, details.parent_number, details.sku].filter(Boolean);
  for (const candidate of candidates) {
    const row = await DB.prepare('SELECT * FROM admin_invoices WHERE id = ? OR invoice_number = ? OR parent_number = ? OR sku = ? LIMIT 1')
      .bind(candidate, candidate).first();
    if (row) return row;
  }
  return null;
}

async function insertPayPalRouteEvent(DB, invoice, details, verification, notes) {
  await DB.prepare(
    `INSERT INTO paypal_route_events
      (id, client_id, quote_id, invoice_id, event_type, event_status, paypal_event_id, paypal_order_id, paypal_invoice_id, payer_email, amount_cents, currency_code, source_ref, matched_by, notes, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    makeId('pp'),
    invoice?.client_id || '',
    invoice?.quote_id || '',
    invoice?.id || '',
    details.event_type || '',
    details.event_status || '',
    details.paypal_event_id || '',
    '',
    details.paypal_invoice_id || '',
    details.payer_email || '',
    details.amount_cents || 0,
    details.currency_code || 'USD',
    details.source_ref || '',
    invoice
      ? (details.invoice_number ? 'invoice_number' : details.parent_number ? 'parent_number' : details.sku ? 'sku' : 'invoice_id')
      : 'unmatched',
    [verification?.mode, notes].filter(Boolean).join(' | '),
    JSON.stringify(details.raw || {}),
    new Date().toISOString()
  ).run();
}

async function applyPayPalReconciliation(DB, details, verification) {
  const invoice = await findInvoiceForPayPal(DB, details);
  const completed = paypalCompletedStatus(details.event_status);

  if (!invoice) {
    await insertPayPalRouteEvent(DB, null, details, verification, 'No matching invoice found');
    return { matched: false, applied: false, reason: 'invoice_not_found' };
  }

  let applied = false;
  let newStatus = invoice.status;
  let totalAppliedCents = 0;

  if (completed && details.amount_cents > 0) {
    const paymentMarker = 'paypal_event_id:' + (details.paypal_event_id || details.paypal_invoice_id || details.source_ref || 'manual');
    const existingPayment = await DB.prepare(
      'SELECT id FROM admin_billing WHERE client_id = ? AND reference_id = ? AND reference_type = ? AND notes LIKE ? LIMIT 1'
    ).bind(invoice.client_id, invoice.id, 'invoice', '%' + paymentMarker + '%').first();

    if (!existingPayment) {
      await DB.prepare(
        `INSERT INTO admin_billing
          (id, client_id, entry_type, description, amount_cents, balance_cents, reference_id, reference_type, payment_method, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        makeId('bill'),
        invoice.client_id,
        'payment',
        'PayPal payment for invoice ' + invoice.invoice_number,
        details.amount_cents,
        0,
        invoice.id,
        'invoice',
        'paypal',
        [paymentMarker, details.payer_email ? 'payer_email:' + details.payer_email : '', details.source_ref ? 'source_ref:' + details.source_ref : ''].filter(Boolean).join(' | '),
        new Date().toISOString()
      ).run();
      applied = true;
    }

    const totalRow = await DB.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM admin_billing
       WHERE client_id = ? AND reference_id = ? AND reference_type = ? AND entry_type IN ('payment', 'credit')`
    ).bind(invoice.client_id, invoice.id, 'invoice').first();

    totalAppliedCents = totalRow?.total || 0;
    newStatus = totalAppliedCents >= invoice.amount_cents ? 'paid' : (invoice.status === 'draft' ? 'sent' : invoice.status);

    await DB.prepare(
      'UPDATE admin_invoices SET status = ?, paid_at = ?, payment_method = ?, updated_at = ? WHERE id = ?'
    ).bind(
      newStatus,
      newStatus === 'paid' ? new Date().toISOString() : invoice.paid_at,
      'paypal',
      new Date().toISOString(),
      invoice.id
    ).run();
  }

  await insertPayPalRouteEvent(DB, invoice, details, verification, applied ? 'Payment applied' : 'Event logged without payment application');

  return {
    matched: true,
    applied,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    parent_number: invoice.parent_number || '',
    sku: invoice.sku || '',
    client_id: invoice.client_id,
    total_applied_cents: totalAppliedCents,
    invoice_amount_cents: invoice.amount_cents,
    status: newStatus,
  };
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
  async fetch(request, env, ctx) {
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

      // Check for duplicate email — merge updated fields from portal
      const index = await getIndex(KV);
      for (const cid of index) {
        const existing = await getClient(KV, cid);
        if (existing && existing.email === body.email) {
          // Merge non-empty fields from the portal (don't overwrite with blanks)
          const mergeFields = ['name','preferredName','legalName','phone','dob','address',
            'employer','jobTitle','tenure','monthlyIncome','vehicleInterest','vin',
            'emergencyName','emergencyPhone','emergencyRelation','caseNumber','memberSince',
            'funding_email_username','funding_email_details'];
          let changed = false;
          for (const f of mergeFields) {
            if (body[f] && body[f] !== existing[f]) {
              existing[f] = body[f];
              changed = true;
            }
          }
          if (body.clientId && body.clientId !== existing.id) {
            // Update ID if portal generated a different one
            existing.clientId_portal = body.clientId;
            changed = true;
          }
          if (changed) {
            existing.updatedAt = new Date().toISOString();
            await saveClient(KV, existing);
          }
          // Slack: returning login notification (fire and forget)
          ctx.waitUntil(slackReturningLogin(env, existing));
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
        legalName: body.legalName || '',
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
        funding_email_username: body.funding_email_username || '',
        funding_email_details: body.funding_email_details || '',
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

      // Slack: new signup notification (fire and forget)
      ctx.waitUntil(slackNewSignup(env, client));

      return json({ ok: true, client: client, existing: false }, 201);
    }

    // All other endpoints require API key
    if (path !== '/webhooks/paypal' && !auth(request)) {
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

    // POST /api/clients/:id/documents — add document metadata
    const docMatch = path.match(/^\/api\/clients\/([^\/]+)\/documents$/);
    if (docMatch && request.method === 'POST') {
      const c = await getClient(KV, docMatch[1]);
      if (!c) return err('Client not found', 404);
      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }
      if (!c.documents) c.documents = [];
      c.documents.push(body);
      c.updatedAt = new Date().toISOString();
      await saveClient(KV, c);
      // Slack notification for document upload
      ctx.waitUntil(notifySlack(env, [{
        type: 'section',
        text: { type: 'mrkdwn', text: '📄 *Document Uploaded*\n*Client:* ' + (c.name || c.email) + ' (`' + c.caseNumber + '`)\n*Document:* ' + (body.name || 'Untitled') + ' — ' + (body.sectionLabel || body.section || '') + '\n*File:* ' + (body.fileName || 'unknown') }
      }], '📄 Document uploaded by ' + (c.name || c.email)));
      return json({ ok: true, document: body });
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

    // POST /api/clients/:id/profile-confirmations — store confirmation receipt + mark notifs read
    const confirmMatch = path.match(/^\/api\/clients\/([^\/]+)\/profile-confirmations$/);
    if (confirmMatch && request.method === 'POST') {
      const c = await getClient(KV, confirmMatch[1]);
      if (!c) return err('Client not found', 404);
      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }
      // Store confirmation receipt
      if (!c.profileConfirmations) c.profileConfirmations = [];
      c.profileConfirmations.push({
        confirmedFields: body.confirmedFields || [],
        tcAccepted: body.tcAccepted || false,
        confirmedAt: new Date().toISOString(),
        confirmedBy: body.confirmedBy || 'client',
        notificationIds: body.notificationIds || [],
      });
      c.updatedAt = new Date().toISOString();
      await saveClient(KV, c);
      // Mark referenced notifications as read
      if (body.notificationIds && body.notificationIds.length) {
        const notifs = await getNotifications(KV, confirmMatch[1]);
        let changed = false;
        for (const nid of body.notificationIds) {
          const n = notifs.find(x => x.id === nid);
          if (n && !n.read) { n.read = true; n.confirmedAt = new Date().toISOString(); changed = true; }
        }
        if (changed) await saveNotifications(KV, confirmMatch[1], notifs);
      }
      // Slack notification
      ctx.waitUntil(notifySlack(env, [{
        type: 'section',
        text: { type: 'mrkdwn', text: '✅ *Profile Changes Confirmed*\n*Client:* ' + (c.name || c.email) + ' (`' + c.caseNumber + '`)\n*Confirmed by:* ' + (body.confirmedBy || 'client') + '\n*Fields:* ' + (body.confirmedFields || []).map(f => f.fieldLabel || f.field).join(', ') }
      }], '✅ Profile confirmed by ' + (body.confirmedBy || 'client') + ': ' + (c.name || c.email)));
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN DATA ENDPOINTS (D1-backed — replaces localStorage)
    // ═══════════════════════════════════════════════════════════
    const DB = env.DB;
    if (!DB) {
      // D1 not bound — fall through to 404
    }

    else if (path === '/webhooks/paypal' && request.method === 'POST') {
      const rawBody = await request.text();
      let payload;
      try { payload = JSON.parse(rawBody); } catch(e) { return err('Invalid JSON'); }

      let verification;
      try {
        verification = await verifyPayPalWebhook(request, env, rawBody);
      } catch (e) {
        console.error('[PayPal webhook verify error]', e);
        verification = { verified: false, mode: 'verify_error', error: String(e.message || e) };
      }

      const details = extractPayPalDetails(payload);
      const result = await applyPayPalReconciliation(DB, details, verification);

      return json({
        ok: true,
        verification,
        result,
      }, verification.verified ? 200 : 202);
    }

    else if (path === '/api/paypal/reconcile' && request.method === 'POST') {
      if (!auth(request)) return err('Unauthorized', 401);

      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }

      let payload = { event_type: 'PAYPAL_MANUAL_RECONCILE', resource: {} };
      if (body.paypal_invoice_id && body.fetch_from_paypal !== false) {
        try {
          payload.resource = await getPayPalInvoiceDetails(env, body.paypal_invoice_id);
        } catch (e) {
          return err('PayPal invoice fetch failed: ' + (e.message || e), 502);
        }
      }

      const details = extractPayPalDetails(payload, body);
      const result = await applyPayPalReconciliation(DB, details, { verified: false, mode: 'manual_admin_reconcile' });
      return json({ ok: true, details, result });
    }

    // Generic CRUD helper for admin tables
    else if (path.startsWith('/api/admin/')) {
      if (!auth(request)) return err('Unauthorized', 401);

      const adminParts = path.replace('/api/admin/', '').split('/');
      const table = adminParts[0]; // quotes, invoices, billing, documents, commitments, funding
      const recordId = adminParts[1];

      const tableMap = {
        quotes: 'admin_quotes',
        invoices: 'admin_invoices',
        billing: 'admin_billing',
        documents: 'admin_documents',
        commitments: 'admin_commitments',
        funding: 'admin_funding_requests',
        pifr: 'pifr_enrollments',
      };

      const dbTable = tableMap[table];
      if (!dbTable) return err('Unknown resource: ' + table, 404);

      // GET /api/admin/{table}?client_id=XXX — list records
      if (request.method === 'GET' && !recordId) {
        const clientId = url.searchParams.get('client_id');
        let rows;
        if (clientId) {
          rows = await DB.prepare('SELECT * FROM ' + dbTable + ' WHERE client_id = ? ORDER BY created_at DESC').bind(clientId).all();
        } else {
          rows = await DB.prepare('SELECT * FROM ' + dbTable + ' ORDER BY created_at DESC LIMIT 500').all();
        }
        return json({ data: rows.results || [] });
      }

      // GET /api/admin/{table}/{id} — single record
      if (request.method === 'GET' && recordId) {
        const idCol = dbTable === 'pifr_enrollments' ? 'id' : 'id';
        const row = await DB.prepare('SELECT * FROM ' + dbTable + ' WHERE ' + idCol + ' = ?').bind(recordId).first();
        if (!row) return err('Not found', 404);
        return json({ data: row });
      }

      // POST /api/admin/{table} — create record
      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }

        const id = body.id || ('hc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
        body.id = id;
        body.created_at = body.created_at || new Date().toISOString();
        body.updated_at = new Date().toISOString();

        // Build INSERT dynamically from body keys
        const cols = Object.keys(body);
        const placeholders = cols.map(() => '?').join(',');
        const vals = cols.map(k => body[k]);

        await DB.prepare('INSERT INTO ' + dbTable + ' (' + cols.join(',') + ') VALUES (' + placeholders + ')').bind(...vals).run();
        return json({ ok: true, id: id, data: body }, 201);
      }

      // PATCH /api/admin/{table}/{id} — update record
      if (request.method === 'PATCH' && recordId) {
        let body;
        try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }

        body.updated_at = new Date().toISOString();
        const sets = Object.keys(body).map(k => k + ' = ?').join(', ');
        const vals = Object.keys(body).map(k => body[k]);
        vals.push(recordId);

        await DB.prepare('UPDATE ' + dbTable + ' SET ' + sets + ' WHERE id = ?').bind(...vals).run();
        return json({ ok: true, id: recordId });
      }

      // DELETE /api/admin/{table}/{id} — delete record
      if (request.method === 'DELETE' && recordId) {
        await DB.prepare('DELETE FROM ' + dbTable + ' WHERE id = ?').bind(recordId).run();
        return json({ ok: true, deleted: recordId });
      }
    }

    // ── PIFR-specific endpoints ──
    else if (path === '/api/admin/pifr-log' && request.method === 'POST' && DB) {
      if (!auth(request)) return err('Unauthorized', 401);
      let body;
      try { body = await request.json(); } catch(e) { return err('Invalid JSON'); }
      await DB.prepare('INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)')
        .bind(body.enrollment_id, body.action, body.actor || 'admin', JSON.stringify(body.details || {})).run();
      return json({ ok: true });
    }

    else if (path === '/api/admin/pifr-log' && request.method === 'GET' && DB) {
      if (!auth(request)) return err('Unauthorized', 401);
      const eid = url.searchParams.get('enrollment_id');
      if (!eid) return err('enrollment_id required');
      const rows = await DB.prepare('SELECT * FROM pifr_activity_log WHERE enrollment_id = ? ORDER BY created_at DESC LIMIT 100').bind(eid).all();
      return json({ data: rows.results || [] });
    }

    return err('Not found', 404);
  }
};
