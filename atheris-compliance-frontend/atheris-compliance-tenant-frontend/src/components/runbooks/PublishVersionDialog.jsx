import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  List, ListItem, ListItemText, TextField, Typography,
} from '@mui/material';
import { StatusBadge } from 'shared';
import { api } from '../../services/api';
import { errMsg } from './LibraryBadges';

/**
 * M9 — Publish Version (LOW / MEDIUM runbooks only; HIGH / CRITICAL go through submit → approve).
 * Runs POST …/versions/{vid}/lint for the summary, then POST …/versions/{vid}/publish { changeSummary }.
 */
export default function PublishVersionDialog({ open, onClose, runbookId, versionId, onPublished }) {
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');
  const [touched, setTouched] = useState(false);

  const lintQuery = useQuery({
    queryKey: ['runbook', String(runbookId), 'lint', String(versionId)],
    queryFn: () => api.runbooks.versions.lint(runbookId, versionId),
    enabled: open && versionId != null,
    staleTime: 0,
    gcTime: 0,
  });
  const lint = lintQuery.data;
  const lintErrors = lint?.errors ?? 0;
  const summaryError = summary.trim().length < 10 ? 'Change summary must be at least 10 characters' : '';

  const mutation = useMutation({
    mutationFn: () => api.runbooks.versions.publish(runbookId, versionId, { changeSummary: summary.trim() }),
    onSuccess: (v) => {
      queryClient.invalidateQueries({ queryKey: ['runbook', String(runbookId)] });
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      onPublished?.(v);
      handleClose();
    },
  });

  function handleClose() {
    setSummary(''); setTouched(false); mutation.reset();
    onClose();
  }

  const submit = () => {
    setTouched(true);
    if (!summaryError && lintErrors === 0) mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Publish version</DialogTitle>
      <DialogContent dividers>
        {mutation.error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(mutation.error)}</Alert>}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Lint check</Typography>
        {lintQuery.isPending && <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={22} /></Box>}
        {lintQuery.error && <Alert severity="warning" sx={{ mb: 2 }}>Could not lint this version: {lintQuery.error.message}</Alert>}
        {lint && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <StatusBadge label={`${lint.errors ?? 0} errors`} tone={lint.errors ? 'red' : 'green'} />
              <StatusBadge label={`${lint.warnings ?? 0} warnings`} tone={lint.warnings ? 'orange' : 'gray'} />
            </Box>
            {(lint.issues || []).length > 0 && (
              <List dense disablePadding sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {lint.issues.map((i, idx) => (
                  <ListItem key={`${i.rule}-${idx}`} disableGutters>
                    <ListItemText
                      primary={`${i.severity === 'ERROR' ? 'Error' : 'Warning'} ${i.rule}${i.stepCode ? ` · step ${i.stepCode}` : ''}`}
                      secondary={i.message}
                      slotProps={{ primary: { variant: 'body2', color: i.severity === 'ERROR' ? 'error' : 'warning.main' } }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {lintErrors > 0 && (
              <Alert severity="error" sx={{ mt: 1 }}>Fix the lint errors in the builder before publishing.</Alert>
            )}
          </Box>
        )}

        <TextField fullWidth multiline minRows={3} size="small" label="Change summary" required value={summary}
          onChange={(e) => setSummary(e.target.value)} error={touched && !!summaryError}
          helperText={touched && summaryError ? summaryError : 'Recorded on the version and in the audit trail'} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Publishing makes this the executable version; the previous published version becomes superseded
          (running executions continue on it).
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={submit}
          disabled={mutation.isPending || lintQuery.isPending || lintErrors > 0}>
          {mutation.isPending ? 'Publishing…' : 'Publish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
