/**
 * Cloudflare Pages Function — Admin authentication endpoint
 * POST /api/admin-auth
 * Body: { username: "ken", pin: "8086" }
 *
 * Validates admin credentials against environment variables.
 * Returns a signed session token on success.
 *
 * Environment variables required (set in Cloudflare Pages dashboard):
 *   ADMIN_CREDENTIALS = JSON string, e.g.:
 *   [{"username":"ken","pin":"8086","role":"Owner","name":"Ken","access":"full"},
 *    {"username":"admin2","pin":"1234","role":"Staff","name":"Admin 2","access":"limited"}]
 *
 *   ADMIN_EXTRA_CREDENTIALS = optional JSON array merged into ADMIN_CREDENTIALS
 *     without replacing the primary encrypted credential set.
 *
 *   ADMIN_API_KEY = the API key for Worker calls (replaces hardcoded key in admin.html)
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
    const username = String(body.username || '').trim().toLowerCase();
    const pin = String(body.pin || '').trim();

    if (!username || !pin) {
      return new Response(JSON.stringify({ success: false, error: 'Missing credentials' }), {
        status: 400, headers: cors
      });
    }

    // Load admin credentials from environment variables. ADMIN_EXTRA_CREDENTIALS
    // is additive so one-off users can be added without replacing the primary
    // encrypted ADMIN_CREDENTIALS secret.
    let admins = [];
    try {
      admins = JSON.parse(env.ADMIN_CREDENTIALS || '[]');
      const extraAdmins = JSON.parse(env.ADMIN_EXTRA_CREDENTIALS || '[]');
      admins = admins.concat(extraAdmins);
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
        status: 500, headers: cors
      });
    }

    // Find matching admin
    const admin = admins.find(a => a.username.toLowerCase() === username);
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

    // Generate session token (random hex, 32 chars)
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Return admin info + API key (so admin.html never has it hardcoded)
    return new Response(JSON.stringify({
      success: true,
      token: token,
      admin: {
        username: admin.username,
        role: admin.role,
        name: admin.name,
        access: admin.access,
      },
      apiKey: env.ADMIN_API_KEY || '',
    }), {
      status: 200,
      headers: {
        ...cors,
        'Set-Cookie': `hc_admin_token=${token}; Path=/; Max-Age=28800; SameSite=Strict; Secure; HttpOnly`,
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
