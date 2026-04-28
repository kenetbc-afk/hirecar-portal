// Cloudflare Pages Function — /api/pifr-note
// Timestamped admin notes per enrollment (member_id).
// Stored as rows in pifr_activity_log with action='admin_note'.
//   POST  { mid, text, by? } -> creates a note for the enrollment matching mid
//   GET   ?mid=HC-XXXX-XXXX  -> returns all notes for that mid (newest first)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

async function resolveEnrollmentId(env, mid) {
  if (!env?.DB || !mid) return null;
  const row = await env.DB.prepare(
    'SELECT id FROM pifr_enrollments WHERE member_id = ? LIMIT 1'
  ).bind(mid).first();
  return row ? row.id : null;
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const mid = (data.mid || data.member_id || '').trim();
    const text = (data.text || '').trim();
    const by = (data.by || data.actor || 'admin').slice(0, 80);

    if (!mid) return json({ error: 'Missing mid' }, 400);
    if (!text) return json({ error: 'Note text is required' }, 400);
    if (text.length > 4000) return json({ error: 'Note exceeds 4000 chars' }, 400);

    const enrollmentId = await resolveEnrollmentId(context.env, mid);
    if (!enrollmentId) return json({ error: 'No enrollment found for ' + mid }, 404);

    const ts = new Date().toISOString();
    const details = JSON.stringify({ text, mid });

    await context.env.DB.prepare(
      'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(enrollmentId, 'admin_note', by, details, ts).run();

    return json({ success: true, mid, by, ts, text });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const mid = (url.searchParams.get('mid') || '').trim();
    if (!mid) return json({ error: 'Missing mid' }, 400);
    if (!context.env?.DB) return json({ success: true, notes: [], source: 'no-db' });

    const enrollmentId = await resolveEnrollmentId(context.env, mid);
    if (!enrollmentId) return json({ success: true, notes: [], source: 'no-enrollment' });

    const rows = await context.env.DB.prepare(
      "SELECT id, actor, details, created_at FROM pifr_activity_log WHERE enrollment_id = ? AND action = 'admin_note' ORDER BY created_at DESC LIMIT 200"
    ).bind(enrollmentId).all();

    const notes = (rows.results || []).map(r => {
      let parsed = {};
      try { parsed = JSON.parse(r.details || '{}'); } catch (_) { parsed = { text: r.details || '' }; }
      return { id: r.id, by: r.actor, ts: r.created_at, text: parsed.text || '' };
    });

    return json({ success: true, mid, notes, source: 'd1' });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Missing id' }, 400);
    if (!context.env?.DB) return json({ error: 'D1 not configured' }, 500);

    await context.env.DB.prepare(
      "DELETE FROM pifr_activity_log WHERE id = ? AND action = 'admin_note'"
    ).bind(id).run();

    return json({ success: true, id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  });
}
