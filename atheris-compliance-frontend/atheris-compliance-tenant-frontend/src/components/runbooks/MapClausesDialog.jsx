import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { SearchInput, TL } from 'shared';
import { api } from '../../services/api';
import { CodeChip, errMsg } from './LibraryBadges';

/**
 * M7 — Map Framework Clauses. Framework select → clause search (GET /runbooks/frameworks/{id}/clauses?q=)
 * → multi-select across frameworks → PUT /runbooks/{id}/clauses { clauseIds } (replaces the set).
 */
export default function MapClausesDialog({ open, onClose, runbookId, mapped, onSaved }) {
  const queryClient = useQueryClient();
  const [frameworkId, setFrameworkId] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Map());

  // Seed the selection only when the dialog opens (not on every refetch of the parent detail).
  useEffect(() => {
    if (open) {
      setSelected(new Map((mapped || []).map((c) => [c.clauseId, c])));
      setSearch(''); setQ('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const frameworksQuery = useQuery({
    queryKey: ['runbooks', 'frameworks'],
    queryFn: ({ signal }) => api.runbooks.frameworks.list({ signal }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });
  const frameworks = useMemo(() => frameworksQuery.data || [], [frameworksQuery.data]);

  useEffect(() => {
    if (open && frameworkId === '' && frameworks.length) setFrameworkId(frameworks[0].frameworkId);
  }, [open, frameworkId, frameworks]);

  const clausesQuery = useQuery({
    queryKey: ['runbooks', 'frameworks', String(frameworkId), 'clauses', q],
    queryFn: ({ signal }) => api.runbooks.frameworks.clauses(frameworkId, q ? { q } : {}, { signal }),
    enabled: open && frameworkId !== '',
    staleTime: 5 * 60 * 1000,
  });
  const clauses = clausesQuery.data || [];

  const toggle = (c) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(c.clauseId)) next.delete(c.clauseId); else next.set(c.clauseId, c);
    return next;
  });

  const mutation = useMutation({
    mutationFn: () => api.runbooks.setClauses(runbookId, [...selected.keys()]),
    onSuccess: (rb) => {
      queryClient.invalidateQueries({ queryKey: ['runbook', String(runbookId)] });
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      onSaved?.(rb);
      mutation.reset();
      onClose();
    },
  });

  const selectedList = [...selected.values()];

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Map framework clauses</DialogTitle>
      <DialogContent dividers>
        {mutation.error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(mutation.error)}</Alert>}
        {frameworksQuery.error && <Alert severity="error" sx={{ mb: 2 }}>{frameworksQuery.error.message}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Framework" value={frameworkId} sx={{ minWidth: 240 }}
            onChange={(e) => setFrameworkId(e.target.value)}>
            {frameworks.map((f) => (
              <MenuItem key={f.frameworkId} value={f.frameworkId}>
                {f.code} — {f.name}{f.clauseCount != null ? ` (${f.clauseCount})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: '1 1 260px' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search clause ref, title or domain…" />
          </Box>
        </Box>

        <Typography variant="caption" sx={{ color: TL.gray500, display: 'block', mb: 1 }}>
          {selectedList.length} clause{selectedList.length !== 1 ? 's' : ''} selected across all frameworks
        </Typography>
        {selectedList.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2, maxHeight: 96, overflowY: 'auto' }}>
            {selectedList.map((c) => (
              <Chip key={c.clauseId} size="small" onDelete={() => toggle(c)}
                label={`${c.frameworkCode ? `${c.frameworkCode} ` : ''}${c.clauseRef}`} />
            ))}
          </Box>
        )}

        <TableContainer sx={{ maxHeight: 380, border: `1px solid ${TL.gray200}`, borderRadius: '8px' }}>
          {clausesQuery.isPending && frameworkId !== '' ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} /></Box>
          ) : clausesQuery.error ? (
            <Alert severity="error" sx={{ m: 2 }}>{clausesQuery.error.message}</Alert>
          ) : clauses.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              {frameworkId === '' ? 'Choose a framework.' : 'No clauses match.'}
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Clause</TableCell>
                  <TableCell>Domain</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clauses.map((c) => {
                  const checked = selected.has(c.clauseId);
                  return (
                    <TableRow key={c.clauseId} hover selected={checked} onClick={() => toggle(c)} sx={{ cursor: 'pointer' }}>
                      <TableCell padding="checkbox"><Checkbox size="small" checked={checked} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CodeChip label={c.clauseRef} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{c.title || '—'}</Typography>
                        </Box>
                        {c.requirementText && (
                          <Typography variant="caption" color="text.secondary" sx={{
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.25,
                          }}>
                            {c.requirementText}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Typography variant="body2">{c.domain || '—'}</Typography></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : `Save ${selectedList.length} clause${selectedList.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
