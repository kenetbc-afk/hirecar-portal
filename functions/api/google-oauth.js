const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events',
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (code) return handleCallback(context, code, state);
  return handleStart(context, url);
}

async function handleStart(context, url) {
  const key = url.searchParams.get('key') || '';
  if (!isValidSetupKey(context, key)) {
    return html('Unauthorized', 'Invalid or missing OAuth setup key.', 401);
  }

  const redirectUri = new URL('/api/google-oauth', url.origin).toString();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', context.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('login_hint', 'admin@hirecar.la');
  authUrl.searchParams.set('state', key);

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(context, code, state) {
  if (!isValidSetupKey(context, state || '')) {
    return html('Unauthorized', 'Invalid OAuth callback state.', 401);
  }

  try {
    const requestUrl = new URL(context.request.url);
    const redirectUri = new URL('/api/google-oauth', requestUrl.origin).toString();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: context.env.GOOGLE_CLIENT_ID,
        client_secret: context.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenBody.error_description || tokenBody.error || 'Google OAuth token exchange failed');
    }
    if (!tokenBody.refresh_token) {
      throw new Error('Google did not return a refresh token. Re-run setup with prompt=consent or revoke the prior app grant first.');
    }
    if (!context.env?.PIFR_ENROLLMENTS) {
      throw new Error('PIFR_ENROLLMENTS KV binding is missing.');
    }

    await context.env.PIFR_ENROLLMENTS.put('google_oauth_refresh_token', tokenBody.refresh_token);
    await context.env.PIFR_ENROLLMENTS.put('google_oauth_refresh_token_updated_at', new Date().toISOString());

    const calendarStatus = await validateCalendar(context, tokenBody.access_token);
    const details = calendarStatus.ok
      ? 'Calendar free/busy validation passed for admin@hirecar.la.'
      : 'Token saved, but calendar validation did not pass: ' + calendarStatus.error;
    return html('HIRECAR Google OAuth Connected', details, calendarStatus.ok ? 200 : 500);
  } catch (err) {
    return html('HIRECAR Google OAuth Failed', err.message, 500);
  }
}

async function validateCalendar(context, accessToken) {
  try {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 16, 0, 0)).toISOString();
    const end = new Date(Date.parse(start) + 30 * 60000).toISOString();
    const calendarIds = String(context.env.GOOGLE_AVAILABILITY_CALENDAR_IDS || 'admin@hirecar.la')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: start,
        timeMax: end,
        timeZone: 'America/Los_Angeles',
        items: calendarIds.map(id => ({ id })),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      return { ok: false, error: body.error?.message || 'freeBusy failed' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function isValidSetupKey(context, value) {
  const expected = context.env.GOOGLE_OAUTH_SETUP_KEY;
  return Boolean(expected && value && timingSafeEqual(value, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function html(title, message, status = 200) {
  return new Response(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<body style="margin:0;background:#070b13;color:#e8eef8;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh">
  <main style="max-width:620px;padding:32px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#101827">
    <h1 style="margin:0 0 12px;color:#20d0ec">${escapeHtml(title)}</h1>
    <p style="line-height:1.6;color:#b7c4d8">${escapeHtml(message)}</p>
    <p style="font-size:12px;color:#7d8ba2">You can close this window and return to HIRECAR.</p>
  </main>
</body>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
