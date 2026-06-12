const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json',
};

const OWNER_PROFILES = {
  ken: { name: 'Ken', email: 'ken@hirecar.la' },
  myra: { name: 'Mayra', email: 'Mayra@hirecar.la' },
  mayra: { name: 'Mayra', email: 'Mayra@hirecar.la' },
  omar: { name: 'Omar', email: 'Omar@hirecar.la' },
  virtual_admin: { name: 'Virtual Admin', email: 'admin@hirecar.la' },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

function normalizeOwner(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'mayra') return 'myra';
  if (v === 'va' || v === 'virtual-admin' || v === 'virtual admin') return 'virtual_admin';
  return OWNER_PROFILES[v] ? v : v;
}

function parseChecklist(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return String(value).split(/\n/).map(line => {
      const raw = line.trim();
      if (!raw) return null;
      const done = /^\[[xX]\]\s*/.test(raw);
      return { text: raw.replace(/^\[[xX ]\]\s*/, '').trim(), done };
    }).filter(Boolean);
  }
}

function toDbItem(data, existing = {}) {
  const itemType = String(data.type || data.item_type || existing.item_type || 'task').toLowerCase() === 'project' ? 'project' : 'task';
  const status = data.status || existing.status || 'Not Started';
  const existingValueDollars = Number(existing.value_cents || 0) / 100;
  const valueDollars = data.value ?? data.value_dollars ?? existingValueDollars;
  return {
    id: data.id || existing.id || `w_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`,
    item_type: itemType,
    title: String(data.title || existing.title || '').trim(),
    owner: normalizeOwner(data.owner ?? existing.owner ?? ''),
    coowner: normalizeOwner(data.coowner ?? existing.coowner ?? ''),
    client_id: String(data.clientId ?? data.client_id ?? existing.client_id ?? ''),
    status,
    priority: String(data.priority ?? existing.priority ?? 'Medium'),
    value_cents: Math.round(Number(valueDollars || 0) * 100),
    deadline: data.deadline ?? existing.deadline ?? '',
    source_alias: String(data.sourceAlias ?? data.source_alias ?? data.source ?? existing.source_alias ?? ''),
    source_from: String(data.sourceFrom ?? data.source_from ?? existing.source_from ?? ''),
    source_subject: String(data.sourceSubject ?? data.source_subject ?? existing.source_subject ?? ''),
    template: String(data.template ?? existing.template ?? ''),
    expectations: String(data.expectations ?? existing.expectations ?? ''),
    checklist_json: JSON.stringify(parseChecklist(data.checklist ?? existing.checklist_json)),
    notes: String(data.notes ?? existing.notes ?? ''),
    created_by: String(data.createdBy ?? data.created_by ?? existing.created_by ?? 'admin'),
    updated_by: String(data.updatedBy ?? data.updated_by ?? 'admin'),
    completed_at: status === 'Completed' ? (data.completedAt || data.completed_at || existing.completed_at || new Date().toISOString()) : '',
  };
}

