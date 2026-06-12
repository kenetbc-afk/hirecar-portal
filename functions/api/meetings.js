const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

async function loadAll(KV) {
  const raw = await KV.get('meetings_store_v1');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

async function saveAll(KV, obj) {
  await KV.put('meetings_store_v1', JSON.stringify(obj));
}

export async function onRequestGet(context) {
  const sourceId = new URL(context.request.url).searchParams.get('source_id');
  if (!sourceId) return json({ error: 'Missing source_id' }, 400);
  const store = await loadAll(context.env.PIFR_ENROLLMENTS);
  return json({ success: true, source_id: sourceId, meetings: store[sourceId] || [] });
}

export async function onRequestPost(context) {
  const body = await context.request.json();
  const sourceId = String(body.source_id || '').trim();
  if (!sourceId) return json({ error: 'Missing source_id' }, 400);
  const store = await loadAll(context.env.PIFR_ENROLLMENTS);
  if (!store[sourceId]) store[sourceId] = [];
  store[sourceId].unshift(body.meeting || {});
  store[sourceId] = store[sourceId].slice(0, 100);
  await saveAll(context.env.PIFR_ENROLLMENTS, store);
  return json({ success: true });
}

export async function onRequestPatch(context) {
  const body = await context.request.json();
  const sourceId = String(body.source_id || '').trim();
  const uid = String(body.uid || '').trim();
  if (!sourceId || !uid) return json({ error: 'Missing source_id or uid' }, 400);
  const store = await loadAll(context.env.PIFR_ENROLLMENTS);
  const rows = store[sourceId] || [];
  const idx = rows.findIndex(r => String(r.uid || '') === uid);
  if (idx === -1) return json({ error: 'Meeting not found' }, 404);
  rows[idx] = { ...rows[idx], ...(body.patch || {}), updatedAt: new Date().toISOString() };
  store[sourceId] = rows;
  await saveAll(context.env.PIFR_ENROLLMENTS, store);
  return json({ success: true, meeting: rows[idx] });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}
