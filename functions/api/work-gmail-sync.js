import { onRequestPost as createWorkEmail } from './work-email.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-work-ingest-key',
  'Content-Type': 'application/json',
};

const TASK_ALIASES = [
  'mayra.task@hirecar.la',
  'myra.task@hirecar.la',
  'omar.task@hirecar.la',
  'ken.task@hirecar.la',
  'va.task@hirecar.la',
  'virtualadmin.task@hirecar.la',
];

const IMPORTED_LABEL = 'HIRECAR_TASK_IMPORTED';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

function authOk(context) {
  const expected = context.env.WORK_EMAIL_INGEST_KEY || '';
  if (!expected) return false;
  const url = new URL(context.request.url);
  const supplied = context.request.headers.get('x-work-ingest-key') || url.searchParams.get('key') || '';
  return supplied === expected;
}

async function getStoredGoogleRefreshToken(context) {
  if (!context.env?.PIFR_ENROLLMENTS) return '';
  try {
    return await context.env.PIFR_ENROLLMENTS.get('google_oauth_refresh_token');
  } catch (_) {
    return '';
  }
}

async function getGoogleAccessToken(context) {
  const env = context.env || {};
  const refreshToken = await getStoredGoogleRefreshToken(context) || env.GOOGLE_REFRESH_TOKEN;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token exchange failed: ' + (j.error_description || j.error || 'unknown'));
  return j.access_token;
}

async function gmailFetch(token, path, opts = {}) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || 'Gmail API request failed');
  return body;
}

async function ensureLabel(token) {
  const labels = await gmailFetch(token, 'labels');
  const found = (labels.labels || []).find(l => l.name === IMPORTED_LABEL);
  if (found) return found.id;
  const created = await gmailFetch(token, 'labels', {
    method: 'POST',
    body: JSON.stringify({
      name: IMPORTED_LABEL,
      labelListVisibility: 'labelHide',
      messageListVisibility: 'hide',
    }),
  });
  return created.id;
}

function decodeBase64Url(value) {
  if (!value) return '';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (_) {
    return atob(padded);
  }
}

function findBody(payload) {
  if (!payload) return '';
  if (payload.body?.data && /^text\/plain/i.test(payload.mimeType || '')) return decodeBase64Url(payload.body.data);
  if (payload.body?.data && /^text\/html/i.test(payload.mimeType || '')) return stripHtml(decodeBase64Url(payload.body.data));
  for (const part of payload.parts || []) {
    const found = findBody(part);
    if (found) return found;
  }
  return payload.body?.data ? decodeBase64Url(payload.body.data) : '';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function header(headers, name) {
  const h = (headers || []).find(v => String(v.name || '').toLowerCase() === name.toLowerCase());
  return h ? h.value || '' : '';
}

async function importMessage(context, msg, labelId) {
  const token = context.token;
  const full = await gmailFetch(token, 'messages/' + msg.id + '?format=full');
  const headers = full.payload?.headers || [];
  const subject = header(headers, 'Subject');
  const from = header(headers, 'From');
  const to = [header(headers, 'To'), header(headers, 'Delivered-To'), header(headers, 'X-Original-To')].filter(Boolean).join(', ');
  const text = findBody(full.payload) || full.snippet || '';

  const req = new Request(context.request.url.replace('/api/work-gmail-sync', '/api/work-email'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-work-ingest-key': context.env.WORK_EMAIL_INGEST_KEY,
    },
    body: JSON.stringify({ to, from, subject, text }),
  });
  const created = await createWorkEmail({ ...context, request: req });
  const result = await created.json();
  if (!result.success) throw new Error(result.error || 'Work item import failed');

  await gmailFetch(token, 'messages/' + msg.id + '/modify', {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: [labelId], removeLabelIds: ['UNREAD'] }),
  });

  return { gmailId: msg.id, workItem: result.workItem, routedOwner: result.routedOwner };
}

export async function onRequestPost(context) {
  try {
    if (!authOk(context)) return json({ success: false, error: 'Unauthorized' }, 401);
    const token = await getGoogleAccessToken(context);
    const labelId = await ensureLabel(token);
    const aliasQuery = TASK_ALIASES.map(a => `to:${a}`).join(' OR ');
    const q = `(${aliasQuery}) -label:${IMPORTED_LABEL} newer_than:30d`;
    const list = await gmailFetch(token, 'messages?' + new URLSearchParams({ q, maxResults: '20' }).toString());
    const messages = list.messages || [];
    const imported = [];
    const errors = [];
    const childContext = { ...context, token };

    for (const msg of messages) {
      try {
        imported.push(await importMessage(childContext, msg, labelId));
      } catch (err) {
        errors.push({ gmailId: msg.id, error: err.message });
      }
    }

    return json({ success: true, scanned: messages.length, imported, errors });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}
