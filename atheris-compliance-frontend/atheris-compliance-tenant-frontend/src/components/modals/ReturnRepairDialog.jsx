import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Chip, Typography, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TablePagination,
  CircularProgress,
} from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
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

const HEAD_SX = { fontWeight: 700, bgcolor: '#F7FAFC' };
const CHIP_SX = { height: 22, borderRadius: '4px' };

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
  const toRetype = preview?.toRetype ?? items.length;
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
      <DialogTitle sx={{ fontWeight: 700 }}>Repair return schedules</DialogTitle>
      <DialogContent dividers>
        {done ? (
          <Alert severity="success">
            Repair complete: {result?.retyped ?? 0} return{result?.retyped === 1 ? '' : 's'} retyped,{' '}
            {result?.instancesRemoved ?? 0} period{result?.instancesRemoved === 1 ? '' : 's'} removed,{' '}
            {result?.instancesKept ?? 0} kept, {result?.instancesCreated ?? 0} created on the correct cycle.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={`To retype ${toRetype}`} color="warning" sx={{ fontWeight: 600 }} />
              <Chip label={`Periods to remove ${preview?.instancesToRemove ?? 0}`} color="error" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label={`Periods kept ${preview?.instancesKept ?? 0}`} color="success" variant="outlined" sx={{ fontWeight: 600 }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Only the frequency type changes; frequency text is kept. Periods nobody has worked on are
              removed and rebuilt on the correct cycle. Periods with any work are kept.
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
                      <TableCell sx={{ ...HEAD_SX, minWidth: 220 }}>Return</TableCell>
                      <TableCell sx={{ ...HEAD_SX, minWidth: 160 }}>Frequency</TableCell>
                      <TableCell sx={{ ...HEAD_SX, minWidth: 190 }}>Change</TableCell>
                      <TableCell sx={{ ...HEAD_SX, minWidth: 110 }}>Periods</TableCell>
                      <TableCell sx={{ ...HEAD_SX, minWidth: 90 }}>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageItems.map(it => (
                      <TableRow key={it.returnId} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{it.returnName}</Typography>
                          <Typography variant="caption" color="text.secondary">{it.regulator || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{it.frequency || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip size="small" label={typeLabel(it.currentType)} variant="outlined" sx={CHIP_SX} />
                            <ArrowForward sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Chip size="small" label={typeLabel(it.proposedType)} color="primary" sx={{ ...CHIP_SX, fontWeight: 600 }} />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ display: 'block' }}>remove {it.removableInstances ?? 0}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>keep {it.keptInstances ?? 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined" sx={CHIP_SX}
                            label={SOURCE_LABELS[it.source] || it.source || '-'} />
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
              disabled={mutation.isPending || toRetype === 0}
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}>
              Repair {toRetype} return{toRetype === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
