export const API_BASE = '/api/v1';

let authToken = null;
let authRefreshToken = null;

export const setToken = (t) => { authToken = t; };
export const getToken = () => authToken;
export const setRefreshToken = (t) => { authRefreshToken = t; };
export const getRefreshToken = () => authRefreshToken;

// Public remediation endpoints — reached by an owner via a link, with no login/token.
// Kept separate from `api` so it never attaches the Authorization header or triggers
// the 401-refresh/logout path.
export const publicApi = {
  async remediationView(token) {
    const res = await fetch(`${API_BASE}/public/remediation/${encodeURIComponent(token)}`);
    if (!res.ok) {
      let message = 'This remediation link is not valid.';
      try { const d = await res.json(); message = d.message || d.error || message; } catch { /* keep default */ }
      throw new Error(message);
    }
    return res.json();
  },
  async remediationSubmit(token, { notes, files }) {
    const form = new FormData();
    if (notes) form.append('notes', notes);
    (files || []).forEach((f) => form.append('files', f));
    const res = await fetch(`${API_BASE}/public/remediation/${encodeURIComponent(token)}`, {
      method: 'POST', body: form,
    });
    if (!res.ok) {
      let message = 'Submission failed.';
      try { const d = await res.json(); message = d.message || d.error || message; } catch { /* keep default */ }
      throw new Error(message);
    }
    return res.json();
  },
  // Public return event-filing upload — also no login; the token is the credential.
  async returnUploadView(token) {
    const res = await fetch(`${API_BASE}/public/returns/${encodeURIComponent(token)}`);
    if (!res.ok) {
      let message = 'This upload link is not valid.';
      try { const d = await res.json(); message = d.message || d.error || message; } catch { /* keep default */ }
      throw new Error(message);
    }
    return res.json();
  },
  async returnUploadSubmit(token, { triggerDate, reference, dueDate, file }) {
    const form = new FormData();
    if (triggerDate) form.append('triggerDate', triggerDate);
    if (reference) form.append('reference', reference);
    if (dueDate) form.append('dueDate', dueDate);
    if (file) form.append('file', file);
    const res = await fetch(`${API_BASE}/public/returns/${encodeURIComponent(token)}`, {
      method: 'POST', body: form,
    });
    if (!res.ok) {
      let message = 'Submission failed.';
      try { const d = await res.json(); message = d.message || d.error || message; } catch { /* keep default */ }
      throw new Error(message);
    }
    return res.json();
  },
};

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
    // Keep the server's stable error code (e.g. secret_in_command, lint_errors) for callers that branch on it.
    const err = new Error(data.message || data.error || fallback);
    err.status = res.status;
    err.code = data.error;
    throw err;
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

