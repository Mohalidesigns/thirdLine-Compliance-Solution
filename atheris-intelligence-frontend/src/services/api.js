export const API_BASE = 'http://localhost:9090/api/v1';
const DEMO_TOKEN = 'demo-jwt-token';

let authToken = null;
let authRefreshToken = null;
let refreshInProgress = null;

export const setToken = (token) => { authToken = token; };
export const getToken = () => authToken;
export const setRefreshToken = (token) => { authRefreshToken = token; };

const STORAGE_KEY_TOKEN = 'atheris_token';
const STORAGE_KEY_REFRESH = 'atheris_refresh_token';

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
  } catch {}
}

const DEMO_INBOX = [
  { instrumentId: 1, sourceTitle: 'CBN Guidelines on Sustainable Banking Principles for Financial Institutions in Nigeria', regulatorAbbreviation: 'CBN', applicabilityConfidence: 0.87, riskRating: 'High', discoveredAt: '2026-06-20T08:30:00Z', tenantClassification: 'unclassified', areaOfFocus: 'Sustainable Finance', nature: 'Guidelines' },
  { instrumentId: 2, sourceTitle: 'NAICOM Revised Framework for Risk-Based Supervision of Insurance Companies', regulatorAbbreviation: 'NAICOM', applicabilityConfidence: 0.92, riskRating: 'Medium', discoveredAt: '2026-06-19T14:15:00Z', tenantClassification: 'unclassified', areaOfFocus: 'Risk Management', nature: 'Framework' },
  { instrumentId: 3, sourceTitle: 'SEC Nigeria New Rules on Digital Assets Issuance, Offering Platforms and Custody', regulatorAbbreviation: 'SEC', applicabilityConfidence: 0.78, riskRating: 'High', discoveredAt: '2026-06-18T11:00:00Z', tenantClassification: 'unclassified', areaOfFocus: 'Digital Assets', nature: 'Rules' },
  { instrumentId: 4, sourceTitle: 'FIRS Regulations on Transfer Pricing Documentation and Country-by-Country Reporting', regulatorAbbreviation: 'FIRS', applicabilityConfidence: 0.95, riskRating: 'Medium', discoveredAt: '2026-06-17T09:45:00Z', tenantClassification: 'applicable', areaOfFocus: 'Tax Compliance', nature: 'Regulations' },
  { instrumentId: 5, sourceTitle: 'NCC Mandatory Code of Practice for Interactive Computer Service Platforms', regulatorAbbreviation: 'NCC', applicabilityConfidence: 0.71, riskRating: 'Low', discoveredAt: '2026-06-16T16:30:00Z', tenantClassification: 'unclassified', areaOfFocus: 'Data Protection', nature: 'Code of Practice' },
];

