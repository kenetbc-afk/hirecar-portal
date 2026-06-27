const WORKER_BASE = "https://hirecar-api.hirecar.workers.dev";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path") || "/";
  const path = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
  const targetUrl = WORKER_BASE + path;

  const auth = await verifySession(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("x-api-key", String(env.ADMIN_API_KEY || env.API_KEY || env.HIRECAR_API_KEY || ""));
  headers.set("x-admin-user", auth.user);

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  const upstream = await fetch(targetUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function verifySession(request, env) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = request.headers.get("x-hc-admin-token");
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)hc_admin_token=([^;]+)/);
  const token = queryToken || headerToken || (match ? match[1] : "");
  if (!token) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };

  const payloadJson = await verifySignature(env, parts[0], parts[1]);
  if (!payloadJson) return { ok: false };

  try {
    const payload = JSON.parse(payloadJson);
    if (!payload || !payload.u || !payload.exp || Date.now() > payload.exp) return { ok: false };
    return { ok: true, user: payload.u, access: payload.a || "limited" };
  } catch {
    return { ok: false };
  }
}

async function verifySignature(env, payloadB64, sigHex) {
  const secret = String(env.ADMIN_SESSION_SECRET || env.ADMIN_API_KEY || SESSION_SECRET);
  if (!secret) return null;
  const expected = simpleHash(secret + "|" + payloadB64);
  if (!timingSafeEqual(expected, sigHex)) return null;
  return decodeURIComponent(payloadB64);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const SESSION_SECRET = "hc-admin-session-2026-06-14-portal";
