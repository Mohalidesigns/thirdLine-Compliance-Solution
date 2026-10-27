import { StatusBadge } from 'shared';

// The four workflow stages shown on the filing stepper. The backend also ships a leading
// "Not Started" entry — it is a pre-state, not a stage, so it is filtered out here.
export const WORKFLOW_STAGES = ['Data Gathering', 'Draft', 'Review', 'Completed'];
export const NOT_STARTED = 'Not Started';

export const SCHEDULE_ROLES = ['CCO', 'TENANT_ADMIN'];
export const EVENT_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
export const REVIEW_ROLES = ['CCO', 'TENANT_ADMIN'];

export const STATUS_LABEL = { Submitted: 'Completed', 'Submitted Late': 'Completed Late' };
export const STATUS_TONE = {
  'Not Started': 'gray', 'In Progress': 'blue', Submitted: 'green',
  'Submitted Late': 'orange', Overdue: 'red',
};
export const STATUS_ACCENT = {
  'Not Started': '#718096', 'In Progress': '#3182CE', Submitted: '#2D7D46',
  'Submitted Late': '#DD6B20', Overdue: '#E53E3E',
};

export function statusBadge(status, label) {
  return <StatusBadge label={label || STATUS_LABEL[status] || status || NOT_STARTED} tone={STATUS_TONE[status] || 'gray'} />;
}
export function statusAccent(status) { return STATUS_ACCENT[status] || '#2B6CB0'; }

export function isCompletedStatus(status) { return status === 'Submitted' || status === 'Submitted Late'; }

export function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function isEventDriven(item) {
  const type = (item?.frequencyType || '').toLowerCase().replace(/[\s_-]/g, '');
  if (type === 'eventdriven') return true;
  const f = (item?.frequency || '').toLowerCase().replace(/[\s_-]/g, '');
  return f === 'eventdriven' || f === 'onevent';
}

export function noPeriodLabel(item) { return isEventDriven(item) ? 'On event' : 'No scheduled period'; }

export function responsibleUnits(item) {
  if (item?.responsibleUnits?.length) return item.responsibleUnits;
  return item?.responsibleUnit ? [item.responsibleUnit] : [];
}

export function responsiblePersons(item) {
  if (item?.responsiblePersons?.length) return item.responsiblePersons;
  return item?.responsiblePerson ? [item.responsiblePerson] : [];
}

export function dueRuleText(item) {
  if (item?.dueDateNeeded) return 'Due date needed';
  if (item?.dueRuleType === 'OFFSET') return `${item.daysAfterPeriodEnd} day(s) after period end`;
  if (item?.dueRuleType === 'DATE' && item.firstDueDate) return `Fixed — first ${formatDate(item.firstDueDate)}`;
  if (isEventDriven(item)) return 'On event (no schedule)';
  return '—';
}

export function escalationTargetLabel(level) {
  if (!level) return '—';
  return level.targetName || level.targetEmail || level.targetRole
    || { ASSIGNEE: 'Responsible person', MANAGER: "Responsible person's manager",
      MANAGER_OF_MANAGER: "Manager's manager" }[level.targetType] || level.targetType || '—';
}

export function escalationLadder(levels) {
  return (levels || []).map((l) => `L${l.levelNo} → ${escalationTargetLabel(l)}`
    + ` after ${l.afterValue ?? 0} ${(l.afterUnit || 'DAYS').toLowerCase()}`);
}

export function escalationLeadDays(escalation) {
  if (escalation?.reminderStartValue == null) return 7;
  return escalation.reminderStartUnit === 'HOURS'
    ? Math.max(1, Math.ceil(escalation.reminderStartValue / 24))
    : escalation.reminderStartValue;
}

export function daysUntil(dueDate) {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
}

// A period the user still has to act on: awaiting review, overdue, dateless, or inside the reminder lead.
export function needsAction(filing, escalation) {
  if (!filing) return false;
  if (filing.pendingReview) return true;
  if (isCompletedStatus(filing.status)) return false;
  if (filing.isOverdue) return true;
  const days = daysUntil(filing.dueDate);
  if (days == null) return true;
  return days <= escalationLeadDays(escalation);
}
