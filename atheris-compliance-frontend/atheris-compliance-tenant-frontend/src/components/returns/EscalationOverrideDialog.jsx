import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Grid, Checkbox, FormControlLabel, Typography, Alert, CircularProgress, Divider, Box,
} from '@mui/material';
import { api } from '../../services/api';

const UNITS = [
  { value: 'DAYS', label: 'Days' },
  { value: 'HOURS', label: 'Hours' },
];
const TARGETS = [
  { value: 'ASSIGNEE', label: 'Responsible person' },
  { value: 'MANAGER', label: "Person's manager" },
  { value: 'MANAGER_OF_MANAGER', label: "Manager's manager" },
  { value: 'PERSON', label: 'A specific person' },
  { value: 'ROLE', label: 'Everyone in a role' },
];
const ROLES = ['TENANT_ADMIN', 'CCO', 'ANALYST', 'AUDITOR', 'IT_OPS'];

function normalizeLevels(levels, count = 3) {
  const byNo = new Map((levels || []).map((l) => [l.levelNo, l]));
  return Array.from({ length: count }, (_, i) => byNo.get(i + 1) || {
    levelNo: i + 1, afterValue: i === 0 ? 0 : 3, afterUnit: 'DAYS',
    targetType: i === 0 ? 'ASSIGNEE' : (i === 1 ? 'MANAGER' : 'MANAGER_OF_MANAGER'),
  });
}

