const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_STAGE_BASE_URL = 'https://stage-api.consumerdirect.io';
const DEFAULT_PROD_BASE_URL = 'https://api.consumerdirect.io';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isExplicitlyDisabled(value) {
  return ['0', 'false', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
}

function getClientKey(env) {
  return String(env.SMARTCREDIT_CLIENT_KEY || env.SMARTCREDIT_API_KEY || '').trim();
}

function getClientSecret(env) {
  return String(env.SMARTCREDIT_CLIENT_SECRET || env.SMARTCREDIT_API_SECRET || env.SMARTCREDIT_SECRET || '').trim();
}

function isAuthorized(request, env) {
  const expected = String(env.ADMIN_API_KEY || env.API_KEY || env.HIRECAR_API_KEY || '').trim();
  if (!expected) return true;
  return String(request.headers.get('x-api-key') || '').trim() === expected;
}

function getUpstreamBaseUrl(env) {
  const custom = String(env.SMARTCREDIT_BASE_URL || '').trim();
  if (custom) return custom.replace(/\/+$/, '');

  const mode = String(env.SMARTCREDIT_ENV || 'stage').trim().toLowerCase();
  if (mode === 'production' || mode === 'prod') {
    return String(env.SMARTCREDIT_BASE_URL_PROD || DEFAULT_PROD_BASE_URL).replace(/\/+$/, '');
  }
  return String(env.SMARTCREDIT_BASE_URL_STAGE || DEFAULT_STAGE_BASE_URL).replace(/\/+$/, '');
}

function getConfig(env) {
  const clientKey = getClientKey(env);
  const clientSecret = getClientSecret(env);
  const enabled = !!clientKey && !!clientSecret && !isExplicitlyDisabled(env.SMARTCREDIT_ENABLED);
  return {
    ok: true,
    enabled,
    configured: !!clientKey && !!clientSecret,
    hasKey: !!clientKey,
    hasSecret: !!clientSecret,
    env: String(env.SMARTCREDIT_ENV || 'stage'),
  };
}

function buildUpstreamRequest(context, path) {
  const { request, env } = context;
  const target = new URL(getUpstreamBaseUrl(env) + path);

  const originalUrl = new URL(request.url);
  originalUrl.searchParams.delete('path');
  for (const [key, value] of originalUrl.searchParams.entries()) {
    target.searchParams.append(key, value);
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');
  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  const clientKey = getClientKey(env);
  headers.set('x-client-key', clientKey);
  headers.set('x-api-key', clientKey);
  const clientSecret = getClientSecret(env);
  if (clientSecret) {
    headers.set('x-client-secret', clientSecret);
    headers.set('x-api-secret', clientSecret);
  }

  return {
    target,
    init: {
      method: request.method,
      headers,
      redirect: 'follow',
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    },
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }
  const url = new URL(request.url);
  const rawPath = String(url.searchParams.get('path') || '/config').trim();
  const path = rawPath.startsWith('/') ? rawPath : '/' + rawPath;

  if (path === '/config') {
    return json(getConfig(env));
  }

  const clientKey = getClientKey(env);
  const clientSecret = getClientSecret(env);
  if (!clientKey || !clientSecret || isExplicitlyDisabled(env.SMARTCREDIT_ENABLED)) {
    return json(
      {
        ok: false,
        error: 'SmartCredit is not configured',
        enabled: false,
        configured: !!clientKey && !!clientSecret,
      },
      503
    );
  }

  try {
    const { target, init } = buildUpstreamRequest(context, path);
    const upstream = await fetch(target.toString(), init);
    const headers = new Headers(upstream.headers);
    headers.set('cache-control', 'no-store');
    headers.set('access-control-allow-origin', '*');
    headers.set('access-control-allow-methods', CORS_HEADERS['Access-Control-Allow-Methods']);
    headers.set('access-control-allow-headers', CORS_HEADERS['Access-Control-Allow-Headers']);
    headers.set('access-control-max-age', CORS_HEADERS['Access-Control-Max-Age']);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'SmartCredit proxy failed',
      },
      502
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
