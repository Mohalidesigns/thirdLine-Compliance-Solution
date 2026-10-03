export const API_BASE = '/api/v1';

let authToken = null;
let authRefreshToken = null;

export const setToken = (t) => { authToken = t; };
export const getToken = () => authToken;
export const setRefreshToken = (t) => { authRefreshToken = t; };
export const getRefreshToken = () => authRefreshToken;

// A PDF endpoint answers 404 with {error, message} when the record has no stored
// document (common: toolkit-imported instruments never carry one). Turn that into
// a message worth showing, and fall back to the generic one for real failures.
export async function pdfErrorMessage(res, fallback = 'Failed to load PDF.') {
  try {
    const body = await res.clone().json();
    const code = String(body?.error || '').toLowerCase();
    if (code === 'document_unavailable') return 'No document is available for this instrument.';
  } catch {
    // non-JSON body (proxy/network error) — fall through
  }
  return fallback;
}

const STORAGE_KEY_TOKEN = 'atheris_tenant_token';
const STORAGE_KEY_REFRESH = 'atheris_tenant_refresh_token';
const STORAGE_KEY_USER = 'atheris_tenant_user';
const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action.';

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
  const { headers: optHeaders, signal, ...rest } = options;
  const headers = { 'Content-Type': 'application/json', ...optHeaders };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers, ...(signal ? { signal } : {}) });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new Error('Cannot connect to server. Please try again.');
  }

  if (res.status === 204) return null;

  // Only 401 means the session is gone (missing/expired/invalid token). A 403 is a real
  // denial — a role the user lacks, or license_blocked from LicenseFilter — and must
  // surface as an error, not log the user out.
  if (res.status === 401 && !path.startsWith('/auth/')) {
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
    if (res.status === 403) throw new Error(FORBIDDEN_MESSAGE);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return null;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Unexpected response: ${body.substring(0, 100)}`);
  }

  if (!res.ok) {
    const fallback = res.status === 403 ? FORBIDDEN_MESSAGE : `Request failed (${res.status})`;
    throw new Error(data.message || data.error || fallback);
  }
  return data;
}

function sessionExpired() {
  clearAuth();
  sessionStorage.setItem('atheris_tenant_session_expired', '1');
  window.location.href = '/login';
  throw new Error('Session expired');
}

// For bodies/responses request() cannot handle: multipart FormData (Content-Type is
// left unset so the browser adds the boundary) and binary downloads. Shares request()'s
// token handling: on 401 it refreshes once and retries, else ends the session; a 403
// (role denial / license_blocked) surfaces as an error like any other failure.
// `responseType: 'blob'` resolves to { blob, name } (name from Content-Disposition);
// otherwise the JSON body. Failures surface the server's {message}/{error}.
async function rawRequest(path, { responseType = 'json', fallbackName = 'download.bin', ...options } = {}) {
  const send = () => {
    const headers = { ...(options.headers || {}) };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };

  let res;
  try {
    res = await send();
    if (res.status === 401 && !path.startsWith('/auth/')) {
      if (!authRefreshToken) sessionExpired();
      const refreshed = await doRefresh();
      if (!refreshed) sessionExpired();
      res = await send();
    }
  } catch (e) {
    if (e?.name === 'AbortError' || e?.message === 'Session expired') throw e;
    throw new Error('Cannot connect to server. Please try again.');
  }

  if (!res.ok) {
    let message = res.status === 403 ? FORBIDDEN_MESSAGE : `Request failed (${res.status})`;
    try {
      const data = JSON.parse(await res.text());
      message = data.message || data.error || message;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message);
  }

  if (responseType === 'blob') {
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    return { blob, name };
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Hands a Blob to the browser as a file download.
export function saveBlob({ blob, name }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  auth: {
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
    seedStatus: (opts = {}) => request('/onboarding/seed-status', opts),
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
    disable: (id) => request(`/subscriptions/regulators/${id}/disable`, { method: 'PUT' }),
    bulkDisable: (ids) => request('/subscriptions/regulators/bulk-disable', {
      method: 'PUT', body: JSON.stringify(ids),
    }),
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
    review: (uploadId) => request(`/subscriptions/uploads/${uploadId}/review`),
    confirm: (uploadId, data) => request(`/subscriptions/uploads/${uploadId}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
  },
  instruments: {
    list: (page = 0, size = 20, q = '', opts = {}) => request(`/subscriptions/instruments?page=${page}&size=${size}&q=${encodeURIComponent(q)}`, { signal: opts.signal }),
    get: (id, opts = {}) => request(`/subscriptions/instruments/${id}`, { signal: opts.signal }),
  },
  inbox: {
    list: (page = 0, size = 20) => request(`/obligations/inbox?page=${page}&size=${size}`),
  },
  review: {
    list: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/review${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    stats: (opts = {}) => request('/review/stats', { signal: opts.signal }),
    get: (reviewId, opts = {}) => request(`/review/${reviewId}`, { signal: opts.signal }),
    save: (reviewId, data) => request(`/review/${reviewId}/save`, {
      method: 'POST', body: JSON.stringify(data),
    }),
    skip: (reviewId) => request(`/review/${reviewId}/skip`, { method: 'POST' }),
  },
  obligations: {
    create: (data) => request('/obligations', { method: 'POST', body: JSON.stringify(data) }),
    update: (obligationId, data) => request(`/obligations/obligation/${obligationId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    remove: (obligationId) => request(`/obligations/obligation/${obligationId}`, { method: 'DELETE' }),
    classify: (id, data) => request(`/obligations/${id}/classify`, {
      method: 'POST', body: JSON.stringify(data),
    }),
    register: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/obligations/register${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    stats: (opts = {}) => request('/obligations/stats', { signal: opts.signal }),
    obligationDetail: (obligationId, signal) => request(`/obligations/obligation/${obligationId}`, { signal }),
    linkReturns: (obligationId, linkedReturnIds) => request(`/obligations/obligation/${obligationId}/returns`, {
      method: 'PUT', body: JSON.stringify({ linkedReturnIds }),
    }),
    assignOwner: (obligationId, data) => request(`/obligations/${obligationId}/owner`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    updateRisk: (obligationId, data) => request(`/obligations/${obligationId}/risk`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    updateGap: (obligationId, data) => request(`/obligations/${obligationId}/gap`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    linkControls: (obligationId, data) => request(`/obligations/${obligationId}/controls`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
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
    stats: () => request('/controls/stats'),
    detail: (id) => request(`/controls/${id}/detail`),
    get: (id) => request(`/controls/${id}`),
    create: (data) => request('/controls', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/controls/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    recordTest: (id, data) => request(`/controls/${id}/tests`, { method: 'POST', body: JSON.stringify(data) }),
  },
  returns: {
    list: () => request('/returns/list'),
    calendar: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/returns/calendar${s ? '?' + s : ''}`);
    },
    register: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/returns/register${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    stats: (opts = {}) => request('/returns/stats', { signal: opts.signal }),
    detail: (id) => request(`/returns/instances/${id}/detail`),
    advance: (id, data) => request(`/returns/instances/${id}/advance`, { method: 'PUT', body: JSON.stringify(data) }),
    submit: (id, data) => request(`/returns/instances/${id}/submit`, { method: 'PUT', body: JSON.stringify(data) }),
    create: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),
    linkObligations: (returnId, linkedObligationIds) => request(`/returns/${returnId}/obligations`, {
      method: 'PUT', body: JSON.stringify({ linkedObligationIds }),
    }),
    linkedObligations: (returnId, opts = {}) => request(`/returns/${returnId}/obligations`, { signal: opts.signal }),
    // Set a return's filing schedule (CCO, TENANT_ADMIN). Returns the updated register item.
    updateSchedule: (returnId, body) => request(`/returns/${returnId}/schedule`, {
      method: 'PUT', body: JSON.stringify(body),
    }),
    // One-off return schedule repair (TENANT_ADMIN only): GET is a dry run, POST applies it.
    frequencyRepairPreview: (opts = {}) => request('/returns/frequency-repair', { signal: opts.signal }),
    frequencyRepairApply: () => request('/returns/frequency-repair', { method: 'POST' }),
  },
  sanctions: {
    list: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/sanctions${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    stats: (opts = {}) => request('/sanctions/stats', { signal: opts.signal }),
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
  imports: {
    // Download helpers trigger the browser download and resolve to { blob, name }.
    template: (type, opts = {}) =>
      rawRequest(`/imports/${encodeURIComponent(type)}/template`, {
        responseType: 'blob', fallbackName: `${type}-import-template.xlsx`, signal: opts.signal,
      }).then((file) => { saveBlob(file); return file; }),
    preview: (type, file, opts = {}) => {
      const fd = new FormData();
      fd.append('file', file);
      return rawRequest(`/imports/${encodeURIComponent(type)}/preview`, {
        method: 'POST', body: fd, signal: opts.signal,
      });
    },
    commit: (batchId, opts = {}) =>
      rawRequest(`/imports/batches/${batchId}/commit`, { method: 'POST', signal: opts.signal }),
    errors: (batchId, opts = {}) =>
      rawRequest(`/imports/batches/${batchId}/errors`, {
        responseType: 'blob', fallbackName: `import-errors-${batchId}.xlsx`, signal: opts.signal,
      }).then((file) => { saveBlob(file); return file; }),
    batches: (type, opts = {}) =>
      rawRequest(`/imports/batches?type=${encodeURIComponent(type)}`, { signal: opts.signal }),
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
  notifications: {
    list: (status) => request(`/notifications${status ? `?status=${status}` : ''}`),
    count: () => request('/notifications/count'),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    acknowledge: (id) => request(`/notifications/${id}/acknowledge`, { method: 'PUT' }),
    markAllRead: () => request('/notifications/mark-all-read', { method: 'PUT' }),
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
    trends: () => request('/dashboard/trends'),
    attentionItems: () => request('/dashboard/attention-items'),
    v2: {
      returnsByPeriod: (from, to, opts = {}) => request(`/dashboard/v2/returns-by-period?from=${from}&to=${to}`, { signal: opts.signal }),
      renditionGrid: (from, to, groupBy = 'department', opts = {}) => request(`/dashboard/v2/rendition-grid?from=${from}&to=${to}&groupBy=${groupBy}`, { signal: opts.signal }),
      riskHeatmap: (view = 'inherent', opts = {}) => request(`/dashboard/v2/risk-heatmap?view=${view}`, { signal: opts.signal }),
      escalationMatrix: (opts = {}) => request('/dashboard/v2/escalation-matrix', { signal: opts.signal }),
      controlCoverage: (by = 'areaOfFocus', opts = {}) => request(`/dashboard/v2/control-coverage?by=${by}`, { signal: opts.signal }),
      riskProfile: (opts = {}) => request('/dashboard/v2/risk-profile', { signal: opts.signal }),
      thresholds: (opts = {}) => request('/dashboard/v2/thresholds', { signal: opts.signal }),
      saveThresholds: (data) => request('/dashboard/v2/thresholds', {
        method: 'PUT', body: JSON.stringify(data),
      }),
    },
  },
  settings: {
    polling: () => request('/settings/polling'),
    updatePolling: (data) => request('/settings/polling', {
      method: 'PUT', body: JSON.stringify(data),
    }),
    riskMatrix: () => request('/settings/risk-matrix'),
    updateRiskMatrix: (data) => request('/settings/risk-matrix', {
      method: 'PUT', body: JSON.stringify(data),
    }),
  },
  org: {
    tree: () => request('/org'),
    departments: (activeOnly = false) => request(`/org/departments?activeOnly=${activeOnly}`),
    createDepartment: (data) => request('/org/departments', {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateDepartment: (id, data) => request(`/org/departments/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    deleteDepartment: (id) => request(`/org/departments/${id}`, { method: 'DELETE' }),
    teams: (departmentId) => request(`/org/teams${departmentId ? `?departmentId=${departmentId}` : ''}`),
    createTeam: (data) => request('/org/teams', {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateTeam: (id, data) => request(`/org/teams/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    deleteTeam: (id) => request(`/org/teams/${id}`, { method: 'DELETE' }),
    owners: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/org/owners${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    createOwner: (data) => request('/org/owners', {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateOwner: (id, data) => request(`/org/owners/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    deleteOwner: (id) => request(`/org/owners/${id}`, { method: 'DELETE' }),
  },
  users: {
    me: () => request('/users/me'),
    list: () => request('/users'),
    invite: (data) => request('/users/invite', {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateRole: (id, role) => request(`/users/${id}/role`, {
      method: 'PUT', body: JSON.stringify({ role }),
    }),
    deactivate: (id) => request(`/users/${id}/deactivate`, { method: 'PUT' }),
    reactivate: (id) => request(`/users/${id}/reactivate`, { method: 'PUT' }),
  },
};
