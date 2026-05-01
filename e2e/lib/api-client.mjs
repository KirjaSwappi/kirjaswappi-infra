const BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';

let authToken = null;

export function setToken(token) {
  authToken = token;
}

export function getToken() {
  return authToken;
}

export async function api(method, path, body, options = {}) {
  const headers = { ...options.headers };

  if (authToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { status: res.status, json, text, headers: res.headers };
}

export const get = (path, opts) => api('GET', path, null, opts);
export const post = (path, body, opts) => api('POST', path, body, opts);
export const put = (path, body, opts) => api('PUT', path, body, opts);
export const patch = (path, body, opts) => api('PATCH', path, body, opts);
export const del = (path, opts) => api('DELETE', path, null, opts);
