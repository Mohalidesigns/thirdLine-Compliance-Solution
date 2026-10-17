import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem,
  Switch, TextField,
} from '@mui/material';
import { api } from '../../services/api';
import { FREQUENCIES, STEP_ROLES, humanize } from '../../pages/runbooks/runbookConstants';
import { errMsg } from './LibraryBadges';

const SCHEDULABLE = FREQUENCIES.filter((f) => f.value !== 'ON_DEMAND' && f.value !== 'EVENT_DRIVEN');

const todayIso = () => new Date().toISOString().slice(0, 10);

function initialForm(schedule, runbook) {
  if (schedule) {
    return {
      frequency: schedule.frequency || 'MONTHLY',
      firstRunDate: schedule.nextRunAt ? String(schedule.nextRunAt).slice(0, 10) : todayIso(),
      leadDays: schedule.leadDays ?? 0,
      assigneeUserId: schedule.assigneeUserId ?? '',
      assigneeRole: schedule.assigneeRole || '',
      skipHolidays: !!schedule.skipHolidays,
      active: schedule.active !== false,
    };
  }
  const freq = SCHEDULABLE.some((f) => f.value === runbook?.frequency) ? runbook.frequency : 'MONTHLY';
  return {
    frequency: freq, firstRunDate: todayIso(), leadDays: 3, assigneeUserId: runbook?.ownerUserId ?? '',
    assigneeRole: '', skipHolidays: true, active: true,
  };
}

/**
 * M22 — Schedule Runbook (create or edit). POST/PUT /runbooks/{id}/schedules[/{sid}] with
 * ScheduleRequest { frequency, firstRunDate, leadDays, assigneeUserId, assigneeRole, skipHolidays, active }.
 */
export default function ScheduleRunbookDialog({ open, onClose, runbook, schedule, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialForm(schedule, runbook));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setForm(initialForm(schedule, runbook)); setTouched(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reseed only on open, not on parent refetch

  const usersQuery = useQuery({
    queryKey: ['runbooks', 'assignees'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const users = (usersQuery.data || []).filter((u) => u.active !== false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dateError = !form.firstRunDate ? 'First run date is required'
    : (!schedule && form.firstRunDate < todayIso() ? 'First run date cannot be in the past' : '');
  const leadError = form.leadDays !== '' && (!/^\d+$/.test(String(form.leadDays)) || Number(form.leadDays) > 90)
    ? 'Lead days must be 0–90' : '';

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        frequency: form.frequency,
        firstRunDate: form.firstRunDate,
        leadDays: form.leadDays === '' ? 0 : Number(form.leadDays),
        assigneeUserId: form.assigneeUserId === '' ? null : Number(form.assigneeUserId),
        assigneeRole: form.assigneeRole || null,
        skipHolidays: form.skipHolidays,
        active: form.active,
      };
      return schedule
        ? api.runbooks.schedules.update(runbook.runbookId, schedule.scheduleId, body)
        : api.runbooks.schedules.create(runbook.runbookId, body);
    },
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['runbook', String(runbook.runbookId)] });
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      onSaved?.(s);
      mutation.reset();
      onClose();
    },
  });

  const submit = () => {
    setTouched(true);
    if (!dateError && !leadError) mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{schedule ? 'Edit schedule' : 'Schedule runbook'}</DialogTitle>
      <DialogContent dividers>
        {mutation.error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(mutation.error)}</Alert>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Frequency" required value={form.frequency}
              onChange={set('frequency')}>
              {SCHEDULABLE.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" type="date" label={schedule ? 'Next run date' : 'First run date'} required
              value={form.firstRunDate} onChange={set('firstRunDate')}
              error={touched && !!dateError} helperText={touched ? dateError : ''}
              slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" type="number" label="Lead days" value={form.leadDays}
              onChange={set('leadDays')} error={!!leadError}
              helperText={leadError || 'Days before the run date the execution is created'} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Assignee" value={form.assigneeUserId}
              onChange={set('assigneeUserId')}>
              <MenuItem value="">Runbook owner</MenuItem>
              {users.map((u) => <MenuItem key={u.userId} value={u.userId}>{u.fullName || u.email}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Assignee role (optional)" value={form.assigneeRole}
              onChange={set('assigneeRole')}>
              <MenuItem value="">—</MenuItem>
              {STEP_ROLES.map((r) => <MenuItem key={r} value={r}>{humanize(r)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
            <FormControlLabel
              control={<Switch checked={form.skipHolidays} onChange={(e) => setForm((f) => ({ ...f, skipHolidays: e.target.checked }))} />}
              label="Skip public holidays" />
            {schedule && (
              <FormControlLabel
                control={<Switch checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />}
                label="Active" />
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : (schedule ? 'Save schedule' : 'Create schedule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
