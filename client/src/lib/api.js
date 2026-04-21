async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.location.assign('/login');
    return null;
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p)
};

export async function login(email, password) {
  return api.post('/api/auth/login', { email, password });
}
export async function logout() {
  return api.post('/api/auth/logout');
}
export async function getMe() {
  return api.get('/api/auth/me');
}
