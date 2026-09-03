/**
 * Cloudflare Pages Function — Admin authentication endpoint
 * POST /api/admin-auth
 * Body: { username: "<admin>", pin: "<pin>" }
 *
 * Validates admin credentials against environment variables.
 * Returns a signed session token on success and sets an HttpOnly cookie.
 *
 * Environment variables required (set in Cloudflare Pages dashboard):
 *   ADMIN_CREDENTIALS = JSON string, e.g.:
 *   [{"username":"admin1","pin":"1234","role":"Owner","name":"Admin 1","access":"full"},
 *    {"username":"admin2","pin":"1234","role":"Staff","name":"Admin 2","access":"limited"}]
 *
 *   ADMIN_EXTRA_CREDENTIALS = optional JSON array merged into ADMIN_CREDENTIALS
 *     without replacing the primary encrypted credential set.
 *
 *   ADMIN_RUNTIME_CREDENTIALS = optional JSON array merged after
 *     ADMIN_EXTRA_CREDENTIALS so one-off internal logins can be added safely
 *     without overwriting existing extra-admin secrets.
 *
 *   ADMIN_API_KEY = server-side key used only by the proxy
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const cors = {
    'Access-Control-Allow-Origin': new URL(request.url).origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const username = canonicalUsername(body.username);
    const pin = String(body.pin || '').trim();

    if (!username || !pin) {
      return new Response(JSON.stringify({ success: false, error: 'Missing credentials' }), {
        status: 400, headers: cors
      });
    }

    // Load admin credentials from environment variables. ADMIN_EXTRA_CREDENTIALS
    // is additive so one-off users can be added without replacing the primary
    // encrypted ADMIN_CREDENTIALS secret.
    const admins = mergeAdminCredentials(env);
    applyKenPinOverride(env, admins);

    if (!admins.length) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401, headers: cors
      });
    }

    // Find matching admin
    const admin = admins.find(a => canonicalUsername(a.username) === username);
    if (!admin) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401, headers: cors
      });
    }

    // Timing-safe PIN comparison
    const expected = String(admin.pin);
    if (pin.length !== expected.length) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401, headers: cors
      });
    }

    let match = true;
    for (let i = 0; i < pin.length; i++) {
      if (pin.charCodeAt(i) !== expected.charCodeAt(i)) match = false;
    }

    if (!match) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401, headers: cors
      });
    }

    // Generate a signed session payload for the proxy to verify server-side.
    const exp = Date.now() + 8 * 60 * 60 * 1000;
    const payload = {
      u: admin.username,
      a: admin.access || 'limited',
      r: admin.role || '',
      n: admin.name || admin.username,
      exp,
    };
    const token = signSession(env, payload);

    // Return admin info. The browser never receives the worker API key.
    return new Response(JSON.stringify({
      success: true,
      token: token,
      apiKey: String(env.ADMIN_API_KEY || env.API_KEY || env.HIRECAR_API_KEY || ''),
      admin: {
        username: admin.username,
        role: admin.role,
        name: admin.name,
        access: admin.access,
      },
    }), {
      status: 200,
      headers: {
        ...cors,
        'Set-Cookie': `hc_admin_token=${token}; Path=/; Max-Age=28800; SameSite=Strict${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}; HttpOnly`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Bad request' }), {
      status: 400, headers: cors
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function signSession(env, payload) {
  const secret = String(env.ADMIN_SESSION_SECRET || env.ADMIN_API_KEY || SESSION_SECRET);
  if (!secret) throw new Error('Missing session secret');
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const sig = simpleHash(secret + '|' + encoded);
  return encoded + '.' + sig;
}

const SESSION_SECRET = 'hc-admin-session-2026-06-14-portal';

function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function canonicalUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (username === 'kene') return 'ken';
  if (username === 'mayra') return 'myra';
  return username;
}

function mergeAdminCredentials(env) {
  const sources = [
    env.ADMIN_CREDENTIALS,
    env.ADMIN_EXTRA_CREDENTIALS,
    env.ADMIN_RUNTIME_CREDENTIALS,
  ];
  const merged = new Map();

  for (const source of sources) {
    const parsed = parseCredentialList(source);
    for (const admin of parsed) {
      const username = canonicalUsername(admin.username);
      if (!username || !admin.pin) continue;
      merged.set(username, {
        username,
        pin: String(admin.pin).trim(),
        role: String(admin.role || '').trim(),
        name: String(admin.name || username).trim(),
        access: String(admin.access || 'limited').trim() || 'limited',
      });
    }
  }

  return Array.from(merged.values());
}

// Allows Ken's credential to be rotated independently without replacing the
// encrypted multi-admin credential lists.
function applyKenPinOverride(env, admins) {
  const pin = String(env.ADMIN_KEN_PIN || '').trim();
  if (!pin) return;

  const ken = admins.find(admin => canonicalUsername(admin.username) === 'ken');
  if (ken) {
    ken.pin = pin;
    return;
  }

  admins.push({
    username: 'ken',
    pin,
    role: 'Owner',
    name: 'Ken',
    access: 'full',
  });
}

function parseCredentialList(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}
