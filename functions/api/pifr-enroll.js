// Cloudflare Pages Function — /api/pifr-enroll
// Receives enrollment data from hirecar-pifr-enrollment.pages.dev
// Stores in KV (PIFR_ENROLLMENTS) + D1 (pifr_enrollments) for persistence
// Supports GET (list), POST (create), PATCH (admin edits/status)

const PIFR_COL_MAP = {
  fname: 'fname',
  lname: 'lname',
  email: 'email',
  phone: 'phone',
  address1: 'address1',
  address2: 'address2',
  city: 'city',
  region: 'region',
  postalCode: 'postal_code',
  postal_code: 'postal_code',
  country: 'country',
  entryPoint: 'entry_point',
  entry_point: 'entry_point',
  lane: 'lane',
  plan: 'plan',
  planPrice: 'plan_price',
  plan_price: 'plan_price',
  scoreRange: 'score_range',
  score_range: 'score_range',
  issues: 'issues',
  goal: 'goal',
  timeline: 'timeline',
  bureaus: 'bureaus',
  channels: 'channels',
  profileScore: 'profile_score',
  profile_score: 'profile_score',
  xp: 'xp',
  level: 'level',
  status: 'status',
  notes: 'notes',
  sourceValidationStatus: 'source_validation_status',
  sourceValidationMatchedBy: 'source_validation_matched_by',
  sourceValidationReason: 'source_validation_reason',
  sourceValidationAt: 'source_validation_at',
  reportAccessStatus: 'report_access_status',
  reportAccessDetails: 'report_access_details',
  scoreModel: 'score_model',
  reportLastUpdated: 'report_last_updated',
  equifaxScore: 'equifax_score',
  experianScore: 'experian_score',
  transunionScore: 'transunion_score',
  ficoScores: 'fico_scores',
  ficoAutoScoreAverage: 'fico_auto_score_average',
  ficoScore8: 'fico_score_8',
  ficoRealEstateRentalScore: 'fico_real_estate_rental_score',
  ssnFundingStatus: 'ssn_funding_status',
  bnplStatus: 'bnpl_status',
  bnplApprovedAmount: 'bnpl_approved_amount',
  clientReviewStatus: 'client_review_status',
  calDate: 'cal_date',
  cal_date: 'cal_date',
  calTime: 'cal_time',
  cal_time: 'cal_time',
  calMonth: 'cal_month',
  cal_month: 'cal_month',
  calYear: 'cal_year',
  cal_year: 'cal_year',
  state: 'state',
  zip: 'zip',
  assigned_to: 'assigned_to',
  primaryMember: 'primary_member',
  primary_member: 'primary_member',
  coveredMembers: 'covered_members',
  covered_members: 'covered_members',
  planMembers: 'plan_members',
  plan_members: 'plan_members',
  dependentCount: 'dependent_count',
  dependent_count: 'dependent_count',
  email_day0_sent: 'email_day0_sent',
  email_day0_opened: 'email_day0_opened',
  email_day1_sent: 'email_day1_sent',
  email_day1_opened: 'email_day1_opened',
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeMemberId(value) {
  return String(value || '').trim().toUpperCase();
}

function publicEnrollmentMatch(row) {
  if (!row) return null;
  return {
    member_id: row.member_id || row.mid || '',
    email: row.email || '',
    fname: row.fname || '',
    lname: row.lname || '',
    phone: row.phone || '',
    status: row.status || '',
    lane: row.lane || '',
    plan: row.plan || ''
  };
}

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
        const sets = [];
        const vals = [];
        for (const k in PIFR_COL_MAP) {
          if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
            sets.push(PIFR_COL_MAP[k] + ' = ?');
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
          INSERT INTO pifr_enrollments (id, member_id, fname, lname, email, phone,
            address1, address2, city, region, postal_code, country, entry_point,
            plan, plan_price, score_range, issues, goal, timeline, bureaus, channels, profile_score, xp, level,
            status, cal_date, cal_time, cal_month, cal_year, state, zip, notes, lane,
            primary_member, covered_members, plan_members, dependent_count,
            source_validation_status, source_validation_matched_by, source_validation_reason, source_validation_at,
            report_access_status, report_access_details, score_model, report_last_updated,
            equifax_score, experian_score, transunion_score, fico_scores, fico_auto_score_average, fico_score_8, fico_real_estate_rental_score,
            ssn_funding_status, bnpl_status, bnpl_approved_amount, client_review_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          resolvedId, data.mid, data.fname || '', data.lname || '', data.email, data.phone || '',
          data.address1 || '', data.address2 || '', data.city || '', data.region || '',
          data.postalCode || data.zip || '', data.country || '', data.entryPoint || data.entry_point || '',
          data.plan || '', data.planPrice || '', data.scoreRange || '', data.issues || '',
          data.goal || '', data.timeline || '', data.bureaus || '', data.channels || '',
          data.profileScore || 0, data.xp || 0, data.level || '',
          data.status || 'new',
          data.calDate || null, data.calTime || null, data.calMonth || null, data.calYear || null,
          data.state || '', data.zip || '', data.notes || '', data.lane || '',
          data.primaryMember || data.primary_member || '', data.coveredMembers || data.covered_members || '',
          data.planMembers || data.plan_members || '', data.dependentCount || data.dependent_count || 0,
          data.sourceValidationStatus || data.source_validation_status || '',
          data.sourceValidationMatchedBy || data.source_validation_matched_by || '',
          data.sourceValidationReason || data.source_validation_reason || '',
          data.sourceValidationAt || data.source_validation_at || null,
          data.reportAccessStatus || data.report_access_status || '',
          data.reportAccessDetails || data.report_access_details || '',
          data.scoreModel || data.score_model || '',
          data.reportLastUpdated || data.report_last_updated || null,
          data.equifaxScore || data.equifax_score || 0,
          data.experianScore || data.experian_score || 0,
          data.transunionScore || data.transunion_score || 0,
          data.ficoScores || data.fico_scores || '',
          data.ficoAutoScoreAverage || data.fico_auto_score_average || 0,
          data.ficoScore8 || data.fico_score_8 || 0,
          data.ficoRealEstateRentalScore || data.fico_real_estate_rental_score || 0,
          data.ssnFundingStatus || data.ssn_funding_status || '',
          data.bnplStatus || data.bnpl_status || '',
          data.bnplApprovedAmount || data.bnpl_approved_amount || 0,
          data.clientReviewStatus || data.client_review_status || ''
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
      const validate = url.searchParams.get('validate') === '1';
      const status = url.searchParams.get('status');
      const memberId = url.searchParams.get('member_id');
      const email = url.searchParams.get('email');
      const archived = url.searchParams.get('archived'); // '1' = only archived, '0'/null = exclude archived, 'all' = include both

      if (validate) {
        if (!memberId || !email) {
          return new Response(JSON.stringify({ success: false, allowed: false, error: 'HC number and email are required' }), { status: 400, headers: cors });
        }
        const row = await context.env.DB.prepare(
          `SELECT member_id, email, fname, lname, phone, status, lane, plan
           FROM pifr_enrollments
           WHERE UPPER(member_id) = UPPER(?) AND LOWER(email) = LOWER(?)
           LIMIT 1`
        ).bind(normalizeMemberId(memberId), normalizeEmail(email)).first();
        return new Response(JSON.stringify({
          success: true,
          allowed: !!row,
          match: publicEnrollmentMatch(row)
        }), { status: row ? 200 : 403, headers: cors });
      }

      let query = 'SELECT * FROM pifr_enrollments';
      const where = [];
      const binds = [];

      if (memberId) {
        where.push('member_id = ?');
        binds.push(memberId);
      } else if (email) {
        where.push('LOWER(email) = LOWER(?)');
        binds.push(email);
      } else if (status) {
        where.push('status = ?');
        binds.push(status);
      }

      if (archived === '1') {
        where.push('archived_at IS NOT NULL');
      } else if (archived !== 'all') {
        where.push('archived_at IS NULL');
      }

      if (where.length) query += ' WHERE ' + where.join(' AND ');
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
      const url = new URL(context.request.url);
      const validate = url.searchParams.get('validate') === '1';
      const memberId = url.searchParams.get('member_id');
      const email = url.searchParams.get('email');
      if (validate) {
        if (!memberId || !email) {
          return new Response(JSON.stringify({ success: false, allowed: false, error: 'HC number and email are required' }), { status: 400, headers: cors });
        }
        const raw = await context.env.PIFR_ENROLLMENTS.get(`enrollment:${memberId}`);
        const row = raw ? JSON.parse(raw) : null;
        const allowed = !!row && normalizeEmail(row.email) === normalizeEmail(email);
        return new Response(JSON.stringify({
          success: true,
          allowed,
          match: allowed ? publicEnrollmentMatch({ ...row, member_id: row.mid || memberId }) : null
        }), { status: allowed ? 200 : 403, headers: cors });
      }

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

    const sets = [];
    const vals = [];
    for (const key in PIFR_COL_MAP) {
      if (data[key] !== undefined) {
        sets.push(PIFR_COL_MAP[key] + ' = ?');
        vals.push(data[key]);
      }
    }

    // Archive toggle: data.archive === true → set archived_at = now; === false → clear it
    if (data.archive === true) {
      sets.push('archived_at = ?');
      vals.push(new Date().toISOString());
    } else if (data.archive === false) {
      sets.push('archived_at = ?');
      vals.push(null);
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

    // Log admin edits/status changes
    if (data.status) {
      await context.env.DB.prepare(
        'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
      ).bind(rowId, 'status_changed', data.actor || 'admin', JSON.stringify({
        new_status: data.status, notes: data.notes || ''
      })).run();
    } else if (sets.length) {
      await context.env.DB.prepare(
        'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
      ).bind(rowId, 'admin_edit', data.actor || 'admin', JSON.stringify({
        fields: Object.keys(data).filter(k => PIFR_COL_MAP[k])
      })).run();
    }

    // Log archive/restore
    if (data.archive === true || data.archive === false) {
      await context.env.DB.prepare(
        'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
      ).bind(rowId, data.archive ? 'archived' : 'restored', data.actor || 'admin', JSON.stringify({})).run();
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
