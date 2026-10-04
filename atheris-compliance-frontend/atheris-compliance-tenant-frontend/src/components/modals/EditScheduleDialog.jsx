import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, RadioGroup, Radio, FormControlLabel,
} from '@mui/material';
import { api } from '../../services/api';
import {
  FREQUENCIES, NO_RULE, frequencyLabel, prepDaysError, ruleError,
} from './scheduleRules';

function initialForm(item) {
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

function validate(form) {
  if (!form.frequency) return 'Choose a frequency.';
  const prepErr = prepDaysError(form.prepDays);
  if (prepErr) return prepErr;
  if (NO_RULE.includes(form.frequency)) return '';
  return ruleError(form.frequency, form.ruleType, form.firstDueDate, form.daysAfterPeriodEnd);
}

function buildBody(form) {
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

export default function EditScheduleDialog({ open, onClose, item, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialForm(item));
  const [clientError, setClientError] = useState('');

  const mutation = useMutation({
    mutationFn: (body) => api.returns.updateSchedule(item.returnId, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.(updated);
    },
  });

  useEffect(() => {
    if (open) {
      setForm(initialForm(item));
      setClientError('');
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.returnId]);

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'frequency' && v === 'Biennial') next.ruleType = 'DATE';
    return next;
  });

  const showRule = form.frequency && !NO_RULE.includes(form.frequency);

  function handleSave() {
    const err = validate(form);
    setClientError(err);
    if (err) return;
    mutation.mutate(buildBody(form));
  }

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  const errorMsg = clientError || (mutation.isError ? (mutation.error?.message || 'Failed to save schedule.') : '');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Edit schedule
        {item?.returnName && (
          <Typography variant="body2" color="text.secondary">{item.returnName}</Typography>
        )}
      </DialogTitle>
      <Divider />
      <DialogContent>
        {item?.deadlineText && (
          <Alert severity="info" sx={{ mb: 2 }}>Regulator wording: {item.deadlineText}</Alert>
        )}
        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

        <TextField select fullWidth size="small" label="Frequency" value={form.frequency}
          onChange={e => set('frequency', e.target.value)} sx={{ mb: 2 }}>
          {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
        </TextField>

        {showRule && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
              Due rule
            </Typography>
            <RadioGroup row value={form.ruleType} onChange={e => set('ruleType', e.target.value)} sx={{ mb: 1 }}>
              <FormControlLabel value="DATE" control={<Radio size="small" />} label="Fixed date" />
              <FormControlLabel value="OFFSET" control={<Radio size="small" />} label="Days after period end"
                disabled={form.frequency === 'Biennial'} />
            </RadioGroup>

            {form.ruleType === 'DATE' ? (
              <TextField fullWidth size="small" type="date" label="First due date" value={form.firstDueDate}
                onChange={e => set('firstDueDate', e.target.value)}
                helperText="Sets the filing cycle — e.g. Annual + 31 Mar is due every 31 March."
                slotProps={{ inputLabel: { shrink: true } }} sx={{ mb: 2 }} />
            ) : (
              <TextField fullWidth size="small" type="number" label="Days after period end"
                value={form.daysAfterPeriodEnd}
                onChange={e => set('daysAfterPeriodEnd', e.target.value)}
                helperText="Monthly: 1–28; Quarterly, Semi-Annual, Annual: 1–365"
                slotProps={{ htmlInput: { min: 1, max: form.frequency === 'Monthly' ? 28 : 365 } }}
                sx={{ mb: 2 }} />
            )}
          </>
        )}

        <TextField fullWidth size="small" type="number" label="Prep days" value={form.prepDays}
          onChange={e => set('prepDays', e.target.value)}
          helperText="Days before the due date that work on a period starts."
          slotProps={{ htmlInput: { min: 0 } }} />

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Saving rebuilds periods nobody has worked on; periods with work are kept.
          </Typography>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}>
          Save schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
}