// Builds "?a=1&b=2" from an object, dropping empty values ("" when nothing is left).
function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
  const s = qs.toString();
  return s ? `?${s}` : '';
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
    testLdap: (data) => request('/onboarding/ldap/test-connection', { method: 'POST', body: JSON.stringify(data) }),
    regulators: (data) => request('/onboarding/regulators', { method: 'POST', body: JSON.stringify(data) }),
    toolkitRegulators: (data) => request('/onboarding/toolkit-regulators', { method: 'POST', body: JSON.stringify(data) }),
    ldapUsers: (config, q) => request(`/onboarding/ldap/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      method: 'POST', body: JSON.stringify(config || {}),
    }),
    saveSmtp: (data) => request('/onboarding/smtp', { method: 'POST', body: JSON.stringify(data) }),
    testSmtp: (data) => request('/onboarding/smtp/test', { method: 'POST', body: JSON.stringify(data) }),
    documentTypes: (data) => request('/onboarding/document-types', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (data) => request('/onboarding/confirm', { method: 'POST', body: JSON.stringify(data) }),
    seedStatus: (opts = {}) => request('/onboarding/seed-status', opts),
  },
  regulators: {
    list: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/subscriptions/regulators${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    stats: (opts = {}) => request('/subscriptions/regulators/stats', { signal: opts.signal }),
    get: (id, opts = {}) => request(`/subscriptions/regulators/${id}`, { signal: opts.signal }),
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
    universeStats: (opts = {}) => request('/subscriptions/instruments/universe-stats', { signal: opts.signal }),
    universe: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      return request(`/subscriptions/instruments/universe?${qs.toString()}`, { signal: opts.signal });
    },
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
    linkControls: (obligationId, data) => request(`/obligations/${obligationId}/controls`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    linkSanctions: (obligationId, linkedSanctionIds) => request(`/obligations/${obligationId}/sanctions`, {
      method: 'PUT', body: JSON.stringify({ linkedSanctionIds }),
    }),
    detail: (id) => request(`/obligations/${id}/detail`),
    history: (id) => request(`/obligations/${id}/history`),
    riskTypes: () => request('/obligations/risk-types'),
  },
  acts: {
    list: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/acts${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    stats: (opts = {}) => request('/acts/stats', { signal: opts.signal }),
    detail: (id, opts = {}) => request(`/acts/${id}`, { signal: opts.signal }),
  },
  findings: {
    register: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/findings/register${s ? '?' + s : ''}`);
    },
    detail: (id) => request(`/findings/${id}/detail`),
    stats: (opts = {}) => request('/findings/stats', { signal: opts.signal }),
    raise: (data) => request('/findings', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id, data) => request(`/findings/${id}/assign`, { method: 'PUT', body: JSON.stringify(data) }),
    remediate: (id, formData) => rawRequest(`/findings/${id}/remediate`, { method: 'PUT', body: formData }),
    review: (id, decision, notes) => {
      const qs = new URLSearchParams({ decision });
      if (notes) qs.set('notes', notes);
      return request(`/findings/${id}/review?${qs.toString()}`, { method: 'PUT' });
    },
    remediationLink: (id) => request(`/findings/${id}/remediation-link`, { method: 'POST' }),
    linkControl: (id, controlId) => request(`/findings/${id}/link-control?controlId=${controlId}`, { method: 'PUT' }),
    closeGap: (id) => request(`/findings/${id}/close-gap`, { method: 'PUT' }),
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
    tests: (id, opts = {}) => request(`/controls/${id}/tests`, { signal: opts.signal }),
    reviewTest: (id, testId, decision, notes) => request(`/controls/${id}/tests/${testId}/review`, {
      method: 'PUT', body: JSON.stringify({ decision, notes }),
    }),
    tasks: (id, opts = {}) => request(`/controls/${id}/tasks`, { signal: opts.signal }),
    pendingReviewTests: (opts = {}) => request('/tests/pending-review', { signal: opts.signal }),
  },
  tasks: {
    mine: (opts = {}) => request('/tasks', { signal: opts.signal }),
    overdue: (opts = {}) => request('/tasks/overdue', { signal: opts.signal }),
    center: (params = {}, opts = {}) => request(`/tasks/center${toQuery(params)}`, { signal: opts.signal }),
    centerStats: (params = {}, opts = {}) => request(`/tasks/center/stats${toQuery(params)}`, { signal: opts.signal }),
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
    // One return's register row by id (the returns details page).
    get: (returnId, opts = {}) => request(`/returns/${returnId}`, { signal: opts.signal }),
    detail: (id, opts = {}) => request(`/returns/instances/${id}/detail`, { signal: opts.signal }),
    advance: (id, data) => request(`/returns/instances/${id}/advance`, { method: 'PUT', body: JSON.stringify(data) }),
    submit: (id, data) => request(`/returns/instances/${id}/submit`, { method: 'PUT', body: JSON.stringify(data) }),
    create: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),
    // Delete a return and its undisturbed periods/links (CCO, TENANT_ADMIN). 409 if a period has work.
    remove: (returnId) => request(`/returns/${returnId}`, { method: 'DELETE' }),
    linkObligations: (returnId, linkedObligationIds) => request(`/returns/${returnId}/obligations`, {
      method: 'PUT', body: JSON.stringify({ linkedObligationIds }),
    }),
    linkedObligations: (returnId, opts = {}) => request(`/returns/${returnId}/obligations`, { signal: opts.signal }),
    // Set a return's filing schedule (CCO, TENANT_ADMIN). Returns the updated register item.
    updateSchedule: (returnId, body) => request(`/returns/${returnId}/schedule`, {
      method: 'PUT', body: JSON.stringify(body),
    }),
    updateEscalationPolicy: (returnId, escalationPolicyId) => request(`/returns/${returnId}/escalation-policy`, {
      method: 'PUT', body: JSON.stringify({ escalationPolicyId }),
    }),
    // Edit responsible person(s) + owner (analyst, CC'd on reminders).
    update: (returnId, body) => request(`/returns/${returnId}`, { method: 'PUT', body: JSON.stringify(body) }),
    // Set the return's escalation contact + reminder cadence (per-return policy).
    updateEscalation: (returnId, body) => request(`/returns/${returnId}/escalation`, {
      method: 'PUT', body: JSON.stringify(body),
    }),
    configureEventTrigger: (returnId, body, opts = {}) => request(`/returns/${returnId}/event-trigger`, {
      signal: opts.signal,
      method: 'PUT', body: JSON.stringify(body),
    }),
    recordEvent: (returnId, body, opts = {}) => request(`/returns/${returnId}/events`, {
      signal: opts.signal,
      method: 'POST', body: JSON.stringify(body),
    }),
    recordEventWithEvidence: (returnId, formData, opts = {}) => rawRequest(`/returns/${returnId}/events/upload`, {
      method: 'POST', body: formData, signal: opts.signal,
    }),
    eventFilings: (returnId, opts = {}) => request(`/returns/${returnId}/events`, { signal: opts.signal }),
    // One-off return schedule repair (TENANT_ADMIN only): GET is a dry run, POST applies it.
    frequencyRepairPreview: (opts = {}) => request('/returns/frequency-repair', { signal: opts.signal }),
    frequencyRepairApply: () => request('/returns/frequency-repair', { method: 'POST' }),
    // Create (and email) a public, account-less event-filing upload link for an event-driven return.
    createUploadLink: (returnId, body = {}) => request(`/returns/${returnId}/upload-link`, {
      method: 'POST', body: JSON.stringify(body),
    }),
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
    bySource: (sourceType, sourceId, opts = {}) =>
      request(`/evidence/by-source?sourceType=${encodeURIComponent(sourceType)}&sourceId=${sourceId}`, { signal: opts.signal }),
    detail: (id, opts = {}) => request(`/evidence/${id}`, { signal: opts.signal }),
    upload: (formData, opts = {}) => rawRequest('/evidence/upload', {
      method: 'POST', body: formData, signal: opts.signal,
    }),
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
  reports: {
    list: (params = {}, opts = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      return request(`/reports/board-packs${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    get: (id, opts = {}) => request(`/reports/board-packs/${id}`, { signal: opts.signal }),
    preview: (from, to, sections, opts = {}) => {
      const qs = new URLSearchParams({ from, to });
      (sections || []).forEach(s => qs.append('sections', s));
      return request(`/reports/board-packs/preview?${qs.toString()}`, { signal: opts.signal });
    },
    generate: (data) => request('/reports/board-packs', { method: 'POST', body: JSON.stringify(data) }),
    signOff: (id, note) => request(`/reports/board-packs/${id}/sign-off`, {
      method: 'POST', body: JSON.stringify({ note }),
    }),
    download: (id, opts = {}) => rawRequest(`/reports/board-packs/${id}/download`, {
      responseType: 'blob', fallbackName: 'board-pack.pdf', signal: opts.signal,
    }).then((file) => { saveBlob(file); return file; }),
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
    trends: () => request('/dashboard/trends'),
    attentionItems: () => request('/dashboard/attention-items'),
    metrics: (from, to, opts = {}) => {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const s = qs.toString();
      return request(`/dashboard/metrics${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    refresh: () => request('/dashboard/refresh', { method: 'POST' }),
    scoreWeights: (opts = {}) => request('/dashboard/score-weights', { signal: opts.signal }),
    saveScoreWeights: (data) => request('/dashboard/score-weights', {
      method: 'PUT', body: JSON.stringify(data),
    }),
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
  escalation: {
    policies: (subjectType) => request(`/escalation/policies${subjectType ? `?subjectType=${subjectType}` : ''}`),
    policy: (id) => request(`/escalation/policies/${id}`),
    createPolicy: (data) => request('/escalation/policies', { method: 'POST', body: JSON.stringify(data) }),
    updatePolicy: (id, data) => request(`/escalation/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePolicy: (id) => request(`/escalation/policies/${id}`, { method: 'DELETE' }),
    instance: (subjectType, subjectId) => request(`/escalation/instances/${subjectType}/${subjectId}`),
    saveInstance: (subjectType, subjectId, data) => request(`/escalation/instances/${subjectType}/${subjectId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    deleteInstance: (subjectType, subjectId) => request(`/escalation/instances/${subjectType}/${subjectId}`, {
      method: 'DELETE',
    }),
    reapply: (subjectType, subjectId, policyId) => request(
      `/escalation/instances/${subjectType}/${subjectId}/reapply?policyId=${policyId}`, { method: 'POST' }),
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
    smtp: () => request('/settings/smtp'),
    saveSmtp: (data) => request('/settings/smtp', { method: 'PUT', body: JSON.stringify(data) }),
    testSmtp: (data) => request('/settings/smtp/test', { method: 'POST', body: JSON.stringify(data) }),
    notificationTemplates: (opts = {}) => request('/settings/notification-templates', { signal: opts.signal }),
    notificationTemplate: (key) => request(`/settings/notification-templates/${key}`),
    updateNotificationTemplate: (key, data) => request(`/settings/notification-templates/${key}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  },
  federalPublicHolidays: {
    list: (year, opts = {}) => {
      const qs = new URLSearchParams();
      if (year && year !== 'All') qs.set('year', year);
      const s = qs.toString();
      return request(`/federal-public-holidays${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    create: (data) => request('/federal-public-holidays', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/federal-public-holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/federal-public-holidays/${id}`, { method: 'DELETE' }),
  },
  federalPublicHolidays: {
    list: (year, opts = {}) => {
      const qs = new URLSearchParams();
      if (year && year !== 'All') qs.set('year', year);
      const s = qs.toString();
      return request(`/federal-public-holidays${s ? '?' + s : ''}`, { signal: opts.signal });
    },
    create: (data) => request('/federal-public-holidays', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/federal-public-holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/federal-public-holidays/${id}`, { method: 'DELETE' }),
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
  // Compliance Runbooks — contract: runbook library, versions, executions, templates, coverage.
  // Every read takes { signal } so TanStack Query can cancel it.
  runbooks: {
    list: (params = {}, opts = {}) => request(`/runbooks${toQuery(params)}`, { signal: opts.signal }),
    stats: (opts = {}) => request('/runbooks/stats', { signal: opts.signal }),
    dashboard: (opts = {}) => request('/runbooks/dashboard', { signal: opts.signal }),
    // Active users any runbook role may pick as owner / operator / assignee (GET /users is admin-only).
    assignees: (opts = {}) => request('/runbooks/assignees', { signal: opts.signal }),
    templateRevision: (id) => request(`/runbooks/${id}/template-revision`, { method: 'POST' }),
    get: (id, opts = {}) => request(`/runbooks/${id}`, { signal: opts.signal }),
    create: (data) => request('/runbooks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/runbooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/runbooks/${id}`, { method: 'DELETE' }),
    clone: (id, data) => request(`/runbooks/${id}/clone`, { method: 'POST', body: JSON.stringify(data) }),
    deprecate: (id, reason) => request(`/runbooks/${id}/deprecate`, { method: 'POST', body: JSON.stringify({ reason }) }),
    archive: (id, reason) => request(`/runbooks/${id}/archive`, { method: 'POST', body: JSON.stringify({ reason }) }),
    setClauses: (id, clauseIds) => request(`/runbooks/${id}/clauses`, { method: 'PUT', body: JSON.stringify({ clauseIds }) }),
    setLinks: (id, data) => request(`/runbooks/${id}/links`, { method: 'PUT', body: JSON.stringify(data) }),
    exportJson: (id) => rawRequest(`/runbooks/${id}/export?format=json`, {
      responseType: 'blob', fallbackName: `runbook-${id}.json`,
    }).then((file) => { saveBlob(file); return file; }),
    importJson: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return rawRequest('/runbooks/import', { method: 'POST', body: fd });
    },
    versions: {
      list: (id, opts = {}) => request(`/runbooks/${id}/versions`, { signal: opts.signal }),
      createDraft: (id) => request(`/runbooks/${id}/versions`, { method: 'POST' }),
      get: (id, vid, opts = {}) => request(`/runbooks/${id}/versions/${vid}`, { signal: opts.signal }),
      save: (id, vid, tree) => request(`/runbooks/${id}/versions/${vid}`, { method: 'PUT', body: JSON.stringify(tree) }),
      lint: (id, vid) => request(`/runbooks/${id}/versions/${vid}/lint`, { method: 'POST' }),
      diff: (id, vid, otherVid, opts = {}) => request(`/runbooks/${id}/versions/${vid}/diff/${otherVid}`, { signal: opts.signal }),
      submit: (id, vid) => request(`/runbooks/${id}/versions/${vid}/submit`, { method: 'POST' }),
      approve: (id, vid, data) => request(`/runbooks/${id}/versions/${vid}/approve`, { method: 'POST', body: JSON.stringify(data) }),
      reject: (id, vid, data) => request(`/runbooks/${id}/versions/${vid}/reject`, { method: 'POST', body: JSON.stringify(data) }),
      publish: (id, vid, data) => request(`/runbooks/${id}/versions/${vid}/publish`, { method: 'POST', body: JSON.stringify(data) }),
    },
    approvalsPending: (opts = {}) => request('/runbooks/approvals/pending', { signal: opts.signal }),
    schedules: {
      list: (id, opts = {}) => request(`/runbooks/${id}/schedules`, { signal: opts.signal }),
      create: (id, data) => request(`/runbooks/${id}/schedules`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id, sid, data) => request(`/runbooks/${id}/schedules/${sid}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id, sid) => request(`/runbooks/${id}/schedules/${sid}`, { method: 'DELETE' }),
    },
    frameworks: {
      list: (opts = {}) => request('/runbooks/frameworks', { signal: opts.signal }),
      clauses: (frameworkId, params = {}, opts = {}) =>
        request(`/runbooks/frameworks/${frameworkId}/clauses${toQuery(params)}`, { signal: opts.signal }),
      searchClauses: (params = {}, opts = {}) => request(`/runbooks/clauses${toQuery(params)}`, { signal: opts.signal }),
      create: (data) => request('/runbooks/frameworks', { method: 'POST', body: JSON.stringify(data) }),
      addClause: (frameworkId, data) => request(`/runbooks/frameworks/${frameworkId}/clauses`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    },
    executions: {
      list: (params = {}, opts = {}) => request(`/runbooks/executions${toQuery(params)}`, { signal: opts.signal }),
      stats: (opts = {}) => request('/runbooks/executions/stats', { signal: opts.signal }),
      start: (runbookId, data) => request(`/runbooks/${runbookId}/executions`, { method: 'POST', body: JSON.stringify(data) }),
      get: (execId, opts = {}) => request(`/runbooks/executions/${execId}`, { signal: opts.signal }),
      preflight: (execId, prereqAcks) => request(`/runbooks/executions/${execId}/preflight`, {
        method: 'POST', body: JSON.stringify({ prereqAcks }),
      }),
      startStep: (execId, stepExecId) => request(`/runbooks/executions/${execId}/steps/${stepExecId}/start`, { method: 'POST' }),
      passStep: (execId, stepExecId, data) => request(`/runbooks/executions/${execId}/steps/${stepExecId}/pass`, {
        method: 'POST', body: JSON.stringify(data),
      }),
      failStep: (execId, stepExecId, data) => request(`/runbooks/executions/${execId}/steps/${stepExecId}/fail`, {
        method: 'POST', body: JSON.stringify(data),
      }),
      skipStep: (execId, stepExecId, data) => request(`/runbooks/executions/${execId}/steps/${stepExecId}/skip`, {
        method: 'POST', body: JSON.stringify(data),
      }),
      verifyStep: (execId, stepExecId, password) => request(`/runbooks/executions/${execId}/steps/${stepExecId}/verify`, {
        method: 'POST', body: JSON.stringify({ password }),
      }),
      // fields: { file?, reqId?, evidenceType?, externalRef?, attestationText?, pastedOutput? } — exactly one payload.
      captureEvidence: (execId, stepExecId, fields) => {
        const fd = new FormData();
        Object.entries(fields || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, v); });
        return rawRequest(`/runbooks/executions/${execId}/steps/${stepExecId}/evidence`, { method: 'POST', body: fd });
      },
      stepEvidence: (execId, stepExecId, opts = {}) =>
        request(`/runbooks/executions/${execId}/steps/${stepExecId}/evidence`, { signal: opts.signal }),
      downloadEvidence: (execId, evidenceId) => rawRequest(`/runbooks/executions/${execId}/evidence/${evidenceId}/download`, {
        responseType: 'blob', fallbackName: `evidence-${evidenceId}.bin`,
      }).then((file) => { saveBlob(file); return file; }),
      pause: (execId, reason) => request(`/runbooks/executions/${execId}/pause`, { method: 'POST', body: JSON.stringify({ reason }) }),
      resume: (execId) => request(`/runbooks/executions/${execId}/resume`, { method: 'POST' }),
      abort: (execId, reason) => request(`/runbooks/executions/${execId}/abort`, { method: 'POST', body: JSON.stringify({ reason }) }),
      escalate: (execId, data) => request(`/runbooks/executions/${execId}/escalate`, { method: 'POST', body: JSON.stringify(data) }),
      ackEscalation: (execId, escId) => request(`/runbooks/executions/${execId}/escalations/${escId}/ack`, { method: 'POST' }),
      rollback: (execId, reason) => request(`/runbooks/executions/${execId}/rollback`, { method: 'POST', body: JSON.stringify({ reason }) }),
      signoff: (execId, data) => request(`/runbooks/executions/${execId}/signoff`, { method: 'POST', body: JSON.stringify(data) }),
      generatePack: (execId, data) => request(`/runbooks/executions/${execId}/pack`, { method: 'POST', body: JSON.stringify(data || {}) }),
      downloadPack: (execId) => rawRequest(`/runbooks/executions/${execId}/pack`, {
        responseType: 'blob', fallbackName: `evidence-pack-${execId}.zip`,
      }).then((file) => { saveBlob(file); return file; }),
      timeline: (execId, opts = {}) => request(`/runbooks/executions/${execId}/timeline`, { signal: opts.signal }),
    },
    templates: {
      list: (opts = {}) => request('/runbooks/templates', { signal: opts.signal }),
      get: (code, opts = {}) => request(`/runbooks/templates/${encodeURIComponent(code)}`, { signal: opts.signal }),
      adopt: (code, data) => request(`/runbooks/templates/${encodeURIComponent(code)}/adopt`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    },
    coverage: (params = {}, opts = {}) => request(`/runbooks/coverage${toQuery(params)}`, { signal: opts.signal }),
  },
  users: {
    me: () => request('/users/me'),
    list: (q) => request(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    invite: (data) => request('/users/invite', {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateRole: (id, role) => request(`/users/${id}/role`, {
      method: 'PUT', body: JSON.stringify({ role }),
    }),
    deactivate: (id) => request(`/users/${id}/deactivate`, { method: 'PUT' }),
    reactivate: (id) => request(`/users/${id}/reactivate`, { method: 'PUT' }),
    updateManager: (id, managerUserId) => request(`/users/${id}/manager`, {
      method: 'PUT', body: JSON.stringify({ managerUserId }),
    }),
  },
  ldap: {
    // Directory search for the person picker. Returns { enabled, users:[{email, fullName}] }.
    users: (q, opts = {}) => request(`/ldap/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal: opts.signal }),
  },
};
