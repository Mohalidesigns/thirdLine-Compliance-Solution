import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, MenuItem, Radio, RadioGroup, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import PersonPicker from '../common/PersonPicker';
import { api } from '../../services/api';

const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'On event'];
const NO_RULE = ['On event'];
const OFFSET_FREQ = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const TYPE_TO_LABEL = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual', ANNUAL: 'Annual', BIENNIAL: 'Biennial', EVENT_DRIVEN: 'On event',
};
const UNITS = [{ value: 'DAYS', label: 'Days' }, { value: 'HOURS', label: 'Hours' }];
const MAX_LEVELS = 3;
const CUSTOM = 'CUSTOM';

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_-]/g, '');

function frequencyLabel(item) {
  if (item?.frequencyType && TYPE_TO_LABEL[item.frequencyType]) return TYPE_TO_LABEL[item.frequencyType];
  const f = norm(item?.frequency);
  if (!f) return '';
  return FREQUENCIES.find(l => norm(l) === f) || FREQUENCIES.find(l => f.startsWith(norm(l))) || '';
}

function initialSchedule(item) {
  const frequency = frequencyLabel(item);
  let ruleType = item?.dueRuleType || (item?.daysAfterPeriodEnd != null ? 'OFFSET' : 'DATE');
  if (frequency === 'Biennial') ruleType = 'DATE';
  return {
    frequency,
    ruleType,
    firstDueDate: item?.firstDueDate || '',
    daysAfterPeriodEnd: item?.daysAfterPeriodEnd != null ? String(item.daysAfterPeriodEnd) : '',
    prepDays: item?.prepDays != null ? String(item.prepDays) : '5',
  };
}

function validateSchedule(form) {
  if (!form.frequency) return 'Choose a frequency.';
  if (form.prepDays !== '') {
    const p = Number(form.prepDays);
    if (!Number.isInteger(p) || p < 0) return 'Prep days must be a whole number of 0 or more.';
  }
  if (NO_RULE.includes(form.frequency)) return '';
  if (form.ruleType === 'DATE') return form.firstDueDate ? '' : 'Enter the first due date.';
  if (form.ruleType === 'OFFSET') {
    if (!OFFSET_FREQ.includes(form.frequency)) return `Days after period end is not available for ${form.frequency} returns.`;
    const d = Number(form.daysAfterPeriodEnd);
    if (form.daysAfterPeriodEnd === '' || !Number.isInteger(d)) return 'Enter the days after period end.';
    const max = form.frequency === 'Monthly' ? 28 : 365;
    if (d < 1 || d > max) return `Days after period end must be between 1 and ${max} for ${form.frequency} returns.`;
    return '';
  }
  return 'Choose a due rule.';
}

function scheduleBody(form) {
  const prepDays = form.prepDays === '' ? null : Number(form.prepDays);
  if (NO_RULE.includes(form.frequency)) {
    return { frequency: form.frequency, ruleType: null, firstDueDate: null, daysAfterPeriodEnd: null, prepDays };
  }
  if (form.ruleType === 'DATE') {
    return { frequency: form.frequency, ruleType: 'DATE', firstDueDate: form.firstDueDate, daysAfterPeriodEnd: null, prepDays };
  }
  return {
    frequency: form.frequency, ruleType: 'OFFSET', firstDueDate: null,
    daysAfterPeriodEnd: Number(form.daysAfterPeriodEnd), prepDays,
  };
}

function toEscalationForm(escalation) {
  const levels = escalation?.levels?.length
    ? escalation.levels
    : [{ levelNo: 1, afterValue: 0, afterUnit: 'DAYS', targetType: 'ASSIGNEE' }];
  return {
    reminderStartValue: escalation?.reminderStartValue ?? 10,
    reminderStartUnit: escalation?.reminderStartUnit || 'DAYS',
    reminderRepeatValue: escalation?.reminderRepeatValue ?? 2,
    reminderRepeatUnit: escalation?.reminderRepeatUnit || 'DAYS',
    levels: levels.map((l) => ({
      afterValue: l.afterValue ?? 0,
      afterUnit: l.afterUnit || 'DAYS',
      targetType: l.targetType || 'MANAGER',
      person: l.targetType === 'PERSON'
        ? { fullName: l.targetName || '', email: l.targetEmail || '', userId: l.targetUserId ?? null }
        : null,
    })),
  };
}

