// Shared return-schedule vocabulary and validation, used by EditScheduleDialog (one return)
// and BulkDueDatesDialog (many). Mirrors the backend rules for PUT /returns/{id}/schedule
// and PUT /returns/schedules.

export const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Event-driven'];
// Frequencies with no due rule in the single-return dialog (periods come straight from the cycle, or none at all).
export const NO_RULE = ['Daily', 'Weekly', 'Event-driven'];
// Frequencies that cannot use "days after period end".
export const NO_OFFSET = ['Daily', 'Weekly', 'Biennial', 'Event-driven'];

export const RULE_LABELS = { DATE: 'Fixed date', OFFSET: 'Days after period end' };

const TYPE_TO_LABEL = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual', ANNUAL: 'Annual', BIENNIAL: 'Biennial', EVENT_DRIVEN: 'Event-driven',
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s_-]/g, '');
}

// Map a register item's frequencyType / frequency text to one of the FREQUENCIES labels ('' if unknown).
export function frequencyLabel(item) {
  if (item?.frequencyType && TYPE_TO_LABEL[item.frequencyType]) return TYPE_TO_LABEL[item.frequencyType];
  const f = norm(item?.frequency);
  if (!f) return '';
  return FREQUENCIES.find(l => norm(l) === f) || FREQUENCIES.find(l => f.startsWith(norm(l))) || '';
}

export function offsetAllowed(frequency) {
  return !!frequency && !NO_OFFSET.includes(frequency);
}

export function maxOffsetDays(frequency) {
  return frequency === 'Monthly' ? 28 : 365;
}

// '' when valid, otherwise a user-facing message.
export function prepDaysError(prepDays) {
  if (prepDays === '' || prepDays == null) return '';
  const p = Number(prepDays);
  if (!Number.isInteger(p) || p < 0) return 'Prep days must be a whole number of 0 or more.';
  return '';
}

// Validates a DATE / OFFSET rule for a known frequency. '' when valid.
export function ruleError(frequency, ruleType, firstDueDate, daysAfterPeriodEnd) {
  if (ruleType === 'DATE') {
    if (!firstDueDate) return 'Enter the first due date.';
    return '';
  }
  if (ruleType === 'OFFSET') {
    if (frequency === 'Biennial') return 'Biennial returns need a fixed date.';
    if (!offsetAllowed(frequency)) return `${frequency} returns cannot use days after period end.`;
    const d = Number(daysAfterPeriodEnd);
    if (daysAfterPeriodEnd === '' || daysAfterPeriodEnd == null || !Number.isInteger(d)) return 'Enter the days after period end.';
    const max = maxOffsetDays(frequency);
    if (d < 1 || d > max) return `Days after period end must be between 1 and ${max} for ${frequency} returns.`;
    return '';
  }
  return 'Choose a due rule.';
}
