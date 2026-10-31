import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import OwnerPicker from '../org/OwnerPicker';
import { api } from '../../services/api';

const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Directive'];
const RISKS = ['Critical', 'High', 'Moderate', 'Low'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const DEFAULT_POLICY = '';

const TABS = { DETAILS: 0, SCHEDULE: 1, ESCALATION: 2, RESPONSIBILITY: 3 };

function initialForm(control) {
  return {
    name: control?.name || '',
    description: control?.description || '',
    controlType: control?.controlType || '',
    inherentRisk: control?.inherentRisk || '',
    whatItDoes: control?.whatItDoes || '',
    howTested: control?.howTested || '',
    testFrequency: control?.testFrequency || control?.frequency || '',
    testFrequencyDays: control?.testFrequencyDays != null ? String(control.testFrequencyDays) : '',
    controlOwnerId: control?.controlOwnerId ?? null,
    testerOwnerId: control?.testerOwnerId ?? null,
    escalationPolicyId: control?.escalationPolicyId != null ? String(control.escalationPolicyId) : DEFAULT_POLICY,
  };
}

function body(form) {
  const out = {
    name: form.name.trim(),
    description: form.description,
    controlType: form.controlType,
    inherentRisk: form.inherentRisk,
    whatItDoes: form.whatItDoes,
    howTested: form.howTested,
    testFrequency: form.testFrequency,
    testFrequencyDays: form.testFrequencyDays === '' ? null : Number(form.testFrequencyDays),
    controlOwnerId: form.controlOwnerId || null,
    testerOwnerId: form.testerOwnerId || null,
    escalationPolicyId: form.escalationPolicyId === DEFAULT_POLICY ? null : Number(form.escalationPolicyId),
  };
  return out;
}

export default function ControlEditDialog({ open, control, onClose, onSaved, onSnackbar }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(TABS.DETAILS);
  const [form, setForm] = useState(() => initialForm(control));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const policiesQuery = useQuery({
    queryKey: ['escalation', 'policies', 'CONTROL', 'templates'],
    queryFn: ({ signal }) => api.escalation.policies('CONTROL', { defaultsOnly: true }, { signal }),
    enabled: open,
  });
  const policies = policiesQuery.data || [];

  useEffect(() => {
    if (!open) return;
    setTab(TABS.DETAILS);
    setForm(initialForm(control));
    setError('');
  }, [open, control]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) { setError('Control name is required.'); setTab(TABS.DETAILS); return; }
    setSaving(true);
    setError('');
    try {
      await api.controls.update(control.controlId, body(form));
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
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <TextField select fullWidth size="small" label="Control type" value={form.controlType}
                onChange={(e) => set('controlType', e.target.value)}>
                <MenuItem value=""><em>Not set</em></MenuItem>
                {CONTROL_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField select fullWidth size="small" label="Inherent risk" value={form.inherentRisk}
                onChange={(e) => set('inherentRisk', e.target.value)}>
                <MenuItem value=""><em>Not set</em></MenuItem>
                {RISKS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
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
          </>
        )}

        {tab === TABS.ESCALATION && (
          <>
            <TextField select fullWidth size="small" label="Escalation policy" value={form.escalationPolicyId}
              onChange={(e) => set('escalationPolicyId', e.target.value)} sx={{ mb: 2 }}>
              <MenuItem value={DEFAULT_POLICY}>Follow the tenant default for controls</MenuItem>
              {policies.map((p) => (
                <MenuItem key={p.policyId} value={String(p.policyId)}>
                  {p.name}{p.frequencyScope ? ` (${p.frequencyScope.toLowerCase()})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" color="text.secondary">
              Controls the reminder lead (before the due date) and the escalation ladder after it. Edit the
              templates in Settings → Notifications; the responsible person is chased, the owner is copied.
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
                Responsible person (tester)
              </Typography>
              <OwnerPicker value={form.testerOwnerId} onChange={(id) => set('testerOwnerId', id)}
                label="Who performs the test" />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Owner (analyst)
            </Typography>
            <OwnerPicker value={form.controlOwnerId} onChange={(id) => set('controlOwnerId', id)}
              label="Compliance owner" />
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