function toLevels(levels) {
  return levels.map((l) => {
    const row = { afterValue: Number(l.afterValue || 0), afterUnit: l.afterUnit };
    if (l.person && (l.person.email || l.person.userId)) {
      return { ...row, targetType: 'PERSON', targetUserId: l.person.userId ? Number(l.person.userId) : null,
        targetName: l.person.fullName || null, targetEmail: l.person.email || null };
    }
    if (l.targetType === 'ROLE' || l.targetType === 'CCO') return { ...row, targetType: 'ROLE', targetRole: 'CCO' };
    return { ...row, targetType: l.targetType || 'MANAGER' };
  });
}

export default function ReturnEditDialog({ open, item, canEditSchedule, onClose, onSaved, onSnackbar }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(canEditSchedule ? 0 : 1);
  const [schedule, setSchedule] = useState(() => initialSchedule(item));
  const [escalation, setEscalation] = useState(null);
  const [policyChoice, setPolicyChoice] = useState(CUSTOM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const returnId = item?.returnId;

  const templatesQuery = useQuery({
    queryKey: ['escalation', 'policies', 'RETURN', 'templates'],
    queryFn: ({ signal }) => api.escalation.policies('RETURN', { defaultsOnly: true }, { signal }),
    enabled: open,
  });
  const templates = templatesQuery.data || [];

  const escalationQuery = useQuery({
    queryKey: ['returns', 'escalation', String(returnId)],
    queryFn: ({ signal }) => api.returns.escalation(returnId, { signal }),
    enabled: open && returnId != null,
  });

  useEffect(() => {
    if (!open) return;
    setTab(canEditSchedule ? 0 : 1);
    setSchedule(initialSchedule(item));
    setError('');
  }, [open, item, canEditSchedule]);

  useEffect(() => {
    if (!open || !escalationQuery.data) return;
    setEscalation(toEscalationForm(escalationQuery.data));
  }, [open, escalationQuery.data]);

  useEffect(() => {
    if (!open) return;
    const current = item?.escalationPolicyId;
    const isTemplate = current != null && templates.some(t => String(t.policyId) === String(current));
    setPolicyChoice(isTemplate ? String(current) : CUSTOM);
  }, [open, item?.escalationPolicyId, templates]);

  const setS = (k, v) => setSchedule((f) => ({ ...f, [k]: v }));
  const setE = (k, v) => setEscalation((f) => ({ ...f, [k]: v }));
  const setLevel = (index, key, value) => setEscalation((f) => ({
    ...f, levels: f.levels.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
  }));

  const showRule = schedule.frequency && !NO_RULE.includes(schedule.frequency);

  async function save() {
    setError('');
    if (canEditSchedule) {
      const msg = validateSchedule(schedule);
      if (msg) { setError(msg); setTab(0); return; }
    }
    setSaving(true);
    try {
      if (canEditSchedule) {
        const body = scheduleBody(schedule);
        const before = scheduleBody(initialSchedule(item));
        if (JSON.stringify(body) !== JSON.stringify(before)) {
          await api.returns.updateSchedule(returnId, body);
        }
      }
      if (policyChoice === CUSTOM) {
        if (!escalation) throw new Error('Escalation values are still loading.');
        await api.returns.updateEscalation(returnId, {
          reminderStartValue: escalation.reminderStartValue === '' ? null : Number(escalation.reminderStartValue),
          reminderStartUnit: escalation.reminderStartUnit,
          reminderRepeatValue: escalation.reminderRepeatValue === '' ? null : Number(escalation.reminderRepeatValue),
          reminderRepeatUnit: escalation.reminderRepeatUnit,
          levels: toLevels(escalation.levels),
        });
      } else {
        await api.returns.updateEscalationPolicy(returnId, Number(policyChoice));
      }
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e.message || 'Failed to save the return.';
      setError(msg);
      onSnackbar?.(msg);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit return</DialogTitle>
      <DialogContent sx={{ '&&': { pt: 1 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {canEditSchedule && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Schedule" />
            <Tab label="Escalation" />
          </Tabs>
        )}

        {(canEditSchedule && tab === 0) ? (
          <>
            <TextField select fullWidth size="small" label="Frequency" value={schedule.frequency}
              onChange={e => setS('frequency', e.target.value)} sx={{ mb: 2 }}>
              <MenuItem value=""><em>None</em></MenuItem>
              {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
            {item?.deadlineText && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Regulator's wording: “{item.deadlineText}”
              </Alert>
            )}
            {showRule && (
              <>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>When is it due?</Typography>
                <RadioGroup row value={schedule.ruleType} onChange={e => setS('ruleType', e.target.value)} sx={{ mb: 1 }}>
                  <FormControlLabel value="DATE" control={<Radio size="small" />} label="Fixed date" />
                  <FormControlLabel value="OFFSET" control={<Radio size="small" />} label="Days after period end"
                    disabled={!OFFSET_FREQ.includes(schedule.frequency)} />
                </RadioGroup>
                {schedule.ruleType === 'DATE' ? (
                  <TextField fullWidth size="small" type="date" label="First due date" value={schedule.firstDueDate}
                    onChange={e => setS('firstDueDate', e.target.value)}
                    helperText={NO_RULE.includes(schedule.frequency) ? undefined
                      : `The next due date — ${schedule.frequency.toLowerCase()} periods ride the cycle from this date.`}
                    slotProps={{ inputLabel: { shrink: true } }} sx={{ mb: 2 }} />
                ) : (
                  <TextField fullWidth size="small" type="number" label="Days after period end"
                    value={schedule.daysAfterPeriodEnd}
                    onChange={e => setS('daysAfterPeriodEnd', e.target.value)}
                    helperText="e.g. 10 → due the 10th day of the following month."
                    sx={{ mb: 2 }} />
                )}
              </>
            )}
            {schedule.frequency === 'On event' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                The deadline is anchored to the event — configure the trigger on the return.
              </Alert>
            )}
            <TextField fullWidth size="small" type="number" label="Prep days before due"
              value={schedule.prepDays} onChange={e => setS('prepDays', e.target.value)}
              helperText="How many days before the due date the responsible person should start." />
          </>
        ) : (
          <>
            <TextField select fullWidth size="small" label="Escalation policy" value={policyChoice}
              onChange={e => setPolicyChoice(e.target.value)} sx={{ mb: 2 }}>
              <MenuItem value={CUSTOM}>Custom for this return (edit reminders &amp; ladder)</MenuItem>
              {templates.map(t => (
                <MenuItem key={t.policyId} value={String(t.policyId)}>
                  {t.name}{t.frequencyScope ? ` (${t.frequencyScope.toLowerCase()})` : ''}
                </MenuItem>
              ))}
            </TextField>
            {policyChoice !== CUSTOM ? (
              <Typography variant="body2" color="text.secondary">
                This return follows a shared template — edit it in Settings → Notifications, or choose
                “Custom for this return” to give this return its own reminders and ladder.
              </Typography>
            ) : !escalation ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>
                      Remind before
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                      <TextField fullWidth size="small" type="number" value={escalation.reminderStartValue}
                        slotProps={{ htmlInput: { min: 0 } }}
                        onChange={(e) => setE('reminderStartValue', e.target.value)} />
                      <TextField select fullWidth size="small" value={escalation.reminderStartUnit}
                        onChange={(e) => setE('reminderStartUnit', e.target.value)}>
                        {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                      </TextField>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>
                      Remind after every
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                      <TextField fullWidth size="small" type="number" value={escalation.reminderRepeatValue}
                        slotProps={{ htmlInput: { min: 0 } }}
                        onChange={(e) => setE('reminderRepeatValue', e.target.value)} />
                      <TextField select fullWidth size="small" value={escalation.reminderRepeatUnit}
                        onChange={(e) => setE('reminderRepeatUnit', e.target.value)}>
                        {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                      </TextField>
                    </Box>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary">Ladder (after the due date)</Typography>
                {escalation.levels.map((level, index) => (
                  <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr', gap: 1, mb: 1.5 }}>
                    <PersonPicker mode="user" label={`Level ${index + 1} escalate to`} value={level.person}
                      onChange={(p) => setLevel(index, 'person', p)} />
                    <TextField fullWidth size="small" type="number" value={level.afterValue}
                      slotProps={{ htmlInput: { min: 0 } }}
                      onChange={(e) => setLevel(index, 'afterValue', e.target.value)} />
                    <TextField select fullWidth size="small" value={level.afterUnit}
                      onChange={(e) => setLevel(index, 'afterUnit', e.target.value)}>
                      {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                    </TextField>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Button size="small" variant="text" disabled={escalation.levels.length >= MAX_LEVELS}
                    onClick={() => setE('levels', [...escalation.levels,
                      { afterValue: 3, afterUnit: 'DAYS', targetType: 'MANAGER', person: null }])}>
                    + Add another level
                  </Button>
                  <Button size="small" variant="text" disabled={escalation.levels.length <= 1}
                    onClick={() => setE('levels', escalation.levels.slice(0, -1))}>
                    Remove last level
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  An empty “escalate to” falls back to the responsible person's manager, then the CCO.
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}
