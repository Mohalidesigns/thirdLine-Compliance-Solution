import { obligationColumns, controlColumns, returnColumns, sanctionColumns } from './columns';

/**
 * Canonical register configuration for the compliance entities, shared so the tenant
 * registers render the SAME columns, KPIs (with breakdown dropdowns) and filters as intel.
 *
 * Lifted from the intel explorers. Intel still owns its own copies for now; new pages
 * (the tenant registers) consume this. Each entity exposes:
 *   columns()          -> the shared column definition array (from ./columns)
 *   kpis[]             -> { key, label, color, value(stats), breakdown(stats) -> {label: count}, drill?(key,label) }
 *   filters[]          -> { key, param, label, type, options(stats) -> [{value,label}] }
 *   kpiFilter(key)     -> the filter patch a KPI card applies on click
 */

const PENALTY_TYPE_LABEL = {
  MONETARY: 'Monetary', MONETARY_PER_UNIT: 'Per unit', MONETARY_PER_DAY: 'Per day',
  PERCENTAGE: 'Percentage', IMPRISONMENT: 'Imprisonment', LICENCE_ACTION: 'Licence action',
  FORFEITURE: 'Forfeiture', RECOVERY: 'Recovery', CRIMINAL: 'Criminal',
  DISCRETIONARY: 'Discretionary', QUALITATIVE: 'Qualitative',
};

const naira = (amount) => {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
};

const listOptions = (values) => (values || []).map((v) => ({ value: v, label: v }));

export const obligationRegister = {
  entity: 'obligation',
  columns: obligationColumns,
  kpis: [
    { key: 'total', label: 'Total', color: '#1976d2', value: (s) => s?.total ?? 0 },
    { key: 'highRisk', label: 'High Risk', color: '#d32f2f', value: (s) => s?.highRisk ?? 0 },
    { key: 'withPoints', label: 'With Points', color: '#2e7d32', value: (s) => s?.withPoints ?? 0 },
    { key: 'withoutPoints', label: 'Without Points', color: '#ed6c02', value: (s) => s?.withoutPoints ?? 0 },
  ],
  filters: [
    { key: 'q', param: 'q', label: 'Search', type: 'search', placeholder: 'Search obligation, title or regulator...' },
    { key: 'risk', param: 'risk', label: 'Risk', type: 'select', options: (s) => listOptions(s?.risks?.length ? s.risks : ['Critical', 'High', 'Moderate', 'Low']) },
    { key: 'regulator', param: 'regulator', label: 'Regulator', type: 'select', options: (s) => listOptions(s?.regulators) },
    { key: 'areaOfFocus', param: 'areaOfFocus', label: 'Area of Focus', type: 'select', options: (s) => listOptions(s?.areas) },
    { key: 'act', param: 'act', label: 'Act', type: 'select', options: (s) => listOptions(s?.acts) },
    { key: 'hasPoints', param: 'hasPoints', label: 'Points', type: 'select', options: () => [{ value: 'With', label: 'With' }, { value: 'Without', label: 'Without' }] },
  ],
  kpiFilter: (key) => {
    if (key === 'highRisk') return { risk: 'High', hasPoints: 'All' };
    if (key === 'withPoints') return { risk: 'All', hasPoints: 'With' };
    if (key === 'withoutPoints') return { risk: 'All', hasPoints: 'Without' };
    return { risk: 'All', hasPoints: 'All' };
  },
};

export const controlRegister = {
  entity: 'control',
  columns: () => controlColumns({ withAct: true }),
  kpis: [
    { key: 'total', label: 'Total Controls', color: '#2B6CB0', value: (s) => s?.totalControls ?? 0 },
    { key: 'high', label: 'High / Critical Risk', color: '#E53E3E', value: (s) => (s?.byRiskLevel?.High ?? 0) + (s?.byRiskLevel?.Critical ?? 0) },
    { key: 'open', label: 'Open', color: '#DD6B20', value: (s) => s?.byStatus?.Open ?? 0 },
    { key: 'closed', label: 'Closed', color: '#2C7A7B', value: (s) => s?.byStatus?.Closed ?? 0 },
    { key: 'themes', label: 'Themes', color: '#805AD5', value: (s) => (s?.themes || []).length },
  ],
  filters: [
    { key: 'q', param: 'q', label: 'Search', type: 'search', placeholder: 'Search controls...' },
    { key: 'theme', param: 'theme', label: 'Theme', type: 'select', options: (s) => listOptions(s?.themes) },
    { key: 'riskLevel', param: 'riskLevel', label: 'Risk level', type: 'select', options: (s) => listOptions(s?.riskLevels) },
    { key: 'status', param: 'status', label: 'Status', type: 'select', options: (s) => listOptions(s?.statuses) },
  ],
  kpiFilter: () => ({}),
};

