// Display labels for the runbook enumerations (persisted strings per the runbooks contract).

export const CATEGORY_LABEL = {
  ACCESS_REVIEW: 'Access Review',
  VULN_MGMT: 'Vulnerability Mgmt',
  INCIDENT: 'Incident Response',
  CONFIG_AUDIT: 'Config Audit',
  CRYPTO: 'Cryptography',
  BCP_DR: 'BCP / DR',
  PRIVACY: 'Privacy',
  AML: 'AML / CFT',
  RETURNS: 'Regulatory Returns',
  VENDOR: 'Vendor / Third Party',
  CHANGE: 'Change Mgmt',
  LOGGING: 'Logging & Monitoring',
  CUSTOM: 'Custom',
};

export const CRITICALITY_LABEL = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

export const SECTION_LABEL = {
  PRECHECK: 'Pre-check', EXECUTION: 'Execution', VERIFICATION: 'Verification', CLOSEOUT: 'Close-out',
};

export const COMMAND_LANG_LABEL = {
  bash: 'Bash', powershell: 'PowerShell', sql: 'SQL', finacle: 'Finacle', ui: 'UI steps', api: 'API', none: '',
};

/** Fallback humaniser: ACCESS_REVIEW → "Access Review", SEMI_ANNUAL → "Semi Annual". */
export function humanize(code) {
  if (!code) return '';
  return String(code).toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export const categoryLabel = (c) => CATEGORY_LABEL[c] || humanize(c);
export const criticalityLabel = (c) => CRITICALITY_LABEL[c] || humanize(c);

/** "90 min", "4 h", "3 d" — SLA minutes to a short label. */
export function formatSla(minutes) {
  if (minutes == null) return '';
  if (minutes < 120) return `${minutes} min`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
