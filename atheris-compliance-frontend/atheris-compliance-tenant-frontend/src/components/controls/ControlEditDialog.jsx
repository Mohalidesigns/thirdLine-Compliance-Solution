import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import OwnerPicker from '../org/OwnerPicker';
import PersonPicker from '../common/PersonPicker';
import { api } from '../../services/api';

const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Directive'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const DEFAULT_POLICY = '';

const TABS = { DETAILS: 0, SCHEDULE: 1, ESCALATION: 2, RESPONSIBILITY: 3 };

function initialForm(control) {
  return {
    name: control?.name || '',
    description: control?.description || '',
    theme: control?.theme || '',
    controlType: control?.controlType || '',
    whatItDoes: control?.whatItDoes || '',
    howTested: control?.howTested || '',
    testFrequency: control?.testFrequency || control?.frequency || '',
    testFrequencyDays: control?.testFrequencyDays != null ? String(control.testFrequencyDays) : '',
    firstDueDate: control?.firstDueDate || '',
    controlOwnerId: control?.controlOwnerId ?? null,
    testerOwnerId: control?.testerOwnerId ?? null,
    escalationPolicyId: control?.escalationPolicyId != null ? String(control.escalationPolicyId) : DEFAULT_POLICY,
    reminderStartValue: '', reminderStartUnit: 'DAYS',
    reminderRepeatValue: '', reminderRepeatUnit: 'DAYS',
    escLevels: [{ person: null, afterValue: '', afterUnit: 'DAYS' }],
  };
}

function levelsFromEscalation(config) {
  const rows = (config?.levels || []).map((l) => ({
    person: l.targetType === 'PERSON'
      ? { fullName: l.targetName || '', email: l.targetEmail || '', userId: l.targetUserId ?? null }
      : null,
    afterValue: l.afterValue != null ? String(l.afterValue) : '',
    afterUnit: l.afterUnit || 'DAYS',
  }));
  return rows.length ? rows : [{ person: null, afterValue: '', afterUnit: 'DAYS' }];
}

function levelsPayload(rows) {
  const out = [];
  let n = 1;
  for (const r of rows) {
    const blank = !r.person && String(r.afterValue).trim() === '';
    if (blank) continue;
    const afterValue = String(r.afterValue).trim() === '' ? 0 : Number(r.afterValue);
    if (r.person && (r.person.email || r.person.userId)) {
      out.push({ afterValue, afterUnit: r.afterUnit, targetType: 'PERSON',
        targetUserId: r.person.userId ? Number(r.person.userId) : null,
        targetName: r.person.fullName || null, targetEmail: r.person.email || null });
    } else {
      out.push({ afterValue, afterUnit: r.afterUnit, targetType: n === 1 ? 'MANAGER' : 'CCO' });
    }
    n += 1;
  }
  return out;
}

function body(form) {
  const out = {
    name: form.name.trim(),
    description: form.description,
    theme: form.theme || null,
    controlType: form.controlType,
    whatItDoes: form.whatItDoes,
    howTested: form.howTested,
    testFrequency: form.testFrequency,
    testFrequencyDays: form.testFrequencyDays === '' ? null : Number(form.testFrequencyDays),
    firstDueDate: form.firstDueDate || null,
    controlOwnerId: form.controlOwnerId || null,
    testerOwnerId: form.testerOwnerId || null,
    escalationPolicyId: form.escalationPolicyId === DEFAULT_POLICY ? null : Number(form.escalationPolicyId),
  };
  return out;
}

