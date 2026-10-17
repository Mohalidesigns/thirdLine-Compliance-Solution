import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { StatusBadge, TL } from 'shared';
import { api } from '../../services/api';
import { CodeChip } from './LibraryBadges';

const show = (v) => {
  if (v == null || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

function ChangeTable({ changes }) {
  if (!changes?.length) return null;
  return (
    <Table size="small" sx={{ mt: 1, '& td': { verticalAlign: 'top' } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 160 }}>Field</TableCell>
          <TableCell>Before</TableCell>
          <TableCell>After</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {changes.map((c, i) => (
          <TableRow key={`${c.field}-${i}`}>
            <TableCell><Typography variant="body2" sx={{ fontFamily: TL.mono, fontSize: '0.75rem' }}>{c.field}</Typography></TableCell>
            <TableCell sx={{ bgcolor: '#FEF2F2' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{show(c.before)}</Typography>
            </TableCell>
            <TableCell sx={{ bgcolor: '#F0FDF4' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{show(c.after)}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StepGroup({ title, tone, steps, withChanges }) {
  if (!steps?.length) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <StatusBadge label={steps.length} tone={tone} />
      </Box>
      {steps.map((s, i) => (
        <Box key={`${s.stepCode}-${i}`} sx={{ p: 1.5, mb: 1, border: `1px solid ${TL.gray200}`, borderRadius: '8px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeChip label={s.stepCode} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.title || 'Untitled step'}</Typography>
          </Box>
          {withChanges && <ChangeTable changes={s.changes} />}
        </Box>
      ))}
    </Box>
  );
}

/**
 * M10 — Version Diff. GET /runbooks/{id}/versions/{fromVid}/diff/{toVid} → VersionDiffDto
 * { fromVersionNumber, toVersionNumber, added, removed, changed, metadata }.
 */
export default function VersionDiffDialog({ open, onClose, runbookId, fromVersionId, toVersionId }) {
  const diffQuery = useQuery({
    queryKey: ['runbook', String(runbookId), 'diff', String(fromVersionId), String(toVersionId)],
    queryFn: ({ signal }) => api.runbooks.versions.diff(runbookId, fromVersionId, toVersionId, { signal }),
    enabled: open && fromVersionId != null && toVersionId != null,
    staleTime: 5 * 60 * 1000,
  });
  const d = diffQuery.data;
  const empty = d && !d.added?.length && !d.removed?.length && !d.changed?.length && !d.metadata?.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {d ? `Changes v${d.fromVersionNumber} → v${d.toVersionNumber}` : 'Version diff'}
      </DialogTitle>
      <DialogContent dividers>
        {diffQuery.isPending && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} /></Box>}
        {diffQuery.error && <Alert severity="error">{diffQuery.error.message}</Alert>}
        {empty && <Typography color="text.secondary">No differences between these versions.</Typography>}
        {d && !empty && (
          <>
            {d.metadata?.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2">Runbook-level changes</Typography>
                <ChangeTable changes={d.metadata} />
              </Box>
            )}
            <StepGroup title="Added steps" tone="green" steps={d.added} />
            <StepGroup title="Removed steps" tone="red" steps={d.removed} />
            <StepGroup title="Changed steps" tone="orange" steps={d.changed} withChanges />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
