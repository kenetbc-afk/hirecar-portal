const JSON_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
}

export async function onRequestGet({ request, env }) {
  const auth = verifySession(request, env)
  if (!auth.ok) return json({ success: false, error: 'Unauthorized' }, 401)

  const db = env.OFFER_ANALYTICS_DB
  if (!db || typeof db.prepare !== 'function') {
    return json({ success: false, error: 'Offer analytics database is not bound' }, 503)
  }

  const url = new URL(request.url)
  const days = Math.min(365, Math.max(1, Number.parseInt(url.searchParams.get('days') || '30', 10) || 30))
  const since = `-${days} days`

  try {
    const [totals, byDay, byLocation, byReferrer, byCampaign, byDevice, recent] = await Promise.all([
      db.prepare(
        `SELECT COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors,
                COUNT(DISTINCT session_id) AS sessions,
                MIN(created_at) AS first_view,
                MAX(created_at) AS last_view
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)`
      ).bind(since).first(),
      db.prepare(
        `SELECT substr(created_at, 1, 10) AS day,
                COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY day ORDER BY day DESC`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(country, 'Unknown') AS country,
                COALESCE(region, 'Unknown') AS region,
                COALESCE(city, 'Unknown') AS city,
                COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY country, region, city
         ORDER BY views DESC LIMIT 100`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(referrer, ''), 'Direct / unknown') AS referrer,
                COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY referrer ORDER BY views DESC LIMIT 30`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(utm_source, ''), 'Unattributed') AS source,
                COALESCE(NULLIF(utm_campaign, ''), 'Unattributed') AS campaign,
                COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY source, campaign ORDER BY views DESC LIMIT 30`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(device_type, 'unknown') AS device, COUNT(*) AS views
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY device ORDER BY views DESC`
      ).bind(since).all(),
      db.prepare(
        `SELECT created_at, visitor_id, session_id, page_path, referrer,
                utm_source, utm_campaign, city, region, country,
                timezone, device_type, viewport_width, viewport_height
         FROM offer_page_views
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         ORDER BY created_at DESC LIMIT 100`
      ).bind(since).all(),
    ])

    return json({
      success: true,
      generatedAt: new Date().toISOString(),
      days,
      totals: totals || {},
      byDay: byDay.results || [],
      byLocation: byLocation.results || [],
      byReferrer: byReferrer.results || [],
      byCampaign: byCampaign.results || [],
      byDevice: byDevice.results || [],
      recent: recent.results || [],
    }, 200)
  } catch (error) {
    console.error('offer analytics read failed', String(error).slice(0, 300))
    return json({ success: false, error: 'Unable to load offer analytics' }, 500)
  }
}

export async function onRequest() {
  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { ...JSON_HEADERS, allow: 'GET' },
  })
}

function verifySession(request, env) {
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token')
  const headerToken = request.headers.get('x-hc-admin-token')
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)hc_admin_token=([^;]+)/)
  const token = queryToken || headerToken || (match ? match[1] : '')
  if (!token) return { ok: false }

  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false }
  const secret = String(env.ADMIN_SESSION_SECRET || env.ADMIN_API_KEY || SESSION_SECRET)
  if (!secret) return { ok: false }

  const expected = simpleHash(secret + '|' + parts[0])
  if (!timingSafeEqual(expected, parts[1])) return { ok: false }

  try {
    const payload = JSON.parse(decodeURIComponent(parts[0]))
    if (!payload || !payload.u || !payload.exp || Date.now() > payload.exp) return { ok: false }
    return { ok: true, user: payload.u, access: payload.a || 'limited' }
  } catch {
    return { ok: false }
  }
}

function simpleHash(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

const SESSION_SECRET = 'hc-admin-session-2026-06-14-portal'