const DEMI_OBLIGATIONS = [
  { instrumentId: 6, sourceTitle: 'CBN Anti-Money Laundering and Counter-Financing of Terrorism Regulations', regulatorAbbreviation: 'CBN', areaOfFocus: 'AML/CFT', riskRating: 'High', dateIssued: '2026-04-15T00:00:00Z', dateCommencement: '2026-07-01T00:00:00Z', discoveredAt: '2026-06-01T10:00:00Z', isWatching: true },
  { instrumentId: 7, sourceTitle: 'NAICOM Circular on Cyber Insurance Requirements for Regulated Entities', regulatorAbbreviation: 'NAICOM', areaOfFocus: 'Cyber Insurance', riskRating: 'Medium', dateIssued: '2026-03-20T00:00:00Z', dateCommencement: '2026-06-15T00:00:00Z', discoveredAt: '2026-05-28T08:00:00Z', isWatching: false },
  { instrumentId: 8, sourceTitle: 'SEC Nigeria Amended Rules on Public Offer of Securities', regulatorAbbreviation: 'SEC', areaOfFocus: 'Capital Markets', riskRating: 'Medium', dateIssued: '2026-02-10T00:00:00Z', dateCommencement: '2026-05-01T00:00:00Z', discoveredAt: '2026-05-15T14:00:00Z', isWatching: true },
  { instrumentId: 9, sourceTitle: 'FIRS Guidelines on VAT Compliance for Digital Service Providers', regulatorAbbreviation: 'FIRS', areaOfFocus: 'Digital Taxation', riskRating: 'Low', dateIssued: '2026-05-01T00:00:00Z', dateCommencement: '2026-08-01T00:00:00Z', discoveredAt: '2026-06-10T09:00:00Z', isWatching: false },
  { instrumentId: 10, sourceTitle: 'NCC Spectrum Trading and Assignment Guidelines', regulatorAbbreviation: 'NCC', areaOfFocus: 'Telecommunications', riskRating: 'Low', dateIssued: '2026-01-15T00:00:00Z', dateCommencement: '2026-04-01T00:00:00Z', discoveredAt: '2026-04-20T11:00:00Z', isWatching: false },
  { instrumentId: 11, sourceTitle: 'CBN Framework for the Regulation and Supervision of Payment Service Banks', regulatorAbbreviation: 'CBN', areaOfFocus: 'Digital Banking', riskRating: 'Medium', dateIssued: '2026-03-01T00:00:00Z', dateCommencement: '2026-06-01T00:00:00Z', discoveredAt: '2026-05-05T07:30:00Z', isWatching: true },
  { instrumentId: 12, sourceTitle: 'NAICOM Market Conduct and Fair Treatment Guidelines', regulatorAbbreviation: 'NAICOM', areaOfFocus: 'Consumer Protection', riskRating: 'Low', dateIssued: '2025-12-10T00:00:00Z', dateCommencement: '2026-03-15T00:00:00Z', discoveredAt: '2026-03-01T13:00:00Z', isWatching: false },
];

const DEMO_WATCHES = DEMI_OBLIGATIONS.filter(o => o.isWatching);

