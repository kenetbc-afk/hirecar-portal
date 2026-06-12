/**
 * Cloudflare Pages Function — HIRECAR Client Booking
 * POST /api/booking
 * GET  /api/booking?date=YYYY-MM-DD
 * GET  /api/booking?memberId=XXX
 */

const TIMEZONE = 'America/Los_Angeles';
const DURATION_MIN = 30;
const MEETINGS_KEY = 'meetings_store_v1';

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM',
];

const BOOKING_TYPES = {
  'strategy-call': 'HIRECAR Strategy Call',
  'credit-review': 'Credit Review',
  'funding-consultation': 'Funding Consultation',
  'auto-approval': 'Auto Approval Review',
  'tax-planning': 'Tax Planning',
  'general': 'General Consultation',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const email = String(data.email || '').trim();
    const date = String(data.date || '').trim();
    const time = String(data.time || '').trim();
    const type = BOOKING_TYPES[data.type] ? data.type : 'strategy-call';
    const notes = String(data.notes || '').trim().slice(0, 1500);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: 'Valid email is required' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !TIME_SLOTS.includes(time)) {
      return json({ success: false, error: 'Valid date and time are required' }, 400);
    }

    const availability = await getAvailability(context, date);
    if (!availability.slots.includes(time)) {
      return json({ success: false, error: 'Selected time is no longer available' }, 409);
    }

    const startIso = pacificWallTimeToUtcIso(date, time);
    const endIso = new Date(new Date(startIso).getTime() + DURATION_MIN * 60000).toISOString();
    const id = 'bk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const clientName = [data.fname, data.lname].map(v => String(v || '').trim()).filter(Boolean).join(' ') || 'HIRECAR Client';
    const title = `${BOOKING_TYPES[type]} — ${clientName}`;

    const booking = {
      id,
      memberId: String(data.memberId || '').trim(),
      fname: String(data.fname || '').trim(),
      lname: String(data.lname || '').trim(),
      email,
      phone: String(data.phone || '').trim(),
      date,
      time,
      startIso,
      endIso,
      timezone: TIMEZONE,
      durationMin: DURATION_MIN,
      type,
      typeLabel: BOOKING_TYPES[type],
      notes,
      status: 'confirmed',
      inviteStatus: 'pending',
      calendarConnected: availability.calendarConnected,
      createdAt: new Date().toISOString(),
    };

    const invite = await sendMeetingInvite(context, {
      booking,
      title,
      clientName,
      description: buildInviteDescription(booking),
    });

    booking.uid = invite.uid;
    booking.inviteStatus = 'sent';

    if (context.env?.PIFR_ENROLLMENTS) {
      await saveBooking(context.env.PIFR_ENROLLMENTS, booking);
      await reserveSlot(context.env.PIFR_ENROLLMENTS, date, time);
      await appendMeeting(context.env.PIFR_ENROLLMENTS, 'meet', toMeetingRecord(booking, title, clientName));
      if (booking.memberId) {
        await appendMeeting(context.env.PIFR_ENROLLMENTS, booking.memberId, toMeetingRecord(booking, title, clientName));
      }
    }

    return json({
      success: true,
      booking,
      invite: { sent: true, uid: invite.uid },
      availability: {
        calendarConnected: availability.calendarConnected,
        calendarCount: availability.calendarCount,
      },
    });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const memberId = url.searchParams.get('memberId');
  const email = url.searchParams.get('email');
  const date = url.searchParams.get('date');

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ success: false, error: 'Invalid date' }, 400);
    }
    const availability = await getAvailability(context, date);
    return json({
      success: true,
      date,
      timezone: TIMEZONE,
      durationMin: DURATION_MIN,
      slots: availability.slots,
      calendarConnected: availability.calendarConnected,
      calendarCount: availability.calendarCount,
      calendarStatus: availability.calendarStatus,
    });
  }

  const lookup = String(memberId || email || '').trim();
  if (lookup && context.env?.PIFR_ENROLLMENTS) {
    const bookings = await loadBookings(context.env.PIFR_ENROLLMENTS, lookup);
    return json({ success: true, bookings });
  }

  return json({
    success: true,
    timezone: TIMEZONE,
    durationMin: DURATION_MIN,
    slots: TIME_SLOTS,
    types: BOOKING_TYPES,
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}

async function getAvailability(context, date) {
  const takenSlots = await getReservedSlots(context.env?.PIFR_ENROLLMENTS, date);
  let busyBlocks = [];
  let calendarConnected = false;
  let calendarStatus = 'kv-only';
  let calendarCount = 0;

  try {
    const calendarIds = getCalendarIds(context.env || {});
    calendarCount = calendarIds.length;
    if (calendarIds.length && hasGoogleCalendarConfig(context.env || {})) {
      busyBlocks = await getGoogleBusyBlocks(context, date, calendarIds);
      calendarConnected = true;
      calendarStatus = 'connected';
    } else if (!calendarIds.length) {
      calendarStatus = 'no-calendar-config';
    } else {
      calendarStatus = 'missing-google-oauth-config';
    }
  } catch (err) {
    calendarStatus = 'calendar-check-failed: ' + err.message;
  }

  const now = Date.now();
  const slots = TIME_SLOTS.filter(slot => {
    if (takenSlots.includes(slot)) return false;
    const startIso = pacificWallTimeToUtcIso(date, slot);
    const start = new Date(startIso).getTime();
    const end = start + DURATION_MIN * 60000;
    if (start <= now + 15 * 60000) return false;
    return !busyBlocks.some(block => start < block.end && end > block.start);
  });

  return { slots, calendarConnected, calendarStatus, calendarCount };
}

async function getReservedSlots(KV, date) {
  if (!KV) return [];
  const raw = await KV.get(`slots:${date}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function reserveSlot(KV, date, time) {
  const slots = await getReservedSlots(KV, date);
  if (!slots.includes(time)) slots.push(time);
  await KV.put(`slots:${date}`, JSON.stringify(slots));
}

async function saveBooking(KV, booking) {
  await KV.put(`booking:${booking.id}`, JSON.stringify(booking));
  const keys = Array.from(new Set([booking.memberId, booking.email].filter(Boolean)));
  for (const key of keys) {
    const listKey = `bookings:${key}`;
    const listRaw = await KV.get(listKey);
    let list = [];
    try { list = listRaw ? JSON.parse(listRaw) : []; } catch (_) { list = []; }
    list.unshift(booking.id);
    await KV.put(listKey, JSON.stringify(Array.from(new Set(list)).slice(0, 50)));
  }
}

async function loadBookings(KV, lookup) {
  const listRaw = await KV.get(`bookings:${lookup}`);
  let list = [];
  try { list = listRaw ? JSON.parse(listRaw) : []; } catch (_) { list = []; }
  const bookings = [];
  for (const id of list.slice(0, 20)) {
    const raw = await KV.get(`booking:${id}`);
    if (raw) {
      try { bookings.push(JSON.parse(raw)); } catch (_) {}
    }
  }
  return bookings;
}

function getCalendarIds(env) {
  const raw = env.GOOGLE_AVAILABILITY_CALENDAR_IDS || env.GOOGLE_CALENDAR_IDS || env.GOOGLE_CALENDAR_ID || 'admin@hirecar.la';
  return String(raw).split(',').map(v => v.trim()).filter(Boolean);
}

function hasGoogleCalendarConfig(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
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
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || 'Google token exchange failed');
  }
  return body.access_token;
}

async function getGoogleBusyBlocks(context, date, calendarIds) {
  const token = await getGoogleAccessToken(context);
  const timeMin = pacificWallTimeToUtcIso(date, '12:00 AM');
  const timeMax = new Date(new Date(pacificWallTimeToUtcIso(date, '11:59 PM')).getTime() + 60000).toISOString();
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      items: calendarIds.map(id => ({ id })),
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || 'Google Calendar freeBusy failed');
  }

  const blocks = [];
  for (const id of calendarIds) {
    const cal = body.calendars?.[id];
    if (!cal || cal.errors?.length) continue;
    for (const busy of cal.busy || []) {
      blocks.push({ start: new Date(busy.start).getTime(), end: new Date(busy.end).getTime() });
    }
  }
  return blocks;
}

async function sendMeetingInvite(context, { booking, title, clientName, description }) {
  const url = new URL('/api/meeting-invite', context.request.url);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      source_id: 'client-portal',
      startIso: booking.startIso,
      durationMin: booking.durationMin,
      clientEmail: booking.email,
      clientName,
      title,
      location: 'Google Meet / Phone Call',
      description,
      ccEmails: [],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.error || 'Meeting invite failed');
  }
  return body;
}

async function appendMeeting(KV, sourceId, meeting) {
  const raw = await KV.get(MEETINGS_KEY);
  let store = {};
  try { store = raw ? JSON.parse(raw) : {}; } catch (_) { store = {}; }
  if (!store[sourceId]) store[sourceId] = [];
  store[sourceId].unshift(meeting);
  store[sourceId] = store[sourceId].slice(0, 100);
  await KV.put(MEETINGS_KEY, JSON.stringify(store));
}

function toMeetingRecord(booking, title, clientName) {
  return {
    uid: booking.uid,
    source: 'client-portal',
    sourceId: booking.memberId || booking.email,
    bookingId: booking.id,
    clientName,
    clientEmail: booking.email,
    phone: booking.phone,
    startIso: booking.startIso,
    endIso: booking.endIso,
    durationMin: booking.durationMin,
    title,
    location: 'Google Meet / Phone Call',
    description: buildInviteDescription(booking),
    status: 'confirmed',
    inviteStatus: booking.inviteStatus,
    calendarConnected: booking.calendarConnected,
    requestedAt: booking.createdAt,
    createdAt: booking.createdAt,
  };
}

function buildInviteDescription(booking) {
  const parts = [
    `Booking ID: ${booking.id}`,
    `Member ID: ${booking.memberId || 'not provided'}`,
    `Service: ${booking.typeLabel}`,
    `Phone: ${booking.phone || 'not provided'}`,
  ];
  if (booking.notes) parts.push(`Notes: ${booking.notes}`);
  return parts.join('\n');
}

function pacificWallTimeToUtcIso(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = parseTime(time);
  const wallUtc = Date.UTC(year, month - 1, day, parsed.hour, parsed.minute, 0);
  let utc = wallUtc - getTimeZoneOffsetMs(wallUtc);
  utc = wallUtc - getTimeZoneOffsetMs(utc);
  return new Date(utc).toISOString();
}

function parseTime(time) {
  const match = String(time).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error('Invalid time');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

function getTimeZoneOffsetMs(utcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return asUtc - utcMs;
}
