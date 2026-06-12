export async function onRequestPost(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  try {
    const body = await context.request.json();
    const action = body.action || 'create'; // create | update | cancel
    const startIso = String(body.startIso || '').trim();
    const durationMin = Number(body.durationMin || 30);
    const clientEmail = String(body.clientEmail || '').trim();
    const clientName = String(body.clientName || '').trim();
    const sourceId = String(body.source_id || '').trim();
    const validateOnly = body.validateOnly === true || body.validateOnly === 'true';

    const parsedStart = validateMeetingRequest({ action, startIso, durationMin, clientEmail, clientName });
    if (!parsedStart.ok) {
      return new Response(JSON.stringify({ success: false, error: parsedStart.error }), { status: 400, headers: cors });
    }

    const sender = context.env.GMAIL_SENDER_EMAIL || 'hello@hirecar.la';
    const requestedCc = Array.isArray(body.ccEmails) ? body.ccEmails : [];
    const toRecipients = Array.from(new Set([clientEmail].map(v => String(v || '').trim()).filter(Boolean)));
    const ccRecipients = Array.from(new Set(['ken@hirecar.la'].concat(requestedCc).map(v => String(v || '').trim()).filter(Boolean)))
      .filter(email => !toRecipients.some(to => to.toLowerCase() === email.toLowerCase()));
    const attendees = Array.from(new Set(toRecipients.concat(ccRecipients)));
    const summary = String(body.title || (clientName ? `HIRECAR Meeting — ${clientName}` : 'HIRECAR Client Meeting')).trim();
    const description = String(body.description || '').trim();
    const location = String(body.location || 'TBD').trim();
    const uid = body.uid || ('hc-meeting-' + Date.now() + '@hirecar.la');
    const endIso = new Date(new Date(startIso).getTime() + durationMin * 60000).toISOString();

    const status = action === 'cancel' ? 'CANCELLED' : 'CONFIRMED';
    const method = action === 'cancel' ? 'CANCEL' : 'REQUEST';
    const ics = buildIcs({ uid, summary, description, location, startIso, endIso, organizer: sender, attendees, method, status });

    if (validateOnly) {
      return new Response(JSON.stringify({
        success: true,
        validated: true,
        uid,
        startIso: parsedStart.startIso,
        durationMin,
        attendees,
        to: toRecipients,
        cc: ccRecipients,
      }), { status: 200, headers: cors });
    }

    const subjectPrefix = action === 'update' ? 'Updated:' : (action === 'cancel' ? 'Canceled:' : 'Invite:');
    const subject = `${subjectPrefix} ${summary}`;
    const html = `<p>${summary}</p><p>${new Date(startIso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p><p>${location}</p><p>${description}</p>`;

    const accessToken = await getGoogleAccessToken(context);
    await sendGmail(accessToken, sender, toRecipients, ccRecipients, subject, html, ics, method);

    return new Response(JSON.stringify({ success: true, uid }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: cors });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

async function getStoredGoogleRefreshToken(context) {
  if (!context.env?.PIFR_ENROLLMENTS) return '';
  try {
    return await context.env.PIFR_ENROLLMENTS.get('google_oauth_refresh_token');
  } catch (_) {
    return '';
  }
}

async function getGoogleAccessToken(context) {
  const env = context.env || {};
  const refreshToken = await getStoredGoogleRefreshToken(context) || env.GOOGLE_REFRESH_TOKEN;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token exchange failed');
  return j.access_token;
}

async function sendGmail(token, from, to, cc, subject, html, ics, method) {
  const boundary = 'b_' + Math.random().toString(36).slice(2);
  const ccHeader = cc.length ? `Cc: ${cc.join(', ')}\n` : '';
  const raw =
`From: ${from}
To: ${to.join(', ')}
${ccHeader}Subject: ${subject}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset="UTF-8"

${html}
--${boundary}
Content-Type: text/calendar; method=${method}; charset="UTF-8"
Content-Transfer-Encoding: 7bit
Content-Disposition: attachment; filename="invite.ics"

${ics}
--${boundary}--`;
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded })
  });
  if (!resp.ok) throw new Error('Gmail send failed');
}

function validateMeetingRequest({ action, startIso, durationMin, clientEmail, clientName }) {
  const allowedActions = new Set(['create', 'update', 'cancel']);
  if (!allowedActions.has(action)) {
    return { ok: false, error: 'Invalid action' };
  }
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return { ok: false, error: 'Invalid clientEmail' };
  }
  if (!startIso || Number.isNaN(Date.parse(startIso))) {
    return { ok: false, error: 'Invalid startIso' };
  }
  if (!Number.isFinite(durationMin) || durationMin < 15 || durationMin > 240) {
    return { ok: false, error: 'Invalid durationMin' };
  }
  if (clientName && clientName.length > 120) {
    return { ok: false, error: 'clientName is too long' };
  }
  return { ok: true, startIso };
}

function buildIcs({ uid, summary, description, location, startIso, endIso, organizer, attendees, method, status }) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HIRECAR//Admin Portal//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(startIso)}`,
    `DTEND:${fmt(endIso)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    `STATUS:${status}`,
    `ORGANIZER:mailto:${organizer}`,
    ...attendees.map(a => `ATTENDEE;CN=${a};RSVP=TRUE:mailto:${a}`),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
