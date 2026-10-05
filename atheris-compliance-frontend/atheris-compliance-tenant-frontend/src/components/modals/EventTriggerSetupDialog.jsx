import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { api } from '../../services/api';

export default function EventTriggerSetupDialog({ open, item, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ triggerLabel: '', deadlineMode: 'OFFSET', deadlineDays: '', deadlineUnit: 'WORKING' });
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) setForm({
      triggerLabel: item?.eventTriggerLabel || '',
      deadlineMode: item?.eventDeadlineMode || 'OFFSET',
      deadlineDays: item?.eventDeadlineDays == null ? '' : String(item.eventDeadlineDays),
      deadlineUnit: item?.eventDeadlineUnit || 'WORKING',
    });
  }, [open, item]);
  const mutation = useMutation({
    mutationFn: async ({ body }) => {
      const updated = await api.returns.configureEventTrigger(item.returnId, body);
      return { ...updated, ...body, eventTriggerConfigured: true };
    },
    onSuccess: updated => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      onSaved?.(updated);
    },
    onError: e => setError(e.message),
  });
  const save = () => {
    setError('');
    if (!form.triggerLabel.trim()) return setError('Enter the event or trigger name.');
    if (form.deadlineMode === 'OFFSET' && (!/^\d+$/.test(form.deadlineDays) || Number(form.deadlineDays) < 1 || Number(form.deadlineDays) > 365))
      return setError('Deadline days must be between 1 and 365.');
    mutation.mutate({ body: {
      triggerLabel: form.triggerLabel.trim(), deadlineMode: form.deadlineMode,
      deadlineDays: form.deadlineMode === 'OFFSET' ? Number(form.deadlineDays) : null,
      deadlineUnit: form.deadlineMode === 'OFFSET' ? form.deadlineUnit : null,
    } });
  };
  return (
    <Dialog open={open} onClose={() => !mutation.isPending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Configure event trigger</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {item?.deadlineText && <Alert severity="info" sx={{ mb: 2 }}>Source wording: {item.deadlineText}</Alert>}
        <TextField fullWidth required size="small" label="Trigger" value={form.triggerLabel} sx={{ mb: 2 }}
          placeholder="e.g. Salary payment, request received, incident occurrence"
          onChange={e => setForm(f => ({ ...f, triggerLabel: e.target.value }))} />
        <TextField select fullWidth size="small" label="Deadline rule" value={form.deadlineMode} sx={{ mb: 2 }}
          onChange={e => setForm(f => ({ ...f, deadlineMode: e.target.value }))}>
          <MenuItem value="OFFSET">Due a number of days after the trigger</MenuItem>
          <MenuItem value="MANUAL">Enter the due date from each request/directive</MenuItem>
        </TextField>
        {form.deadlineMode === 'OFFSET' && (
          <>
            <TextField fullWidth size="small" type="number" label="Days after trigger" value={form.deadlineDays} sx={{ mb: 2 }}
              inputProps={{ min: 1, max: 365 }} onChange={e => setForm(f => ({ ...f, deadlineDays: e.target.value }))} />
            <TextField select fullWidth size="small" label="Day counting" value={form.deadlineUnit}
              onChange={e => setForm(f => ({ ...f, deadlineUnit: e.target.value }))}>
              <MenuItem value="WORKING">Working days (weekends + configured federal holidays skipped)</MenuItem>
              <MenuItem value="CALENDAR">Calendar days</MenuItem>
            </TextField>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={mutation.isPending}>
          {mutation.isPending ? <CircularProgress size={18} /> : 'Save trigger'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
