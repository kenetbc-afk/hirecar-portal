import { onRequestPost as createWorkItem } from './work-items.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json',
};

const ALIAS_OWNERS = {
  'mayra.task@hirecar.la': 'myra',
  'myra.task@hirecar.la': 'myra',
  'omar.task@hirecar.la': 'omar',
  'ken.task@hirecar.la': 'ken',
  'va.task@hirecar.la': 'virtual_admin',
  'virtualadmin.task@hirecar.la': 'virtual_admin',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

function normalizeEmail(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).toLowerCase();
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

function parseSubject(subject) {
  const raw = String(subject || '').trim();
  const match = raw.match(/^\s*(PROJECT|TASK)\s*[-:]\s*(.+)$/i);
  if (!match) {
    return { type: 'task', title: raw || 'Email task', matched: false };
  }
  return {
    type: match[1].toLowerCase() === 'project' ? 'project' : 'task',
    title: match[2].trim() || raw,
    matched: true,
  };
}

function inferOwner(toValue) {
  const recipients = Array.isArray(toValue) ? toValue : String(toValue || '').split(',');
  for (const recipient of recipients) {
    const email = normalizeEmail(recipient);
    if (ALIAS_OWNERS[email]) return { owner: ALIAS_OWNERS[email], alias: email };
  }
  return { owner: '', alias: normalizeEmail(recipients[0] || '') };
}

export async function onRequestPost(context) {
  try {
    const expected = context.env.WORK_EMAIL_INGEST_KEY || '';
    const supplied = context.request.headers.get('x-work-ingest-key') || new URL(context.request.url).searchParams.get('key') || '';
    if (expected && supplied !== expected) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await context.request.json();
    const subject = body.subject || body.Subject || '';
    const parsed = parseSubject(subject);
    const routed = inferOwner(body.to || body.recipient || body.To || '');
    const from = normalizeEmail(body.from || body.sender || body.From || '');
    const messageText = body.text || body.textBody || body.plain || stripHtml(body.html || body.htmlBody || '');
    const actor = from || 'email';

    const payload = {
      type: parsed.type,
      title: parsed.title,
      owner: routed.owner,
      coowner: '',
      status: 'Not Started',
      priority: 'High',
      value: Number(body.value || 0),
      deadline: body.deadline || '',
      source: routed.alias,
      sourceAlias: routed.alias,
      sourceFrom: from,
      sourceSubject: subject,
      template: parsed.type === 'project' ? 'Email project intake' : 'Email task intake',
      expectations: parsed.matched
        ? 'Created from inbound email subject using ' + parsed.type.toUpperCase() + ' prefix.'
        : 'Created from inbound email. Subject did not include TASK - or PROJECT - prefix; defaulted to task.',
      checklist: [],
      notes: messageText,
      createdBy: actor,
      updatedBy: actor,
    };

    const req = new Request(context.request.url.replace('/api/work-email', '/api/work-items'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res = await createWorkItem({ ...context, request: req });
    const data = await res.json();
    return json({
      ...data,
      parsedSubject: parsed,
      routedAlias: routed.alias,
      routedOwner: routed.owner,
    }, res.status);
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}