export default function ControlEditDialog({ open, control, onClose, onSaved, onSnackbar }) {
  const queryClient = useQueryClient();
  const qc = useQueryClient();
  const [tab, setTab] = useState(TABS.DETAILS);
  const [form, setForm] = useState(() => initialForm(control));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const themesQuery = useQuery({
    queryKey: ['control-themes', 'active'],
    queryFn: ({ signal }) => api.controlThemes.list({ signal }),
    enabled: open,
  });
  const themes = themesQuery.data || [];
  const [newTheme, setNewTheme] = useState('');
  const createTheme = useMutation({
    mutationFn: (name) => api.controlThemes.create({ name }),
    onSuccess: (created) => { set('theme', created?.name || ''); setNewTheme(''); qc.invalidateQueries({ queryKey: ['control-themes'] }); },
    onError: (e) => setError(e.message || 'Could not add the theme.'),
  });

  const escalationQuery = useQuery({
    queryKey: ['controls', 'escalation', control?.controlId],
    queryFn: ({ signal }) => api.controls.escalation(control.controlId, { signal }),
    enabled: open && !!control?.controlId,
  });
  const escalation = escalationQuery.data;
  const [escTouched, setEscTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(TABS.DETAILS);
    setForm(initialForm(control));
    setEscTouched(false);
    setError('');
  }, [open, control]);

  useEffect(() => {
    if (!escalation || escTouched) return;
    setForm((f) => ({
      ...f,
      reminderStartValue: escalation.reminderStartValue ?? '',
      reminderStartUnit: escalation.reminderStartUnit || 'DAYS',
      reminderRepeatValue: escalation.reminderRepeatValue ?? '',
      reminderRepeatUnit: escalation.reminderRepeatUnit || 'DAYS',
      escLevels: levelsFromEscalation(escalation),
    }));
  }, [escalation, escTouched]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) { setError('Control name is required.'); setTab(TABS.DETAILS); return; }
    setSaving(true);
    setError('');
    try {
      await api.controls.update(control.controlId, body(form));
      if (escTouched) {
        await api.controls.updateEscalation(control.controlId, {
          reminderStartValue: form.reminderStartValue === '' ? null : Number(form.reminderStartValue),
          reminderStartUnit: form.reminderStartUnit,
          reminderRepeatValue: form.reminderRepeatValue === '' ? null : Number(form.reminderRepeatValue),
          reminderRepeatUnit: form.reminderRepeatUnit,
          levels: levelsPayload(form.escLevels || []),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e.message || 'Failed to save the control.';
      setError(msg);
      onSnackbar?.(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!control) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit control</DialogTitle>
      <DialogContent sx={{ '&&': { pt: 1 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Details" />
          <Tab label="Testing schedule" />
          <Tab label="Escalation" />
          <Tab label="Responsibility" />
        </Tabs>

        {tab === TABS.DETAILS && (
          <>
            <TextField fullWidth size="small" label="Control name" value={form.name}
              onChange={(e) => set('name', e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" multiline minRows={2} label="Description" value={form.description}
              onChange={(e) => set('description', e.target.value)} sx={{ mb: 2 }} />
            <TextField select fullWidth size="small" label="Control type" value={form.controlType}
              onChange={(e) => set('controlType', e.target.value)} sx={{ mb: 2 }}>
              <MenuItem value=""><em>Not set</em></MenuItem>
              {CONTROL_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select fullWidth size="small" label="Theme" value={form.theme}
              onChange={(e) => set('theme', e.target.value)} SelectProps={{ native: true }} sx={{ mb: 1 }}>
              <option value="">No theme</option>
              {Array.from(new Set(themes.map((t) => t.name))).map((name) => <option key={name} value={name}>{name}</option>)}
            </TextField>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField size="small" placeholder="Add a new theme…" value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)} sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" disabled={!newTheme.trim() || createTheme.isPending}
                onClick={() => createTheme.mutate(newTheme.trim())}>Add</Button>
            </Box>
            <TextField fullWidth size="small" multiline minRows={2} label="What it does" value={form.whatItDoes}
              onChange={(e) => set('whatItDoes', e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" multiline minRows={2} label="How it's tested" value={form.howTested}
              onChange={(e) => set('howTested', e.target.value)} />
          </>
        )}

        {tab === TABS.SCHEDULE && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              How often this control is tested. The next test is scheduled from the day the last test is recorded.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField select fullWidth size="small" label="Test frequency" value={form.testFrequency}
                onChange={(e) => set('testFrequency', e.target.value)}>
                <MenuItem value=""><em>Not set</em></MenuItem>
                {FREQUENCIES.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
              <TextField fullWidth size="small" type="number" label="Interval (days)" value={form.testFrequencyDays}
                slotProps={{ htmlInput: { min: 1 } }}
                onChange={(e) => set('testFrequencyDays', e.target.value)}
                helperText="Leave blank to derive it from the frequency." />
            </Box>
            <TextField fullWidth size="small" type="date" label="First test due date" value={form.firstDueDate}
              onChange={(e) => set('firstDueDate', e.target.value)} sx={{ mt: 2 }}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Optional. Sets when the first test is due; later tests follow the frequency. Leave blank to schedule from today." />
          </>
        )}

        {tab === TABS.ESCALATION && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {escalation?.isDefault === false && escalation?.policyName
                ? `This control uses its own policy: ${escalation.policyName}.`
                : 'Defaults follow the test frequency. Change anything here to give this control its own rule.'}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Remind before</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                  <TextField fullWidth size="small" type="number" value={form.reminderStartValue}
                    slotProps={{ htmlInput: { min: 0 } }}
                    onChange={(e) => { setEscTouched(true); set('reminderStartValue', e.target.value); }} />
                  <TextField select fullWidth size="small" value={form.reminderStartUnit}
                    onChange={(e) => { setEscTouched(true); set('reminderStartUnit', e.target.value); }}>
                    <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
                  </TextField>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Remind after every</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                  <TextField fullWidth size="small" type="number" value={form.reminderRepeatValue}
                    slotProps={{ htmlInput: { min: 0 } }}
                    onChange={(e) => { setEscTouched(true); set('reminderRepeatValue', e.target.value); }} />
                  <TextField select fullWidth size="small" value={form.reminderRepeatUnit}
                    onChange={(e) => { setEscTouched(true); set('reminderRepeatUnit', e.target.value); }}>
                    <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
                  </TextField>
                </Box>
              </Box>
            </Box>

            {(form.escLevels || []).map((level, index) => (
              <Box key={index} sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Level {index + 1}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr', gap: 1 }}>
                  <PersonPicker mode="user" label={`Level ${index + 1} escalate to`} value={level.person}
                    onChange={(p) => { setEscTouched(true); set('escLevels', form.escLevels.map((l, i) => i === index ? { ...l, person: p } : l)); }} />
                  <TextField label="After" fullWidth size="small" type="number" value={level.afterValue}
                    slotProps={{ htmlInput: { min: 0 } }} placeholder="0"
                    onChange={(e) => { setEscTouched(true); set('escLevels', form.escLevels.map((l, i) => i === index ? { ...l, afterValue: e.target.value } : l)); }} />
                  <TextField select label="Unit" fullWidth size="small" value={level.afterUnit}
                    onChange={(e) => { setEscTouched(true); set('escLevels', form.escLevels.map((l, i) => i === index ? { ...l, afterUnit: e.target.value } : l)); }}>
                    <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
                  </TextField>
                </Box>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              {(form.escLevels || []).length < 3 && (
                <Button size="small" variant="text" onClick={() => {
                  setEscTouched(true);
                  set('escLevels', [...(form.escLevels || []), { person: null, afterValue: '', afterUnit: 'DAYS' }]);
                }}>+ Add level</Button>
              )}
              {(form.escLevels || []).length > 1 && (
                <Button size="small" variant="text" onClick={() => {
                  setEscTouched(true);
                  set('escLevels', (form.escLevels || []).slice(0, -1));
                }}>Remove level {(form.escLevels || []).length}</Button>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>After the due date.</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              An empty “escalate to” falls back to the tester's manager, then the CCO.
            </Typography>
          </>
        )}

        {tab === TABS.RESPONSIBILITY && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The responsible person performs the test and receives the test link and reminders. The owner is
              the analyst accountable for the control and is copied on those emails.
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Tester
              </Typography>
              <OwnerPicker value={form.testerOwnerId} onChange={(id) => set('testerOwnerId', id)}
                label="Who performs the test" />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Control owner
            </Typography>
            <OwnerPicker value={form.controlOwnerId} onChange={(id) => set('controlOwnerId', id)}
              label="Control owner" />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
