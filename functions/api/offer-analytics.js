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
    const [totals, byDay, byLocation, byReferrer, byCampaign, bySource, byDevice, byBrowser, byPage, visitors, funnel, recent] = await Promise.all([
      db.prepare(
        `SELECT SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
                COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) AS visitors,
                COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) AS sessions,
                COUNT(DISTINCT CASE WHEN event_type = 'page_view' AND previous_visit_at IS NOT NULL THEN visitor_id END) AS returning_visitors,
                COUNT(DISTINCT CASE WHEN privacy_signal = 1 AND event_type = 'page_view' THEN visitor_id END) AS privacy_visitors,
                COUNT(DISTINCT CASE WHEN event_type IN ('engagement','session_summary') AND (engagement_ms >= 15000 OR scroll_depth >= 50 OR click_count > 0) THEN session_id END) AS engaged_sessions,
                SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks,
                SUM(CASE WHEN event_type = 'form_start' THEN 1 ELSE 0 END) AS form_starts,
                SUM(CASE WHEN event_type = 'form_submit' THEN 1 ELSE 0 END) AS form_submits,
                ROUND(AVG(CASE WHEN event_type = 'session_summary' THEN engagement_ms END)) AS avg_engagement_ms,
                ROUND(AVG(CASE WHEN event_type = 'session_summary' THEN scroll_depth END)) AS avg_scroll_depth,
                MIN(CASE WHEN event_type = 'page_view' THEN created_at END) AS first_view,
                MAX(CASE WHEN event_type = 'page_view' THEN created_at END) AS last_view
         FROM offer_behavior_events
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)`
      ).bind(since).first(),
      db.prepare(
        `SELECT substr(created_at, 1, 10) AS day,
                SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
                COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) AS visitors,
                COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) AS sessions
         FROM offer_behavior_events
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY day HAVING views > 0 ORDER BY day DESC`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(country, 'Unknown') AS country,
                COALESCE(region, 'Unknown') AS region,
                COALESCE(city, 'Unknown') AS city,
                COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY country, region, city ORDER BY views DESC LIMIT 100`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(referrer, ''), 'Direct / unknown') AS referrer,
                COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY referrer ORDER BY views DESC LIMIT 30`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(utm_source, ''), 'Unattributed') AS source,
                COALESCE(NULLIF(utm_medium, ''), 'Unattributed') AS medium,
                COALESCE(NULLIF(utm_campaign, ''), 'Unattributed') AS campaign,
                COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY source, medium, campaign ORDER BY views DESC LIMIT 30`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(source_category, ''), 'unknown') AS source,
                COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY source ORDER BY views DESC`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(device_type, 'unknown') AS device,
                COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY device ORDER BY views DESC`
      ).bind(since).all(),
      db.prepare(
        `SELECT COALESCE(browser, 'unknown') AS browser,
                COALESCE(operating_system, 'unknown') AS operating_system,
                COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY browser, operating_system ORDER BY views DESC LIMIT 30`
      ).bind(since).all(),
      db.prepare(
        `SELECT page_path, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors,
                COUNT(DISTINCT session_id) AS sessions
         FROM offer_behavior_events
         WHERE event_type = 'page_view' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         GROUP BY page_path ORDER BY views DESC LIMIT 50`
      ).bind(since).all(),
      db.prepare(
        `WITH filtered AS (
           SELECT * FROM offer_behavior_events
           WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         ), ranked AS (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY visitor_id ORDER BY created_at DESC, id DESC) AS rn
           FROM filtered
         ), aggregate AS (
           SELECT visitor_id,
                  MIN(CASE WHEN event_type = 'page_view' THEN created_at END) AS first_visit,
                  MAX(CASE WHEN event_type = 'page_view' THEN created_at END) AS last_visit,
                  SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
                  COUNT(DISTINCT session_id) AS sessions,
                  SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks,
                  MAX(COALESCE(scroll_depth, 0)) AS max_scroll_depth,
                  SUM(CASE WHEN event_type = 'session_summary' THEN COALESCE(engagement_ms, 0) ELSE 0 END) AS engagement_ms,
                  MAX(CASE WHEN event_type = 'form_start' THEN 1 ELSE 0 END) AS form_started,
                  MAX(CASE WHEN event_type = 'form_submit' THEN 1 ELSE 0 END) AS form_submitted,
                  MAX(CASE WHEN previous_visit_at IS NOT NULL THEN previous_visit_at END) AS previous_visit_at,
                  MAX(privacy_signal) AS privacy_signal
           FROM filtered GROUP BY visitor_id
         )
         SELECT a.*, r.page_path AS last_page, r.entry_page, r.referrer, r.source_category,
                r.utm_source, r.utm_medium, r.utm_campaign,
                r.city, r.region, r.country, r.device_type, r.browser, r.operating_system,
                r.viewport_width, r.viewport_height, r.language, r.client_timezone
         FROM aggregate a JOIN ranked r ON r.visitor_id = a.visitor_id AND r.rn = 1
         WHERE a.views > 0 ORDER BY a.last_visit DESC LIMIT 200`
      ).bind(since).all(),
      db.prepare(
        `SELECT
           COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) AS page_view,
           COUNT(DISTINCT CASE WHEN event_type IN ('engagement','session_summary') AND (engagement_ms >= 15000 OR scroll_depth >= 50 OR click_count > 0) THEN visitor_id END) AS engaged,
           COUNT(DISTINCT CASE WHEN event_type = 'scroll' AND scroll_depth >= 50 THEN visitor_id END) AS scroll_50,
           COUNT(DISTINCT CASE WHEN event_type = 'scroll' AND scroll_depth >= 90 THEN visitor_id END) AS scroll_90,
           COUNT(DISTINCT CASE WHEN event_type = 'click' THEN visitor_id END) AS clicked,
           COUNT(DISTINCT CASE WHEN event_type = 'form_start' THEN visitor_id END) AS form_started,
           COUNT(DISTINCT CASE WHEN event_type = 'form_submit' THEN visitor_id END) AS form_submitted
         FROM offer_behavior_events
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)`
      ).bind(since).first(),
      db.prepare(
        `SELECT created_at, visitor_id, session_id, event_type, event_name,
                page_path, referrer, source_category, utm_source, utm_medium, utm_campaign,
                target_text, target_url, section_name, scroll_depth, engagement_ms,
                city, region, country, device_type, browser, operating_system, privacy_signal
         FROM offer_behavior_events
         WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)
         ORDER BY created_at DESC, id DESC LIMIT 200`
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
      bySource: bySource.results || [],
      byDevice: byDevice.results || [],
      byBrowser: byBrowser.results || [],
      byPage: byPage.results || [],
      visitors: visitors.results || [],
      funnel: funnel || {},
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
