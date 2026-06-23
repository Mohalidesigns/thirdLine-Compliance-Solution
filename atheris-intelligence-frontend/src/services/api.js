const API_BASE = 'http://localhost:9090/api/v1';
const DEMO_TOKEN = 'demo-jwt-token';

let authToken = null;

export const setToken = (token) => { authToken = token; };
export const getToken = () => authToken;

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
  if (path.startsWith('/platform/regulators')) {
    return [
      { id: 1, name: 'Central Bank of Nigeria', abbreviation: 'CBN', isActive: true, jurisdiction: 'Nigeria', instrumentCount: 45, lastScraped: '2026-06-21T10:00:00Z' },
      { id: 2, name: 'Securities and Exchange Commission', abbreviation: 'SEC', isActive: true, jurisdiction: 'Nigeria', instrumentCount: 32, lastScraped: '2026-06-21T09:00:00Z' },
      { id: 3, name: 'National Insurance Commission', abbreviation: 'NAICOM', isActive: true, jurisdiction: 'Nigeria', instrumentCount: 28, lastScraped: '2026-06-20T14:00:00Z' },
      { id: 4, name: 'Federal Inland Revenue Service', abbreviation: 'FIRS', isActive: true, jurisdiction: 'Nigeria', instrumentCount: 19, lastScraped: '2026-06-20T11:00:00Z' },
      { id: 5, name: 'Nigerian Communications Commission', abbreviation: 'NCC', isActive: false, jurisdiction: 'Nigeria', instrumentCount: 15, lastScraped: '2026-06-19T08:00:00Z' },
    ];
  }
  if (path.startsWith('/platform/tenants')) {
    return [
      { id: 1, legalName: 'First Bank of Nigeria Plc', licenceType: 'Commercial Bank', isActive: true, webhookEnabled: true, onboardedAt: '2025-01-15T00:00:00Z' },
      { id: 2, legalName: 'Zenith Bank Plc', licenceType: 'Commercial Bank', isActive: true, webhookEnabled: true, onboardedAt: '2025-02-01T00:00:00Z' },
      { id: 3, legalName: 'Access Bank Plc', licenceType: 'Commercial Bank', isActive: true, webhookEnabled: true, onboardedAt: '2025-03-10T00:00:00Z' },
      { id: 4, legalName: 'Leadway Assurance Company Ltd', licenceType: 'Insurance', isActive: true, webhookEnabled: false, onboardedAt: '2025-04-05T00:00:00Z' },
      { id: 5, legalName: 'MTN Nigeria Communications Plc', licenceType: 'Telecommunications', isActive: true, webhookEnabled: true, onboardedAt: '2025-05-20T00:00:00Z' },
    ];
  }
  if (path.startsWith('/platform/instruments')) {
    return { content: DEMI_OBLIGATIONS, totalElements: DEMI_OBLIGATIONS.length, totalPages: 1, size: 50, number: 0 };
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
    throw new Error('Backend not reachable. Make sure the server is running on port 9090.');
  }

  if (res.status === 204) return null;

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

  if (!res.ok) throw new Error(data.message || `API error ${res.status}`);
  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request('/auth/me'),
  },
  intelligence: {
    // Obligation Library
    search: (params = '') => request(`/intelligence/obligations${params ? '?' + params : ''}`),
    getDetail: (id) => request(`/intelligence/obligations/${id}`),
    getPdfUrl: (id) => request(`/intelligence/obligations/${id}/pdf`),
    
    // Inbox & Classification
    getInbox: (status = '') => request(`/intelligence/inbox${status ? '?status=' + status : ''}`),
    classify: (id, data) => request(`/intelligence/obligations/${id}/classify`, { method: 'POST', body: JSON.stringify(data) }),
    
    // Watches
    getWatches: () => request('/intelligence/watches'),
    updateWatch: (id, data) => request(`/intelligence/watches/${id}/preferences`, { method: 'PUT', body: JSON.stringify(data) }),
    removeWatch: (id) => request(`/intelligence/watches/${id}`, { method: 'DELETE' }),
  },
  platform: {
    // Tenant Management
    tenants: {
      list: () => request('/platform/tenants'),
      get: (id) => request(`/platform/tenants/${id}`),
      create: (data) => request('/platform/tenants', { method: 'POST', body: JSON.stringify(data) }),
      testWebhook: (id) => request(`/platform/tenants/${id}/test-webhook`, { method: 'POST' }),
      rotateSecret: (id) => request(`/platform/tenants/${id}/rotate-webhook-secret`, { method: 'POST' }),
      history: (id) => request(`/platform/tenants/${id}/webhook-history`),
    },
    // Regulator & Scraper Management
    regulators: {
      list: (activeOnly) => request(`/platform/regulators${activeOnly !== undefined ? '?activeOnly=' + activeOnly : ''}`),
      get: (id) => request(`/platform/regulators/${id}`),
      update: (id, data) => request(`/platform/regulators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      create: (data) => request('/platform/regulators', { method: 'POST', body: JSON.stringify(data) }),
      startBackfill: (id, data) => request(`/platform/regulators/${id}/backfill`, { method: 'POST', body: JSON.stringify(data) }),
      getBackfillStatus: (regId, backfillId) => request(`/platform/regulators/${regId}/backfill/${backfillId}`),
      testScraper: (id, dryRun) => request(`/platform/regulators/${id}/test-scraper?dryRun=${dryRun}`, { method: 'POST' }),
    },
    // Job Queue / Pipeline
    jobs: {
      list: (params = '') => request(`/admin/jobs${params ? '?' + params : ''}`),
      stats: () => request('/admin/jobs/stats'),
      get: (id) => request(`/admin/jobs/${id}`),
      getPdfUrl: (id) => request(`/admin/jobs/${id}/pdf`),
    },
    // Instruments per regulator
    instruments: {
      list: (params = '') => request(`/platform/instruments${params ? '?' + params : ''}`),
      get: (id) => request(`/platform/instruments/${id}`),
      getPdfUrl: (id) => request(`/intelligence/obligations/${id}/pdf`),
    },
    // Pending Manual Downloads
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
    }
  }
};

export default api;