export default function EscalationOverrideDialog({ open, instanceId, onClose, onSnackbar }) {
  const qc = useQueryClient();
  const [policyId, setPolicyId] = useState('');

  const instanceQuery = useQuery({
    queryKey: ['escalation', 'instance', 'RETURN', String(instanceId)],
    queryFn: () => api.escalation.instance('RETURN', instanceId),
    enabled: open && instanceId != null,
  });
  const policiesQuery = useQuery({
    queryKey: ['escalation', 'policies', 'RETURN'],
    queryFn: () => api.escalation.policies('RETURN'),
    enabled: open,
  });

  const data = instanceQuery.data;
  const policies = Array.isArray(policiesQuery.data) ? policiesQuery.data : [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['escalation', 'instance', 'RETURN', String(instanceId)] });
  const saveMut = useMutation({
    mutationFn: (body) => api.escalation.saveInstance('RETURN', instanceId, body),
    onSuccess: () => { invalidate(); onSnackbar?.('Escalation saved for this filing.'); onClose(); },
    onError: (e) => onSnackbar?.(e.message),
  });
  const reapplyMut = useMutation({
    mutationFn: (pid) => api.escalation.reapply('RETURN', instanceId, pid),
    onSuccess: () => { invalidate(); onSnackbar?.('Policy applied to this filing.'); },
    onError: (e) => onSnackbar?.(e.message),
  });
  const resetMut = useMutation({
    mutationFn: () => api.escalation.deleteInstance('RETURN', instanceId),
    onSuccess: () => { invalidate(); onSnackbar?.('Override removed — using the return policy.'); onClose(); },
    onError: (e) => onSnackbar?.(e.message),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Escalation for this filing</DialogTitle>
      <DialogContent>
        {instanceQuery.isPending ? <CircularProgress size={22} /> : !data ? (
          <Alert severity="info">No escalation policy is configured for this filing yet.</Alert>
        ) : (
          <>
            <Alert severity={data.overrideId != null ? 'warning' : 'info'} sx={{ mb: 2 }}>
              {data.overrideId != null
                ? 'This filing has its own escalation settings (a copy taken when it was created, edited here).'
                : 'This filing uses the return’s escalation policy. Editing below creates settings for this filing only.'}
            </Alert>

            <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Grid size={{ xs: 8 }}>
                <TextField select fullWidth size="small" label="Reapply a policy" value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}>
                  {(policies || []).map((p) => <MenuItem key={p.policyId} value={String(p.policyId)}>{p.name}{p.isDefault ? ' (default)' : ''}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Button variant="outlined" disabled={!policyId || reapplyMut.isPending}
                  onClick={() => reapplyMut.mutate(Number(policyId))}>
                  {reapplyMut.isPending ? 'Applying…' : 'Reapply'}
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <OverrideForm key={`${data.overrideId ?? 'p'}-${data.sourcePolicyId ?? ''}`} initial={data}
              saving={saveMut.isPending} onCancel={onClose}
              onSave={(body) => saveMut.mutate(body)}
              onReset={data.overrideId != null ? () => resetMut.mutate() : null}
              resetting={resetMut.isPending} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OverrideForm({ initial, saving, onSave, onCancel, onReset, resetting }) {
  const [form, setForm] = useState({
    reminderStartValue: initial.reminderStartValue ?? '',
    reminderStartUnit: initial.reminderStartUnit || 'DAYS',
    reminderRepeatValue: initial.reminderRepeatValue ?? '',
    reminderRepeatUnit: initial.reminderRepeatUnit || 'DAYS',
    sendLink: initial.sendLink !== false,
    levels: normalizeLevels(initial.levels),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLevel = (i, k, v) => setForm((f) => {
    const levels = [...f.levels];
    levels[i] = { ...levels[i], [k]: v };
    return { ...f, levels };
  });

  const submit = () => onSave({
    reminderStartValue: form.reminderStartValue === '' ? null : Number(form.reminderStartValue),
    reminderStartUnit: form.reminderStartUnit,
    reminderRepeatValue: form.reminderRepeatValue === '' ? null : Number(form.reminderRepeatValue),
    reminderRepeatUnit: form.reminderRepeatUnit,
    sendLink: form.sendLink,
    active: true,
    levels: form.levels.map((l) => ({
      levelNo: l.levelNo,
      afterValue: l.afterValue === '' ? 0 : Number(l.afterValue),
      afterUnit: l.afterUnit,
      targetType: l.targetType,
      targetRole: l.targetRole,
      targetName: l.targetName,
      targetEmail: l.targetEmail,
      targetUserId: l.targetUserId,
    })),
  });

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 3 }}>
          <TextField label="Remind before due" type="number" fullWidth size="small"
            slotProps={{ htmlInput: { min: 0 } }}
            value={form.reminderStartValue} onChange={(e) => set('reminderStartValue', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 3 }}>
          <TextField select label="Unit" fullWidth size="small" value={form.reminderStartUnit}
            onChange={(e) => set('reminderStartUnit', e.target.value)}>
            {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <TextField label="Repeat every" type="number" fullWidth size="small"
            slotProps={{ htmlInput: { min: 0 } }}
            value={form.reminderRepeatValue} onChange={(e) => set('reminderRepeatValue', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 3 }}>
          <TextField select label="Repeat unit" fullWidth size="small" value={form.reminderRepeatUnit}
            onChange={(e) => set('reminderRepeatUnit', e.target.value)}>
            {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant="overline" color="text.secondary">Escalation levels (after the due date)</Typography>
        </Grid>
        {form.levels.map((l, i) => (
          <Grid size={{ xs: 12 }} key={i}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 1 }}><TextField label="Lvl" size="small" fullWidth value={l.levelNo} disabled /></Grid>
              <Grid size={{ xs: 2 }}>
                <TextField label="After" type="number" size="small" fullWidth value={l.afterValue}
                  slotProps={{ htmlInput: { min: 0 } }}
                  onChange={(e) => setLevel(i, 'afterValue', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 2 }}>
                <TextField select label="Unit" size="small" fullWidth value={l.afterUnit}
                  onChange={(e) => setLevel(i, 'afterUnit', e.target.value)}>
                  {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <TextField select label="Notify" size="small" fullWidth value={l.targetType}
                  onChange={(e) => setLevel(i, 'targetType', e.target.value)}>
                  {TARGETS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
              </Grid>
              {l.targetType === 'ROLE' && (
                <Grid size={{ xs: 4 }}>
                  <TextField select label="Role" size="small" fullWidth value={l.targetRole || ''}
                    onChange={(e) => setLevel(i, 'targetRole', e.target.value)}>
                    {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                </Grid>
              )}
              {l.targetType === 'PERSON' && (
                <>
                  <Grid size={{ xs: 2 }}>
                    <TextField label="Name" size="small" fullWidth value={l.targetName || ''}
                      onChange={(e) => setLevel(i, 'targetName', e.target.value)} />
                  </Grid>
                  <Grid size={{ xs: 2 }}>
                    <TextField label="Email" size="small" fullWidth value={l.targetEmail || ''}
                      onChange={(e) => setLevel(i, 'targetEmail', e.target.value)} />
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>
        ))}

        <Grid size={{ xs: 12 }}>
          <FormControlLabel control={<Checkbox checked={form.sendLink} onChange={(e) => set('sendLink', e.target.checked)} />}
            label="Include a filing link in reminders" />
        </Grid>
      </Grid>

      <DialogActions sx={{ px: 0 }}>
        {onReset && <Button color="warning" onClick={onReset} disabled={resetting}>{resetting ? 'Resetting…' : 'Use return policy'}</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save for this filing'}</Button>
      </DialogActions>
    </>
  );
}
