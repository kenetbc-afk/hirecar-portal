/**
 * Cloudflare Pages Function — PIN verification endpoint
 * POST /api/verify-pin
 * Body: { pin: "4456" }
 *
 * Sets a 24-hour auth cookie on success.
 */
export async function onRequestPost(context) {
  const { request } = context;

  // CORS preflight is handled automatically by Cloudflare Pages Functions,
  // but we set headers explicitly for safety.
  const corsHeaders = {
    'Access-Control-Allow-Origin': new URL(request.url).origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const pin = String(body.pin || '').trim();

    if (pin === '4456') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie':
            'pifr_deck_auth=verified; Path=/investor-deck; Max-Age=86400; SameSite=Strict; Secure; HttpOnly',
          ...corsHeaders,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid PIN' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Bad request' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/** Handle CORS preflight */
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
