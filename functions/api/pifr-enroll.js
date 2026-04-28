// Cloudflare Pages Function — /api/pifr-enroll
// Receives enrollment data from hirecar-pifr-enrollment.pages.dev
// Stores in KV (PIFR_ENROLLMENTS) + D1 (pifr_enrollments) for persistence
// Supports GET (list), POST (create), PATCH (update status)

export async function onRequestPost(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Content-Type': 'application/json',
  };

  try {
    const data = await context.request.json();

    if (!data.mid || !data.email) {
      return new Response(JSON.stringify({ error: 'Missing mid or email' }), { status: 400, headers: cors });
    }

    // Store in KV (backward compatible)
    if (context.env?.PIFR_ENROLLMENTS) {
      await context.env.PIFR_ENROLLMENTS.put(`enrollment:${data.mid}`, JSON.stringify({
        ...data,
        receivedAt: new Date().toISOString()
      }));

      const listRaw = await context.env.PIFR_ENROLLMENTS.get('enrollment_list');
      const list = listRaw ? JSON.parse(listRaw) : [];
      if (!list.includes(data.mid)) {
        list.unshift(data.mid);
        await context.env.PIFR_ENROLLMENTS.put('enrollment_list', JSON.stringify(list));
      }
    }

    // Store in D1 (new persistent layer) — UPSERT by member_id so progress events
    // continuously enrich the same row instead of duplicating.
    let resolvedId = null;
    let action = 'created';
    if (context.env?.DB) {
      const existing = await context.env.DB.prepare(
        'SELECT id FROM pifr_enrollments WHERE member_id = ? LIMIT 1'
      ).bind(data.mid).first();

      if (existing) {
        resolvedId = existing.id;
        action = 'updated';
        // Build dynamic UPDATE — only touch fields the client supplied.
        const colMap = {
          fname:'fname', lname:'lname', email:'email', phone:'phone',
          plan:'plan', planPrice:'plan_price', scoreRange:'score_range',
          issues:'issues', goal:'goal', timeline:'timeline',
          bureaus:'bureaus', channels:'channels',
          profileScore:'profile_score', xp:'xp', level:'level',
          status:'status', notes:'notes',
          calDate:'cal_date', calTime:'cal_time', calMonth:'cal_month', calYear:'cal_year',
          state:'state', zip:'zip'
        };
        const sets = [];
        const vals = [];
        for (const k in colMap) {
          if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
            sets.push(colMap[k] + ' = ?');
            vals.push(data[k]);
          }
        }
        if (sets.length) {
          sets.push('updated_at = ?');
          vals.push(new Date().toISOString());
          vals.push(existing.id);
          await context.env.DB.prepare(
            'UPDATE pifr_enrollments SET ' + sets.join(', ') + ' WHERE id = ?'
          ).bind(...vals).run();
        }

        await context.env.DB.prepare(
          'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
        ).bind(existing.id, 'enrollment_progress', 'client', JSON.stringify({
          status: data.status, notes: data.notes, mid: data.mid
        })).run();
      } else {
        resolvedId = 'pifr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        await context.env.DB.prepare(`
          INSERT INTO pifr_enrollments (id, member_id, fname, lname, email, phone, plan, plan_price,
            score_range, issues, goal, timeline, bureaus, channels, profile_score, xp, level,
            status, cal_date, cal_time, cal_month, cal_year, state, zip, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          resolvedId, data.mid, data.fname || '', data.lname || '', data.email, data.phone || '',
          data.plan || '', data.planPrice || '', data.scoreRange || '', data.issues || '',
          data.goal || '', data.timeline || '', data.bureaus || '', data.channels || '',
          data.profileScore || 0, data.xp || 0, data.level || '',
          data.status || 'new',
          data.calDate || null, data.calTime || null, data.calMonth || null, data.calYear || null,
          data.state || '', data.zip || '', data.notes || ''
        ).run();

        await context.env.DB.prepare(
          'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
        ).bind(resolvedId, 'enrollment_created', 'system', JSON.stringify({
          plan: data.plan, source: 'pifr-enrollment-form', mid: data.mid, status: data.status || 'new'
        })).run();
      }
    }

    return new Response(JSON.stringify({ success: true, mid: data.mid, id: resolvedId, action }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

// GET — list enrollments (from D1 if available, fallback to KV)
export async function onRequestGet(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Content-Type': 'application/json',
  };

  try {
    // Try D1 first
    if (context.env?.DB) {
      const url = new URL(context.request.url);
      const status = url.searchParams.get('status');
      const memberId = url.searchParams.get('member_id');

      let query = 'SELECT * FROM pifr_enrollments';
      const binds = [];

      if (status) {
        query += ' WHERE status = ?';
        binds.push(status);
      } else if (memberId) {
        query += ' WHERE member_id = ?';
        binds.push(memberId);
      }

      query += ' ORDER BY created_at DESC LIMIT 200';

      const stmt = context.env.DB.prepare(query);
      const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

      return new Response(JSON.stringify({
        success: true,
        enrollments: rows.results || [],
        source: 'd1'
      }), { headers: cors });
    }

    // Fallback to KV
    if (context.env?.PIFR_ENROLLMENTS) {
      const listRaw = await context.env.PIFR_ENROLLMENTS.get('enrollment_list');
      const list = listRaw ? JSON.parse(listRaw) : [];
      const enrollments = [];
      for (const mid of list.slice(0, 100)) {
        const raw = await context.env.PIFR_ENROLLMENTS.get(`enrollment:${mid}`);
        if (raw) enrollments.push(JSON.parse(raw));
      }
      return new Response(JSON.stringify({ success: true, enrollments, source: 'kv' }), { headers: cors });
    }

    return new Response(JSON.stringify({ success: true, enrollments: [], source: 'none' }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

// PATCH — update enrollment status (admin actions)
export async function onRequestPatch(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Content-Type': 'application/json',
  };

  try {
    const data = await context.request.json();

    if (!data.id && !data.mid && !data.member_id) {
      return new Response(JSON.stringify({ error: 'Missing enrollment id or member_id' }), { status: 400, headers: cors });
    }

    if (!context.env?.DB) {
      return new Response(JSON.stringify({ error: 'D1 not configured' }), { status: 500, headers: cors });
    }

    // Resolve id from member_id if needed
    let rowId = data.id;
    if (!rowId) {
      const memberKey = data.mid || data.member_id;
      const found = await context.env.DB.prepare(
        'SELECT id FROM pifr_enrollments WHERE member_id = ? LIMIT 1'
      ).bind(memberKey).first();
      if (!found) {
        return new Response(JSON.stringify({ error: 'No enrollment found for member_id ' + memberKey }), { status: 404, headers: cors });
      }
      rowId = found.id;
    }

    // Build dynamic SET clause
    const allowed = ['status', 'assigned_to', 'notes', 'email_day0_sent', 'email_day0_opened',
      'email_day1_sent', 'email_day1_opened'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(key + ' = ?');
        vals.push(data[key]);
      }
    }

    if (sets.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400, headers: cors });
    }

    sets.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(rowId);

    await context.env.DB.prepare(
      'UPDATE pifr_enrollments SET ' + sets.join(', ') + ' WHERE id = ?'
    ).bind(...vals).run();

    // Log the status change
    if (data.status) {
      await context.env.DB.prepare(
        'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
      ).bind(rowId, 'status_changed', data.actor || 'admin', JSON.stringify({
        new_status: data.status, notes: data.notes || ''
      })).run();
    }

    return new Response(JSON.stringify({ success: true, id: rowId }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  });
}
