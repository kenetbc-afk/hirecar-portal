export async function onRequestPost(context) {
  const { request } = context;
  const origin = new URL(request.url).origin;
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      ...cors,
      'Set-Cookie': `hc_admin_token=; Path=/; Max-Age=0; SameSite=Strict${origin.startsWith('https://') ? '; Secure' : ''}; HttpOnly`,
    },
  });
}

export async function onRequestOptions(context) {
  const origin = new URL(context.request.url).origin;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