const DEMO_LICENSES = [
  { id: 1, tenantId: 1, legalName: 'First Bank of Nigeria Plc', licenseKey: 'ATH-A1B2-C3D4-E5F6-G7H8', tier: 'custom', intelligenceEnabled: true, maxUsers: 50, maxDevices: 5, maxRegulators: 10, maxControls: 100, maxReturns: 50, maxStorageMb: 1024, deviceFingerprintEnforced: true, status: 'active', activatedAt: '2026-01-15T00:00:00Z', expiresAt: '2027-01-15T00:00:00Z', gracePeriodDays: 7, gracePeriodEnd: '2027-01-22T00:00:00Z', issuedBy: 'Ada', notes: 'Enterprise license', deviceCount: 2, devices: [
    { id: 1, deviceFingerprint: 'fp_firstbank_001', deviceLabel: 'Server-01', lastSeenAt: '2026-06-21T10:00:00Z', lastIpAddress: '10.0.1.1', createdAt: '2026-01-15T00:00:00Z' },
    { id: 2, deviceFingerprint: 'fp_firstbank_002', deviceLabel: 'Server-02', lastSeenAt: '2026-06-20T08:00:00Z', lastIpAddress: '10.0.1.2', createdAt: '2026-02-01T00:00:00Z' },
  ], createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-06-15T00:00:00Z' },
  { id: 2, tenantId: 2, legalName: 'Zenith Bank Plc', licenseKey: 'ATH-Z1Y2-X3W4-V5U6-T7S8', tier: 'custom', intelligenceEnabled: true, maxUsers: 25, maxDevices: 3, maxRegulators: 5, maxControls: 50, maxReturns: 25, maxStorageMb: 512, deviceFingerprintEnforced: true, status: 'active', activatedAt: '2026-02-01T00:00:00Z', expiresAt: '2027-02-01T00:00:00Z', gracePeriodDays: 7, gracePeriodEnd: '2027-02-08T00:00:00Z', issuedBy: 'Ada', notes: null, deviceCount: 1, devices: [
    { id: 3, deviceFingerprint: 'fp_zenith_001', deviceLabel: 'Primary Server', lastSeenAt: '2026-06-19T12:00:00Z', lastIpAddress: '10.0.2.1', createdAt: '2026-02-01T00:00:00Z' },
  ], createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
  { id: 3, tenantId: 4, legalName: 'Leadway Assurance Company Ltd', licenseKey: 'ATH-L8K9-J0H1-G2F3-D4E5', tier: 'custom', intelligenceEnabled: false, maxUsers: 10, maxDevices: 2, maxRegulators: 3, maxControls: 20, maxReturns: 10, maxStorageMb: 256, deviceFingerprintEnforced: false, status: 'active', activatedAt: '2026-04-05T00:00:00Z', expiresAt: '2027-04-05T00:00:00Z', gracePeriodDays: 7, gracePeriodEnd: '2027-04-12T00:00:00Z', issuedBy: 'Ada', notes: 'Insurance tier', deviceCount: 0, devices: [], createdAt: '2026-04-05T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' },
  { id: 4, tenantId: 5, legalName: 'MTN Nigeria Communications Plc', licenseKey: 'ATH-M6N7-B8V9-C0X1-Z2A3', tier: 'custom', intelligenceEnabled: true, maxUsers: 100, maxDevices: 10, maxRegulators: 5, maxControls: 200, maxReturns: 100, maxStorageMb: 2048, deviceFingerprintEnforced: true, status: 'expired', activatedAt: '2025-05-20T00:00:00Z', expiresAt: '2026-05-20T00:00:00Z', gracePeriodDays: 7, gracePeriodEnd: '2026-05-27T00:00:00Z', issuedBy: 'Ada', notes: 'Expired - needs renewal', deviceCount: 3, devices: [
    { id: 4, deviceFingerprint: 'fp_mtn_001', deviceLabel: 'API Server', lastSeenAt: '2026-05-19T10:00:00Z', lastIpAddress: '10.0.5.1', createdAt: '2025-05-20T00:00:00Z' },
    { id: 5, deviceFingerprint: 'fp_mtn_002', deviceLabel: 'Backup Server', lastSeenAt: '2026-05-18T14:00:00Z', lastIpAddress: '10.0.5.2', createdAt: '2025-06-01T00:00:00Z' },
    { id: 6, deviceFingerprint: 'fp_mtn_003', deviceLabel: 'Worker Node', lastSeenAt: '2026-05-17T08:00:00Z', lastIpAddress: '10.0.5.3', createdAt: '2025-07-01T00:00:00Z' },
  ], createdAt: '2025-05-20T00:00:00Z', updatedAt: '2026-05-20T00:00:00Z' },
  { id: 5, tenantId: 1, legalName: 'First Bank of Nigeria Plc', licenseKey: 'ATH-Q4R5-S6T7-U8V9-W0X1', tier: 'custom', intelligenceEnabled: true, maxUsers: 50, maxDevices: 5, maxRegulators: 10, maxControls: 100, maxReturns: 50, maxStorageMb: 1024, deviceFingerprintEnforced: true, status: 'revoked', activatedAt: '2025-01-01T00:00:00Z', expiresAt: '2026-01-01T00:00:00Z', gracePeriodDays: 7, gracePeriodEnd: '2026-01-08T00:00:00Z', issuedBy: 'Ada', notes: 'Replaced by new license', deviceCount: 0, devices: [], createdAt: '2025-01-01T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z' },
];

function demoRequest(path, options = {}) {
  if (authToken !== DEMO_TOKEN) return null;

  if (path.startsWith('/intelligence/inbox')) {
    const status = new URLSearchParams(path.split('?')[1] || '').get('status');
    let items = DEMO_INBOX;
    if (status) items = items.filter(i => i.tenantClassification === status);
    return { content: items, totalElements: items.length, totalPages: 1, size: 50, number: 0 };
  }
  if (path.startsWith('/intelligence/obligations')) {
    const qs = new URLSearchParams(path.split('?')[1] || '');
    let items = DEMI_OBLIGATIONS;
    if (qs.get('riskRating') && qs.get('riskRating') !== 'all') items = items.filter(i => i.riskRating === qs.get('riskRating'));
    if (qs.get('q')) {
      const q = qs.get('q').toLowerCase();
      items = items.filter(i => i.sourceTitle.toLowerCase().includes(q));
    }
    return { content: items, totalElements: items.length, totalPages: 1, size: 50, number: 0 };
  }
  if (path.startsWith('/intelligence/watches')) {
    return { content: DEMO_WATCHES };
  }
  if (path.startsWith('/admin/pending-downloads/stats')) {
    return { pending: 3, uploaded: 0, skipped: 1 };
  }
  if (path.startsWith('/admin/pending-downloads')) {
    return [
      { id: 1, title: 'CBN Circular on Foreign Exchange Limits', sourceUrl: 'https://www.cbn.gov.ng/out/2026/circular.pdf', regulatorId: 1, regulatorName: 'CBN', errorMessage: 'Cloudflare challenge failed', status: 'pending', createdAt: '2026-06-21T10:00:00Z' },
      { id: 2, title: 'SEC Rules Update March 2026', sourceUrl: 'https://www.sec.gov.ng/out/rules.pdf', regulatorId: 2, regulatorName: 'SEC', errorMessage: 'Download timed out', status: 'pending', createdAt: '2026-06-20T14:30:00Z' },
      { id: 3, title: 'NAICOM Solvency Directive Q2 2026', sourceUrl: 'https://www.naicom.gov.ng/directives/solvency.pdf', regulatorId: 3, regulatorName: 'NAICOM', errorMessage: '403 Forbidden', status: 'pending', createdAt: '2026-06-19T08:15:00Z' },
    ];
  }
  if (path.startsWith('/admin/jobs/stats')) {
    return { OCR_QUEUE: 12, AWAITING_CLASSIFY: 8, CLASSIFIED: 145, FAILED_STUCK: 3 };
  }
  if (path.endsWith('/pdf')) return 'https://placeholder-atheris-pdf.s3.af-south-1.amazonaws.com/sample.pdf';
  if (path.startsWith('/admin/jobs')) {
    return {
      content: [
        { id: 101, jobType: 'ocr_document', status: 'pending', title: 'CBN FX Circular May 2026', regulator: 'CBN', createdAt: '2026-06-21T12:00:00Z', updatedAt: null, retryCount: 0 },
        { id: 102, jobType: 'classify_instrument', status: 'pending', title: 'SEC Digital Assets Framework', regulator: 'SEC', createdAt: '2026-06-21T11:30:00Z', updatedAt: null, retryCount: 0 },
        { id: 103, jobType: 'ocr_document', status: 'processing', title: 'NAICOM Cyber Insurance Requirements', regulator: 'NAICOM', createdAt: '2026-06-21T10:00:00Z', updatedAt: null, retryCount: 0 },
        { id: 104, jobType: 'classify_instrument', status: 'processing', title: 'FIRS Transfer Pricing Guidelines', regulator: 'FIRS', createdAt: '2026-06-21T09:00:00Z', updatedAt: null, retryCount: 0 },
        { id: 105, jobType: 'send_webhooks', status: 'completed', title: 'CBN AML/CFT Regulations', regulator: 'CBN', createdAt: '2026-06-20T16:00:00Z', updatedAt: '2026-06-20T16:05:00Z', retryCount: 0 },
        { id: 106, jobType: 'evaluate_applicability', status: 'completed', title: 'NCC Code of Practice', regulator: 'NCC', createdAt: '2026-06-20T14:00:00Z', updatedAt: '2026-06-20T14:02:00Z', retryCount: 0 },
        { id: 107, jobType: 'ocr_document', status: 'failed', title: 'CBN Circular on FOREX', regulator: 'CBN', createdAt: '2026-06-19T08:00:00Z', updatedAt: '2026-06-19T08:05:00Z', retryCount: 3 },
        { id: 108, jobType: 'classify_instrument', status: 'failed', title: 'SEC Rules Update March', regulator: 'SEC', createdAt: '2026-06-19T07:00:00Z', updatedAt: '2026-06-19T07:03:00Z', retryCount: 2 },
      ],
      totalElements: 8, totalPages: 1, size: 15, number: 0,
    };
  }
  if (path.startsWith('/platform/regulators') && path.includes('pipeline-stats')) {
    const id = parseInt(path.split('/')[4]);
    return {
      discoveredCount: 57, downloadedCount: 45, extractedCount: 38, classifiedCount: 42,
      uploadedCount: id === 1 ? 2 : 0,
      failedDownloads: id === 1 ? [
        { id: 1, title: 'CBN Circular on Foreign Exchange Limits', sourceUrl: 'https://www.cbn.gov.ng/out/2026/fx-circular.pdf', errorMessage: 'Download timed out', discoveredAt: '2026-06-21T10:00:00Z' },
        { id: 2, title: 'CBN Guidelines on Open Banking Operations', sourceUrl: 'https://www.cbn.gov.ng/out/open-banking.pdf', errorMessage: '403 Forbidden', discoveredAt: '2026-06-20T14:30:00Z' },
      ] : id === 3 ? [
        { id: 3, title: 'NAICOM Risk-Based Capital Framework Q2', sourceUrl: 'https://www.naicom.gov.ng/rbc-q2.pdf', errorMessage: 'Cloudflare challenge failed', discoveredAt: '2026-06-19T08:15:00Z' },
      ] : [],
      uploadedDocuments: id === 1 ? [
        { id: 10, title: 'CBN Circular on FOREX 2026', sourceUrl: 'https://www.cbn.gov.ng/out/forex-2026.pdf', discoveredAt: '2026-06-18T10:00:00Z', jobStatus: 'processing' },
        { id: 11, title: 'CBN AML/CFT Requirements', sourceUrl: 'https://www.cbn.gov.ng/out/aml-cft.pdf', discoveredAt: '2026-06-17T14:00:00Z', jobStatus: 'completed' },
      ] : [],
      downloadedDocuments: [
        { instrumentId: 1, sourceTitle: 'CBN AML/CFT Regulations 2026' },
        { instrumentId: 2, sourceTitle: 'CBN Guidelines on Digital Lending' },
        { instrumentId: 3, sourceTitle: 'CBN Framework for Payment Service Banks' },
      ],
      extractedDocuments: [
        { instrumentId: 1, sourceTitle: 'CBN AML/CFT Regulations 2026' },
        { instrumentId: 3, sourceTitle: 'CBN Framework for Payment Service Banks' },
      ],
      classifiedDocuments: [
        { instrumentId: 1, sourceTitle: 'CBN AML/CFT Regulations 2026', status: 'Published', riskRating: 'High' },
        { instrumentId: 3, sourceTitle: 'CBN Framework for Payment Service Banks', status: 'Published', riskRating: 'Medium' },
      ],
    };
  }
  if (path.startsWith('/platform/regulators')) {
    return [
      { regulatorId: 1, name: 'Central Bank of Nigeria', abbreviation: 'CBN', isActive: true, instrumentCount: 45, pendingDownloadCount: 12, lastInstrumentDiscoveredAt: '2026-06-21T10:00:00Z' },
      { regulatorId: 2, name: 'Securities and Exchange Commission', abbreviation: 'SEC', isActive: true, instrumentCount: 32, pendingDownloadCount: 0, lastInstrumentDiscoveredAt: '2026-06-21T09:00:00Z' },
      { regulatorId: 3, name: 'National Insurance Commission', abbreviation: 'NAICOM', isActive: true, instrumentCount: 28, pendingDownloadCount: 3, lastInstrumentDiscoveredAt: '2026-06-20T14:00:00Z' },
      { regulatorId: 4, name: 'Federal Inland Revenue Service', abbreviation: 'FIRS', isActive: true, instrumentCount: 19, pendingDownloadCount: 0, lastInstrumentDiscoveredAt: '2026-06-19T11:00:00Z' },
      { regulatorId: 5, name: 'Nigerian Communications Commission', abbreviation: 'NCC', isActive: false, instrumentCount: 15, pendingDownloadCount: 0, lastInstrumentDiscoveredAt: '2026-06-19T08:00:00Z' },
    ];
  }
  if (path.startsWith('/platform/tenants')) {
    return [
      { tenantId: 1, legalName: 'First Bank of Nigeria Plc', licenceType: 'Commercial Bank', isActive: true, webhookEnabled: true, onboardedAt: '2025-01-15T00:00:00Z' },
      { tenantId: 2, legalName: 'Zenith Bank Plc', licenceType: 'Commercial Bank', isActive: true, webhookEnabled: true, onboardedAt: '2025-02-01T00:00:00Z' },
      { tenantId: 3, legalName: 'Access Bank Plc', licenceType: 'Commercial Bank', isActive: true, webhookEnabled: true, onboardedAt: '2025-03-10T00:00:00Z' },
      { tenantId: 4, legalName: 'Leadway Assurance Company Ltd', licenceType: 'Insurance', isActive: true, webhookEnabled: false, onboardedAt: '2025-04-05T00:00:00Z' },
      { tenantId: 5, legalName: 'MTN Nigeria Communications Plc', licenceType: 'Telecommunications', isActive: true, webhookEnabled: true, onboardedAt: '2025-05-20T00:00:00Z' },
    ];
  }
  if (path.startsWith('/platform/instruments')) {
    return { content: DEMI_OBLIGATIONS, totalElements: DEMI_OBLIGATIONS.length, totalPages: 1, size: 50, number: 0 };
  }
  if (path.startsWith('/admin/licenses')) {
    if (path.endsWith('/stats')) return { active: 5, expired: 1, revoked: 1, total: 7 };
    const idMatch = path.match(/\/admin\/licenses\/(\d+)$/);
    if (idMatch) {
      const id = parseInt(idMatch[1]);
      return DEMO_LICENSES.find(l => l.id === id) || DEMO_LICENSES[0];
    }
    if (path.includes('/renew') || path.includes('/revoke') || options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
      return { message: 'ok' };
    }
    return DEMO_LICENSES;
  }
  return null;
}

async function request(path, options = {}) {
  const demo = demoRequest(path, options);
  if (demo) return demo;

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (e) {
    throw new Error('Cannot connect to server. Please try again.');
  }

  if (res.status === 204) return null;

  if (res.status === 402 && path !== '/license/activate' && path !== '/auth/login') {
    sessionStorage.setItem('atheris_license_required', '1');
    window.location.href = '/activate-license';
    throw new Error('License required');
  }

  if ((res.status === 401 || res.status === 403) && path !== '/auth/login' && path !== '/auth/refresh') {
    if (authRefreshToken) {
      const refreshed = await doRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${refreshed}`;
        try {
          res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        } catch (e) {
          throw new Error('Cannot connect to server. Please try again.');
        }
      } else {
        clearAuth();
        sessionStorage.setItem('atheris_session_expired', '1');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    } else {
      clearAuth();
      sessionStorage.setItem('atheris_session_expired', '1');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  let body = '';
  try {
    body = await res.text();
  } catch (e) {
    throw new Error('Failed to read response');
  }

  if (!body) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return null;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    throw new Error(`Unexpected response: ${body.substring(0, 100)}`);
  }

  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
    me: () => request('/auth/me'),
  },
  intelligence: {
    search: (params = '') => request(`/intelligence/obligations${params ? '?' + params : ''}`),
    getDetail: (id) => request(`/intelligence/obligations/${id}`),
    getPdfUrl: (id) => request(`/intelligence/obligations/${id}/pdf`),
    getInbox: (status = '') => request(`/intelligence/inbox${status ? '?status=' + status : ''}`),
    classify: (id, data) => request(`/intelligence/obligations/${id}/classify`, { method: 'POST', body: JSON.stringify(data) }),
    getWatches: () => request('/intelligence/watches'),
    updateWatch: (id, data) => request(`/intelligence/watches/${id}/preferences`, { method: 'PUT', body: JSON.stringify(data) }),
    removeWatch: (id) => request(`/intelligence/watches/${id}`, { method: 'DELETE' }),
  },
  platform: {
    tenants: {
      list: () => request('/platform/tenants'),
      get: (id) => request(`/platform/tenants/${id}`),
      create: (data) => request('/platform/tenants', { method: 'POST', body: JSON.stringify(data) }),
      testWebhook: (id) => request(`/platform/tenants/${id}/test-webhook`, { method: 'POST' }),
      rotateSecret: (id) => request(`/platform/tenants/${id}/rotate-webhook-secret`, { method: 'POST' }),
      history: (id) => request(`/platform/tenants/${id}/webhook-history`),
    },
    regulators: {
      list: (params = {}) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
        const s = qs.toString();
        return request(`/platform/regulators${s ? '?' + s : ''}`);
      },
      get: (id) => request(`/platform/regulators/${id}`),
      update: (id, data) => request(`/platform/regulators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      create: (data) => request('/platform/regulators', { method: 'POST', body: JSON.stringify(data) }),
      startBackfill: (id, data) => request(`/platform/regulators/${id}/backfill`, { method: 'POST', body: JSON.stringify(data) }),
      getBackfillStatus: (regId, backfillId) => request(`/platform/regulators/${regId}/backfill/${backfillId}`),
      testScraper: (id, dryRun) => request(`/platform/regulators/${id}/test-scraper?dryRun=${dryRun}`, { method: 'POST' }),
      getPipelineStats: (id) => request(`/platform/regulators/${id}/pipeline-stats`),
    },
    jobs: {
      list: (params = '') => request(`/admin/jobs${params ? '?' + params : ''}`),
      stats: () => request('/admin/jobs/stats'),
      get: (id) => request(`/admin/jobs/${id}`),
      getPdfUrl: (id) => request(`/admin/jobs/${id}/pdf`),
    },
    instruments: {
      list: (params = '') => request(`/platform/instruments${params ? '?' + params : ''}`),
      get: (id) => request(`/platform/instruments/${id}`),
      getPdfUrl: (id) => request(`/intelligence/obligations/${id}/pdf`),
      upload: (regulatorId, file, title) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('regulator_id', regulatorId);
        if (title) formData.append('title', title);
        return fetch(`${API_BASE}/platform/instruments/upload`, {
          method: 'POST',
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          body: formData,
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`);
          return data;
        });
      },
      getTenantClassifications: (id) => request(`/admin/instruments/${id}/tenant-classifications`),
    },
    pendingDownloads: {
      list: (status = 'pending') => request(`/admin/pending-downloads?status=${status}`),
      get: (id) => request(`/admin/pending-downloads/${id}`),
      upload: (id, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(`${API_BASE}/admin/pending-downloads/${id}/upload`, {
          method: 'POST',
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          body: formData,
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
          return data;
        });
      },
      skip: (id) => request(`/admin/pending-downloads/${id}/skip`, { method: 'POST' }),
      stats: () => request('/admin/pending-downloads/stats'),
    },
    licenses: {
      list: (params = '') => request(`/admin/licenses${params ? '?' + params : ''}`),
      get: (id) => request(`/admin/licenses/${id}`),
      create: (data) => request('/admin/licenses', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => request(`/admin/licenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      revoke: (id) => request(`/admin/licenses/${id}/revoke`, { method: 'POST' }),
      renew: (id, expiresAt, gracePeriodDays) => {
        return request(`/admin/licenses/${id}/renew`, { method: 'POST', body: JSON.stringify({ expiresAt, gracePeriodDays }) });
      },
      validate: (data) => request('/admin/licenses/validate', { method: 'POST', body: JSON.stringify(data) }),
      removeDevice: (licenseId, deviceId) => request(`/admin/licenses/${licenseId}/devices/${deviceId}`, { method: 'DELETE' }),
      stats: () => request('/admin/licenses/stats'),
    },
    recommendations: {
      list: (licenceType) => request(`/recommendations${licenceType ? '?licenceType=' + licenceType : ''}`),
      create: (data) => request('/recommendations', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => request(`/recommendations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id) => request(`/recommendations/${id}`, { method: 'DELETE' }),
    },
  },
  license: {
    activate: (data) => request('/license/activate', { method: 'POST', body: JSON.stringify(data) }),
    status: () => request('/license/status'),
    checkup: () => request('/license/checkup', { method: 'POST' }),
    deactivate: () => request('/license/deactivate', { method: 'POST' }),
    audit: () => request('/license/audit'),
  },
  onboarding: {
    status: () => request('/onboarding/status'),
    activateLicense: (data) => request('/onboarding/activate-license', { method: 'POST', body: JSON.stringify(data) }),
    institution: (data) => request('/onboarding/institution', { method: 'POST', body: JSON.stringify(data) }),
    intelligenceMode: (data) => request('/onboarding/intelligence-mode', { method: 'POST', body: JSON.stringify(data) }),
    userSetup: (data) => request('/onboarding/user-setup', { method: 'POST', body: JSON.stringify(data) }),
    regulators: (data) => request('/onboarding/regulators', { method: 'POST', body: JSON.stringify(data) }),
    documentTypes: (data) => request('/onboarding/document-types', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (data) => request('/onboarding/confirm', { method: 'POST', body: JSON.stringify(data) }),
  },
};

export default api;
