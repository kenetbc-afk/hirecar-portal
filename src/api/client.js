/**
 * HIRECAR API Client
 * ──────────────────
 * Wraps all Worker API endpoints.
 * In dev, Vite proxies /api → Worker URL.
 * In production, set VITE_API_URL to the Worker domain.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const { method = 'GET', body, clientId, token } = options;

  const headers = { 'Content-Type': 'application/json' };
  if (clientId) headers['X-Client-Id'] = clientId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = API_BASE ? `${API_BASE}${path}` : `/api${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status, data);
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────

export function verifyLogin(email, pin) {
  return request('/auth/verify', {
    method: 'POST',
    body: { email, pin },
  });
}

export function validateToken(token) {
  return request(`/auth/token/${token}`);
}

// ── Dashboard ─────────────────────────────────────────────

export function getDashboard(clientId) {
  return request(`/client/${clientId}/dashboard`, { clientId });
}

// ── Documents ─────────────────────────────────────────────

export function listDocuments(clientId) {
  return request(`/client/${clientId}/documents`, { clientId });
}

export function uploadDocument(clientId, file, category) {
  // File uploads use FormData, not JSON
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const url = API_BASE
    ? `${API_BASE}/client/${clientId}/documents`
    : `/api/client/${clientId}/documents`;

  return fetch(url, {
    method: 'POST',
    headers: { 'X-Client-Id': clientId },
    body: formData,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'Upload failed', res.status, data);
    return data;
  });
}

export function downloadDocument(clientId, docId) {
  const url = API_BASE
    ? `${API_BASE}/client/${clientId}/documents/${docId}`
    : `/api/client/${clientId}/documents/${docId}`;

  return fetch(url, {
    headers: { 'X-Client-Id': clientId },
  });
}

// ── Messages ──────────────────────────────────────────────

export function getMessages(clientId) {
  return request(`/client/${clientId}/messages`, { clientId });
}

export function sendMessage(clientId, text) {
  return request(`/client/${clientId}/messages`, {
    method: 'POST',
    clientId,
    body: { text },
  });
}

export { ApiError };
