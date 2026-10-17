// Compliance Runbooks — persisted enum values and their display labels/colours.
// Values must match the tenant backend strings exactly (see the runbooks API contract).

export const CATEGORIES = [
  { value: 'ACCESS_REVIEW', label: 'Access Review' },
  { value: 'VULN_MGMT', label: 'Vulnerability Mgmt' },
  { value: 'INCIDENT', label: 'Incident Response' },
  { value: 'CONFIG_AUDIT', label: 'Config Audit' },
  { value: 'CRYPTO', label: 'Cryptography' },
  { value: 'BCP_DR', label: 'BCP / DR' },
  { value: 'PRIVACY', label: 'Privacy' },
  { value: 'AML', label: 'AML / CFT' },
  { value: 'RETURNS', label: 'Regulatory Returns' },
  { value: 'VENDOR', label: 'Vendor Risk' },
  { value: 'CHANGE', label: 'Change Control' },
  { value: 'LOGGING', label: 'Logging & Monitoring' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const CRITICALITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const CRITICALITY_COLOR = { CRITICAL: 'error', HIGH: 'error', MEDIUM: 'warning', LOW: 'success' };

export const FREQUENCIES = [
  { value: 'ON_DEMAND', label: 'On demand' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'EVENT_DRIVEN', label: 'Event-driven' },
];

export const RUNBOOK_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED'];
export const RUNBOOK_STATUS_COLOR = {
  DRAFT: 'default', IN_REVIEW: 'warning', PUBLISHED: 'success', DEPRECATED: 'default', ARCHIVED: 'default',
  SUPERSEDED: 'default',
};

export const SECTION_TYPES = [
  { value: 'PRECHECK', label: 'Pre-checks' },
  { value: 'EXECUTION', label: 'Execution' },
  { value: 'VERIFICATION', label: 'Verification' },
  { value: 'CLOSEOUT', label: 'Close-out' },
];

export const COMMAND_LANGS = ['bash', 'powershell', 'sql', 'finacle', 'ui', 'api', 'none'];
export const STEP_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN', 'AUDITOR', 'IT_OPS', 'DPO', 'CISO', 'CUSTOM'];
export const EVIDENCE_TYPES = [
  'SCREENSHOT', 'LOG_FILE', 'QUERY_OUTPUT', 'TICKET_REF', 'ATTESTATION', 'DOCUMENT',
  'CONFIG_EXPORT', 'EMAIL', 'SIGNED_FORM',
];
export const PREREQ_TYPES = ['ACCESS', 'TOOL', 'CREDENTIAL', 'APPROVAL', 'DATA', 'WINDOW'];
export const ESCALATION_TRIGGERS = ['STEP_FAILED', 'SLA_50', 'SLA_80', 'SLA_BREACH', 'MANUAL'];
export const NOTIFY_CHANNELS = ['IN_APP', 'EMAIL'];

export const EXECUTION_STATUSES = [
  'NOT_STARTED', 'PREFLIGHT', 'IN_PROGRESS', 'PAUSED', 'ESCALATED', 'ROLLING_BACK',
  'PENDING_SIGNOFF', 'COMPLETED_PASS', 'COMPLETED_FAIL', 'ABORTED',
];
export const EXECUTION_STATUS_COLOR = {
  NOT_STARTED: 'default', PREFLIGHT: 'info', IN_PROGRESS: 'info', PAUSED: 'warning', ESCALATED: 'error',
  ROLLING_BACK: 'warning', PENDING_SIGNOFF: 'warning', COMPLETED_PASS: 'success', COMPLETED_FAIL: 'error',
  ABORTED: 'default',
};
export const ACTIVE_EXECUTION_STATUSES = ['NOT_STARTED', 'PREFLIGHT', 'IN_PROGRESS', 'PAUSED', 'ESCALATED', 'ROLLING_BACK'];

export const STEP_STATUS_COLOR = {
  PENDING: 'default', IN_PROGRESS: 'info', AWAITING_VERIFICATION: 'warning', PASSED: 'success',
  FAILED: 'error', SKIPPED: 'default', NA: 'default',
};
export const TERMINAL_STEP_STATUSES = ['PASSED', 'FAILED', 'SKIPPED', 'NA'];
export const FAILURE_CATEGORIES = ['BLOCKED', 'DEVIATION', 'ERROR', 'NOT_APPLICABLE'];
export const TRIGGER_TYPES = ['MANUAL', 'SCHEDULED', 'INCIDENT', 'FINDING', 'REVIEW'];

// Role groups (permission matrix, runbook spec §10).
export const AUTHOR_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
export const APPROVER_ROLES = ['CCO', 'TENANT_ADMIN'];
export const EXECUTOR_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN', 'IT_OPS'];
export const PACK_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN', 'AUDITOR'];

export const label = (list, value) =>
  (list.find((x) => (x.value ?? x) === value)?.label) ?? (value ? String(value).replace(/_/g, ' ') : '–');
export const humanize = (v) => (v ? String(v).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '–');

export const formatMinutes = (m) => {
  if (m == null) return '–';
  if (m % 1440 === 0) return `${m / 1440}d`;
  if (m % 60 === 0) return `${m / 60}h`;
  return `${m}m`;
};
