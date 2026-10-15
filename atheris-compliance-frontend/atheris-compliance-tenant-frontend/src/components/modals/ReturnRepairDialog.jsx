import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TablePagination,
  CircularProgress, Tooltip,
} from '@mui/material';
import { ChevronRightIcon, StatusBadge } from 'shared';
import { api } from '../../services/api';

const PAGE_SIZE = 25;

const TYPE_LABELS = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  BIENNIAL: 'Biennial',
  EVENT_DRIVEN: 'Event-driven',
};

function typeLabel(t) {
  if (!t) return 'None';
  if (TYPE_LABELS[t]) return TYPE_LABELS[t];
  return String(t).toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

const SOURCE_LABELS = { platform: 'Platform', frequency_text: 'From text' };


export default function ReturnRepairDialog({ open, onClose, preview }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const mutation = useMutation({
    mutationFn: () => api.returns.frequencyRepairApply(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const items = preview?.items || [];
  const toRetype = preview?.toRetype ?? 0;
  const toReschedule = preview?.toReschedule ?? 0;
  const toRepair = items.length;
  const result = mutation.data;
  const done = mutation.isSuccess;

  function handleClose() {
    if (mutation.isPending) return;
    mutation.reset();
    setPage(0);
    onClose();
  }

  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Repair return schedules</DialogTitle>
      <DialogContent dividers>
        {done ? (
          <Alert severity="success">
            Repair complete: {result?.retyped ?? 0} return{result?.retyped === 1 ? '' : 's'} retyped,{' '}
            {result?.rescheduled ?? 0} rescheduled, {result?.instancesRemoved ?? 0} period{result?.instancesRemoved === 1 ? '' : 's'} removed,{' '}
            {result?.instancesKept ?? 0} kept, {result?.instancesCreated ?? 0} created on the correct cycle.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <StatusBadge label={`To retype ${toRetype}`} tone="orange" />
              <StatusBadge label={`To reschedule ${toReschedule}`} tone="amber" />
              <StatusBadge label={`Periods to remove ${preview?.instancesToRemove ?? 0}`} tone="red" />
              <StatusBadge label={`Periods kept ${preview?.instancesKept ?? 0}`} tone="green" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Frequency types and due rules are corrected; frequency text is kept. Periods nobody has worked on
              are removed and rebuilt on the correct cycle. Periods with any work are kept.
            </Typography>

            {mutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {mutation.error?.message || 'Repair failed.'}
              </Alert>
            )}

            <Paper variant="outlined">
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 220 }}>Return</TableCell>
                      <TableCell sx={{ minWidth: 190 }}>Frequency</TableCell>
                      <TableCell sx={{ minWidth: 200 }}>Due date</TableCell>
                      <TableCell sx={{ minWidth: 110 }}>Periods</TableCell>
                      <TableCell sx={{ minWidth: 90 }}>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageItems.map(it => (
                      <TableRow key={it.returnId} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main' }}>{it.returnName}</Typography>
                          <Typography variant="caption" color="text.secondary">{it.regulator || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{it.frequency || '-'}</Typography>
                          {it.typeChanged && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <StatusBadge label={typeLabel(it.currentType)} tone="gray" />
                              <ChevronRightIcon size={16} sx={{ color: 'text.secondary' }} />
                              <StatusBadge label={typeLabel(it.proposedType)} tone="blue" />
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip title={it.deadlineText ? `Regulator wording: ${it.deadlineText}` : ''}>
                            <Box>
                              {it.ruleChanged ? (
                                <>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textDecoration: 'line-through' }}>
                                    {it.currentRule || '-'}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: it.proposedRule === 'Due date needed' ? 'warning.dark' : 'text.primary' }}>
                                    {it.proposedRule || '-'}
                                  </Typography>
                                </>
                              ) : (
                                <Typography variant="body2" color="text.secondary">{it.currentRule || it.proposedRule || '-'}</Typography>
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ display: 'block' }}>remove {it.removableInstances ?? 0}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>keep {it.keptInstances ?? 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone="gray" label={SOURCE_LABELS[it.source] || it.source || '-'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {items.length > PAGE_SIZE && (
                <TablePagination component="div" count={items.length} page={page}
                  onPageChange={(_, p) => setPage(p)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} />
              )}
            </Paper>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {done ? (
          <Button variant="contained" onClick={handleClose}>Close</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
            <Button variant="contained" color="warning" onClick={() => mutation.mutate()}
              disabled={mutation.isPending || toRepair === 0}
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}>
              Repair {toRepair} return{toRepair === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
