/**
 * Cloudflare Pages Function — Site visitor tracking
 * POST /api/visit  → record a page-load (no auth)
 * GET  /api/visit  → return aggregate stats (admin)
 *
 * D1 table: site_visits  (created in schema/003_site_visits.sql)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const cf = context.request.cf || {};
    const ua = context.request.headers.get('user-agent') || '';

    const row = {
      visitor_id: String(body.visitor_id || '').slice(0, 64),
      site: String(body.site || 'enrollment').slice(0, 32),
      page: String(body.page || '').slice(0, 256),
      referrer: String(body.referrer || '').slice(0, 256),
      country: cf.country || '',
      city: cf.city || '',
      user_agent: ua.slice(0, 256),
    };

    if (context.env?.DB) {
      await context.env.DB.prepare(
        `INSERT INTO site_visits (visitor_id, site, page, referrer, country, city, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(row.visitor_id, row.site, row.page, row.referrer, row.country, row.city, row.user_agent).run();
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) {
      return new Response(JSON.stringify({ success: true, total: 0, today: 0, last7: 0, last30: 0, uniqueVisitors: 0 }), { headers: corsHeaders });
    }

    const url = new URL(context.request.url);
    const site = url.searchParams.get('site');
    const where = site ? 'WHERE site = ?' : '';
    const binds = site ? [site] : [];

    const sqlAggregate = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN date(visited_at) = date('now') THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN visited_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS last7,
        SUM(CASE WHEN visited_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS last30,
        COUNT(DISTINCT visitor_id) AS uniqueVisitors
      FROM site_visits ${where}
    `;
    const aggStmt = context.env.DB.prepare(sqlAggregate);
    const agg = binds.length ? await aggStmt.bind(...binds).first() : await aggStmt.first();

    const sqlByDay = `
      SELECT date(visited_at) AS day, COUNT(*) AS n
      FROM site_visits
      ${where ? where + ' AND ' : 'WHERE '} visited_at >= datetime('now', '-14 days')
      GROUP BY day ORDER BY day DESC
    `;
    const byDayStmt = context.env.DB.prepare(sqlByDay);
    const byDay = binds.length ? await byDayStmt.bind(...binds).all() : await byDayStmt.all();

    const sqlByCountry = `
      SELECT country, COUNT(*) AS n
      FROM site_visits
      ${where ? where + ' AND ' : 'WHERE '} country != ''
      GROUP BY country ORDER BY n DESC LIMIT 10
    `;
    const byCountryStmt = context.env.DB.prepare(sqlByCountry);
    const byCountry = binds.length ? await byCountryStmt.bind(...binds).all() : await byCountryStmt.all();

    const sqlBySite = `
      SELECT site, COUNT(*) AS n,
        SUM(CASE WHEN date(visited_at) = date('now') THEN 1 ELSE 0 END) AS today,
        COUNT(DISTINCT visitor_id) AS uniq
      FROM site_visits
      GROUP BY site ORDER BY n DESC
    `;
    const bySite = await context.env.DB.prepare(sqlBySite).all();

    return new Response(JSON.stringify({
      success: true,
      total: agg?.total || 0,
      today: agg?.today || 0,
      last7: agg?.last7 || 0,
      last30: agg?.last30 || 0,
      uniqueVisitors: agg?.uniqueVisitors || 0,
      byDay: byDay.results || [],
      byCountry: byCountry.results || [],
      bySite: bySite.results || [],
    }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
