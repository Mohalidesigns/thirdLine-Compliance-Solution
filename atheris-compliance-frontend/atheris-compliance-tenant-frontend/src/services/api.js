const API_BASE = 'http://localhost:9091/api/v1';

let authToken = null;
let authRefreshToken = null;

export const setToken = (t) => { authToken = t; };
export const getToken = () => authToken;
export const setRefreshToken = (t) => { authRefreshToken = t; };
export const getRefreshToken = () => authRefreshToken;

const STORAGE_KEY_TOKEN = 'atheris_tenant_token';
const STORAGE_KEY_REFRESH = 'atheris_tenant_refresh_token';
const STORAGE_KEY_USER = 'atheris_tenant_user';

async function doRefresh() {
  if (!authRefreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: authRefreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    authToken = data.accessToken;
    authRefreshToken = data.refreshToken;
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken);
    } catch {}
    return data.accessToken;
  } catch {
    return null;
  }
}

function clearAuth() {
  authToken = null;
  authRefreshToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch {}
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot connect to server. Please try again.');
  }

  if (res.status === 204) return null;

  if ((res.status === 401 || res.status === 403) && !path.startsWith('/auth/')) {
    if (authRefreshToken) {
      const refreshed = await doRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${refreshed}`;
        try {
          res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        } catch {
          throw new Error('Cannot connect to server. Please try again.');
        }
      } else {
        clearAuth();
        sessionStorage.setItem('atheris_tenant_session_expired', '1');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    } else {
      clearAuth();
      sessionStorage.setItem('atheris_tenant_session_expired', '1');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  let body = '';
  try {
    body = await res.text();
  } catch {
    throw new Error('Failed to read response');
  }

  if (!body) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return null;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Unexpected response: ${body.substring(0, 100)}`);
  }

  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  auth: {
    demo: () => request('/demo/login', { method: 'POST' }),
    login: (email, password) => request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  },
  onboarding: {
    status: (opts = {}) => request('/onboarding/status', opts),
    activateLicense: (data) => request('/onboarding/activate-license', { method: 'POST', body: JSON.stringify(data) }),
    institution: (data) => request('/onboarding/institution', { method: 'POST', body: JSON.stringify(data) }),
    userSetup: (data) => request('/onboarding/user-setup', { method: 'POST', body: JSON.stringify(data) }),
    regulators: (data) => request('/onboarding/regulators', { method: 'POST', body: JSON.stringify(data) }),
    documentTypes: (data) => request('/onboarding/document-types', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (data) => request('/onboarding/confirm', { method: 'POST', body: JSON.stringify(data) }),
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
  inbox: {
    list: (page = 0, size = 20) => request(`/obligations/inbox?page=${page}&size=${size}`),
  },
  obligations: {
    classify: (id, data) => request(`/obligations/${id}/classify`, {
      method: 'POST', body: JSON.stringify(data),
    }),
    register: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/obligations/register${s ? '?' + s : ''}`);
    },
    detail: (id) => request(`/obligations/${id}/detail`),
    history: (id) => request(`/obligations/${id}/history`),
    riskTypes: () => request('/obligations/risk-types'),
  },
  findings: {
    register: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/findings/register${s ? '?' + s : ''}`);
    },
    detail: (id) => request(`/findings/${id}/detail`),
    raise: (data) => request('/findings', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id, data) => request(`/findings/${id}/assign`, { method: 'PUT', body: JSON.stringify(data) }),
    remediate: (id, data) => request(`/findings/${id}/remediate`, { method: 'PUT', body: JSON.stringify(data) }),
    close: (id) => request(`/findings/${id}/close`, { method: 'PUT' }),
  },
  controls: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/controls${s ? '?' + s : ''}`);
    },
    register: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/controls/register${s ? '?' + s : ''}`);
    },
    detail: (id) => request(`/controls/${id}/detail`),
    get: (id) => request(`/controls/${id}`),
    create: (data) => request('/controls', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/controls/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    recordTest: (id, data) => request(`/controls/${id}/tests`, { method: 'POST', body: JSON.stringify(data) }),
  },
  returns: {
    calendar: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/returns/calendar${s ? '?' + s : ''}`);
    },
    detail: (id) => request(`/returns/instances/${id}/detail`),
    advance: (id, data) => request(`/returns/instances/${id}/advance`, { method: 'PUT', body: JSON.stringify(data) }),
    submit: (id, data) => request(`/returns/instances/${id}/submit`, { method: 'PUT', body: JSON.stringify(data) }),
    create: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),
  },
  evidence: {
    list: (page = 0, size = 20) => request(`/evidence?page=${page}&size=${size}`),
    upload: (formData) => {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${API_BASE}/evidence/upload`, {
        method: 'POST', headers, body: formData,
      }).then(async (res) => {
        if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw new Error(err.message); }
        return res.json();
      });
    },
    download: (id) => {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${API_BASE}/evidence/${id}/download`, { headers })
        .then(async (res) => {
          if (!res.ok) throw new Error('Download failed');
          const blob = await res.blob();
          const disposition = res.headers.get('Content-Disposition');
          const match = disposition && disposition.match(/filename="?(.+?)"?$/);
          const name = match ? match[1] : 'evidence.bin';
          return { blob, name };
        });
    },
  },
  audit: {
    register: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/audit/register${s ? '?' + s : ''}`);
    },
    verify: () => request('/audit/verify'),
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
    trends: () => request('/dashboard/trends'),
    attentionItems: () => request('/dashboard/attention-items'),
  },
  settings: {
    polling: () => request('/settings/polling'),
    updatePolling: (data) => request('/settings/polling', {
      method: 'PUT', body: JSON.stringify(data),
    }),
  },
};
