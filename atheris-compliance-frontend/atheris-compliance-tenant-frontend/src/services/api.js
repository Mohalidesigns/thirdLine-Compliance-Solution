const API_BASE = 'http://localhost:9091/api/v1';

let authToken = null;

export const setToken = (t) => { authToken = t; };
export const getToken = () => authToken;

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  },
  regulators: {
    list: () => request('/subscriptions/regulators'),
    get: (id) => request(`/subscriptions/regulators/${id}`),
    create: (data) => request('/subscriptions/regulators', {
      method: 'POST', body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/subscriptions/regulators/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    remove: (id) => request(`/subscriptions/regulators/${id}`, { method: 'DELETE' }),
  },
  uploads: {
    upload: (formData) => {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${API_BASE}/subscriptions/upload-document`, {
        method: 'POST', headers, body: formData,
      }).then(async (res) => {
        if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw new Error(err.message); }
        return res.json();
      });
    },
    status: (id) => request(`/subscriptions/upload-status/${id}`),
    list: (page = 0, size = 20) => request(`/subscriptions/uploads?page=${page}&size=${size}`),
  },
  instruments: {
    list: (page = 0, size = 20, q = '') => request(`/subscriptions/instruments?page=${page}&size=${size}&q=${encodeURIComponent(q)}`),
    get: (id) => request(`/subscriptions/instruments/${id}`),
  },
  settings: {
    polling: () => request('/settings/polling'),
    updatePolling: (data) => request('/settings/polling', {
      method: 'PUT', body: JSON.stringify(data),
    }),
  },
};
