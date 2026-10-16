import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { TRIGGER_TYPES, humanize, formatMinutes } from '../../pages/runbooks/runbookConstants';
import { errMsg } from './LibraryBadges';

/**
 * M11 — Start Execution. POST /runbooks/{id}/executions
 * { versionId, triggerType, triggerRefId?, operatorUserId?, dueAt? } → ExecutionDetailDto,
 * then opens the execution console.
 */
export default function StartExecutionDialog({ open, onClose, runbook }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [triggerType, setTriggerType] = useState('MANUAL');
  const [triggerRefId, setTriggerRefId] = useState('');
  const [operatorUserId, setOperatorUserId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const usersQuery = useQuery({
    queryKey: ['runbooks', 'assignees'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const users = (usersQuery.data || []).filter((u) => u.active !== false);
  const operator = operatorUserId === '' ? (user?.userId ?? '') : operatorUserId;
  const hasSla = runbook?.slaMinutes != null;

  const refError = triggerRefId !== '' && !/^\d+$/.test(triggerRefId) ? 'Enter the numeric id of the incident / finding / review' : '';
  const dueError = dueAt && new Date(dueAt) <= new Date() ? 'Due date must be in the future' : '';

  const mutation = useMutation({
    mutationFn: () => api.runbooks.executions.start(runbook.runbookId, {
      versionId: runbook.currentVersionId,
      triggerType,
      triggerRefId: triggerRefId === '' ? null : Number(triggerRefId),
      operatorUserId: operator === '' ? null : Number(operator),
      dueAt: !hasSla && dueAt ? new Date(dueAt).toISOString() : null,
    }),
    onSuccess: (exec) => {
      queryClient.invalidateQueries({ queryKey: ['runbook', String(runbook.runbookId)] });
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      handleClose();
      if (exec?.executionId != null) navigate(`/runbooks/executions/${exec.executionId}`);
    },
  });

  function handleClose() {
    setTriggerType('MANUAL'); setTriggerRefId(''); setOperatorUserId(''); setDueAt('');
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Start execution</DialogTitle>
      <DialogContent dividers>
        {mutation.error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(mutation.error)}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {runbook?.runbookCode} — runs the published version
          {runbook?.currentVersionNumber != null ? ` v${runbook.currentVersionNumber}` : ''}.
          {hasSla ? ` SLA ${formatMinutes(runbook.slaMinutes)} applies.` : ''}
          {' '}Prerequisites are acknowledged in the console before the first step.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Trigger" value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}>
              {TRIGGER_TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" label="Trigger reference id" value={triggerRefId}
              onChange={(e) => setTriggerRefId(e.target.value.trim())}
              disabled={triggerType === 'MANUAL' || triggerType === 'SCHEDULED'}
              error={!!refError} helperText={refError || 'Incident / finding / review id (optional)'} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField select fullWidth size="small" label="Operator" value={operator}
              onChange={(e) => setOperatorUserId(e.target.value)}>
              {users.map((u) => (
                <MenuItem key={u.userId} value={u.userId}>
                  {u.fullName || u.email}{u.userId === user?.userId ? ' (me)' : ''}{u.role ? ` — ${humanize(u.role)}` : ''}
                </MenuItem>
              ))}
              {!users.some((u) => u.userId === operator) && operator !== '' && (
                <MenuItem value={operator}>Me</MenuItem>
              )}
            </TextField>
          </Grid>
          {!hasSla && (
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" type="datetime-local" label="Due (override)" value={dueAt}
                onChange={(e) => setDueAt(e.target.value)} error={!!dueError}
                helperText={dueError || 'This runbook has no SLA — optionally set a due date for this run'}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !runbook?.currentVersionId || !!refError || !!dueError}>
          {mutation.isPending ? 'Starting…' : 'Start execution'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