export const returnRegister = {
  entity: 'return',
  columns: returnColumns,
  kpis: [
    { key: 'total', label: 'Total Returns', color: '#DD6B20', value: (s) => s?.totalReturns ?? 0, breakdown: (s) => s?.byFrequencyType },
    { key: 'frequencies', label: 'Frequency Types', color: '#2B6CB0', value: (s) => s?.frequencyTypeCount ?? 0, breakdown: (s) => s?.byFrequencyType },
    { key: 'units', label: 'Responsible Units', color: '#2C7A7B', value: (s) => s?.responsibleUnitCount ?? 0, breakdown: (s) => s?.byResponsibleUnit },
    { key: 'unassigned', label: 'Unassigned', color: '#805AD5', value: (s) => s?.unassignedCount ?? 0, breakdown: (s) => s?.byFrequencyType },
  ],
  filters: [
    { key: 'q', param: 'q', label: 'Search', type: 'search', placeholder: 'Search returns...' },
    { key: 'frequencyType', param: 'frequencyType', label: 'Frequency', type: 'select', options: (s) => listOptions(s?.frequencyTypes) },
    { key: 'responsibleUnit', param: 'responsibleUnit', label: 'Responsible unit', type: 'select', options: (s) => listOptions(s?.responsibleUnits) },
    { key: 'actId', param: 'actId', label: 'Act', type: 'select', options: (s) => (s?.acts || []).map((a) => ({ value: String(a.actId), label: a.name })) },
  ],
  kpiFilter: () => ({}),
};

export const sanctionRegister = {
  entity: 'sanction',
  columns: sanctionColumns,
  kpis: [
    { key: 'total', label: 'Total Sanctions', color: '#2B6CB0', value: (s) => s?.total ?? 0, breakdown: (s) => s?.byPenaltyType },
    { key: 'exposure', label: 'Monetary Exposure', color: '#DD6B20', value: (s) => naira(s?.totalExposure),
      breakdown: (s) => Object.fromEntries((s?.byActExposure || []).slice(0, 8).map((a) => [a.name || `Act ${a.actId}`, naira(a.amount)])) },
    { key: 'highSeverity', label: 'High Severity', color: '#E53E3E', value: (s) => s?.highSeverity ?? 0, breakdown: (s) => s?.byPenaltyType },
    { key: 'enforced', label: 'Enforced', color: '#38A169', value: (s) => s?.enforced ?? 0, breakdown: (s) => s?.enforcedByPenaltyType },
  ],
  filters: [
    { key: 'q', param: 'q', label: 'Search', type: 'search', placeholder: 'Search obligation...' },
    { key: 'actId', param: 'regulationId', label: 'Act', type: 'select', options: (s) => (s?.acts || []).map((a) => ({ value: String(a.actId), label: a.name })) },
    { key: 'penaltyType', param: 'penaltyType', label: 'Penalty Type', type: 'select', options: (s) => (s?.penaltyTypes || []).map((t) => ({ value: t, label: PENALTY_TYPE_LABEL[t] || t })) },
    { key: 'liableRole', param: 'liableRole', label: 'Responsible Party', type: 'select', options: (s) => listOptions(s?.liableRoles) },
  ],
  kpiFilter: (key) => {
    if (key === 'highSeverity') return { minSeverity: '8' };
    if (key === 'enforced') return { hasBeenEnforced: 'true' };
    return {};
  },
};

export { PENALTY_TYPE_LABEL, naira };