function fromDbRow(row) {
  return {
    id: row.id,
    type: row.item_type,
    title: row.title,
    owner: row.owner || '',
    coowner: row.coowner || '',
    clientId: row.client_id || '',
    status: row.status,
    priority: row.priority,
    value: Number(row.value_cents || 0) / 100,
    deadline: row.deadline || '',
    source: row.source_alias || '',
    sourceAlias: row.source_alias || '',
    sourceFrom: row.source_from || '',
    sourceSubject: row.source_subject || '',
    template: row.template || '',
    expectations: row.expectations || '',
    checklist: parseChecklist(row.checklist_json),
    notes: row.notes || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    completedAt: row.completed_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recipientList(item) {
  const owners = [item.owner, item.coowner].filter(Boolean);
  const seen = new Set();
  return owners.map(normalizeOwner).map(owner => OWNER_PROFILES[owner]).filter(Boolean).filter(profile => {
    const key = profile.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

async function sendWorkEmail(env, item, action) {
  if (!env.BREVO_API_KEY) return { sent: false, reason: 'missing_brevo_api_key' };
  const to = recipientList(item);
  if (!to.length) return { sent: false, reason: 'no_recipients' };

  const subject = `HIRECAR ${item.item_type.toUpperCase()} ${action}: ${item.title}`;
  const value = '$' + (Number(item.value_cents || 0) / 100).toLocaleString('en-US');
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <h2 style="margin:0 0 12px;color:#0f172a;">${escapeHtml(item.title)}</h2>
      <p style="margin:0 0 16px;color:#475569;">A HIRECAR ${escapeHtml(item.item_type)} was ${escapeHtml(action)}.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;">Owner</td><td>${escapeHtml(OWNER_PROFILES[item.owner]?.name || item.owner || 'Unassigned')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Co-owner</td><td>${escapeHtml(OWNER_PROFILES[item.coowner]?.name || item.coowner || 'None')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Status</td><td>${escapeHtml(item.status)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Priority</td><td>${escapeHtml(item.priority)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Deadline</td><td>${escapeHtml(item.deadline || 'Not set')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Value</td><td>${escapeHtml(value)}</td></tr>
      </table>
      ${item.expectations ? `<h3>Expectations</h3><p style="white-space:pre-wrap;">${escapeHtml(item.expectations)}</p>` : ''}
      ${item.notes ? `<h3>Notes</h3><p style="white-space:pre-wrap;">${escapeHtml(item.notes)}</p>` : ''}
    </div>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'HIRECAR Admin', email: env.WORK_SENDER_EMAIL || 'admin@hirecar.la' },
      to,
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) return { sent: false, reason: await res.text(), status: res.status };
  return { sent: true, recipients: to.map(r => r.email) };
}

async function logActivity(env, workId, actor, action, details) {
  if (!env.DB) return;
  await env.DB.prepare(
    'INSERT INTO admin_work_activity (work_id, actor, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(workId, actor || 'system', action, JSON.stringify(details || {}), new Date().toISOString()).run();
}

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return json({ success: true, workItems: [], source: 'no-db' });
    const url = new URL(context.request.url);
    const owner = normalizeOwner(url.searchParams.get('owner') || '');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const where = [];
    const binds = [];
    if (owner) {
      where.push('(owner = ? OR coowner = ?)');
      binds.push(owner, owner);
    }
    if (status) {
      where.push('status = ?');
      binds.push(status);
    }
    if (type) {
      where.push('item_type = ?');
      binds.push(type);
    }
    let sql = 'SELECT * FROM admin_work_items';
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY CASE WHEN status = "Completed" THEN 1 ELSE 0 END, deadline IS NULL, deadline ASC, updated_at DESC LIMIT 500';
    const stmt = context.env.DB.prepare(sql);
    const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json({ success: true, workItems: (rows.results || []).map(fromDbRow), source: 'd1' });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ success: false, error: 'D1 not configured' }, 500);
    const data = await context.request.json();
    const item = toDbItem(data);
    if (!item.title) return json({ success: false, error: 'Title is required' }, 400);

    const now = new Date().toISOString();
    await context.env.DB.prepare(`
      INSERT INTO admin_work_items (
        id, item_type, title, owner, coowner, client_id, status, priority, value_cents,
        deadline, source_alias, source_from, source_subject, template, expectations,
        checklist_json, notes, created_by, updated_by, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id, item.item_type, item.title, item.owner, item.coowner, item.client_id,
      item.status, item.priority, item.value_cents, item.deadline, item.source_alias,
      item.source_from, item.source_subject, item.template, item.expectations,
      item.checklist_json, item.notes, item.created_by, item.updated_by,
      item.completed_at, now, now
    ).run();

    await logActivity(context.env, item.id, item.updated_by, 'created', item);
    const email = await sendWorkEmail(context.env, item, 'created');
    return json({ success: true, workItem: fromDbRow({ ...item, created_at: now, updated_at: now }), email });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestPatch(context) {
  try {
    if (!context.env?.DB) return json({ success: false, error: 'D1 not configured' }, 500);
    const data = await context.request.json();
    const id = String(data.id || '').trim();
    if (!id) return json({ success: false, error: 'Missing id' }, 400);
    const existing = await context.env.DB.prepare('SELECT * FROM admin_work_items WHERE id = ? LIMIT 1').bind(id).first();
    if (!existing) return json({ success: false, error: 'Work item not found' }, 404);
    const item = toDbItem(data, existing);
    const now = new Date().toISOString();
    await context.env.DB.prepare(`
      UPDATE admin_work_items SET
        item_type = ?, title = ?, owner = ?, coowner = ?, client_id = ?, status = ?,
        priority = ?, value_cents = ?, deadline = ?, source_alias = ?, source_from = ?,
        source_subject = ?, template = ?, expectations = ?, checklist_json = ?, notes = ?,
        updated_by = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      item.item_type, item.title, item.owner, item.coowner, item.client_id, item.status,
      item.priority, item.value_cents, item.deadline, item.source_alias, item.source_from,
      item.source_subject, item.template, item.expectations, item.checklist_json, item.notes,
      item.updated_by, item.completed_at, now, id
    ).run();

    await logActivity(context.env, id, item.updated_by, 'updated', item);
    const email = await sendWorkEmail(context.env, item, 'updated');
    return json({ success: true, workItem: fromDbRow({ ...item, id, created_at: existing.created_at, updated_at: now }), email });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    if (!context.env?.DB) return json({ success: false, error: 'D1 not configured' }, 500);
    const url = new URL(context.request.url);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!id) return json({ success: false, error: 'Missing id' }, 400);
    await context.env.DB.prepare('DELETE FROM admin_work_activity WHERE work_id = ?').bind(id).run();
    const result = await context.env.DB.prepare('DELETE FROM admin_work_items WHERE id = ?').bind(id).run();
    return json({ success: true, id, changes: result.meta?.changes || 0 });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}
