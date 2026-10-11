/**
 * Shared display helpers for register/detail pages in both Atheris frontends.
 * Pure functions + vocabulary maps — no React, so they are safe to import anywhere.
 */

export function formatNaira(amount, { perDay = false } = {}) {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  const s = new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(n);
  return perDay ? `${s} / day` : s;
}

export function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const PENALTY_TYPE_LABEL = {
  MONETARY: 'Monetary',
  MONETARY_PER_UNIT: 'Per unit',
  MONETARY_PER_DAY: 'Per day',
  PERCENTAGE: 'Percentage',
  IMPRISONMENT: 'Imprisonment',
  LICENCE_ACTION: 'Licence action',
  FORFEITURE: 'Forfeiture',
  RECOVERY: 'Recovery',
  CRIMINAL: 'Criminal',
  DISCRETIONARY: 'Discretionary',
  QUALITATIVE: 'Qualitative',
};

export function friendlyPenaltyTypes(list) {
  if (!list || !list.length) return '—';
  return list.map((t) => PENALTY_TYPE_LABEL[t] || t).join(', ');
}

export const RISK_COLOR = {
  Critical: '#C53030',
  High: '#E53E3E',
  Moderate: '#DD6B20',
  Medium: '#DD6B20',
  Low: '#2D7D46',
};

export const STATUS_COLOR = {
  Active: '#2C7A7B',
  Superseded: '#C53030',
  Outdated: '#DD6B20',
  Current: '#2D7D46',
};
