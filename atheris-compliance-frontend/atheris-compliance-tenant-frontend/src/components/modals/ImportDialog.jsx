import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button, Chip,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tooltip, TablePagination, CircularProgress, IconButton,
} from '@mui/material';
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentIcon, XMarkIcon, StatusBadge, riskTone,
} from 'shared';
import { api } from '../../services/api';

// Thirdline risk badge (dot + tone); "Extreme" is the legacy name for Critical
function riskChip(rating) {
  const t = rating === 'Extreme' ? 'red' : riskTone(rating);
  return <StatusBadge label={rating || 'Unrated'} tone={t} dot={t !== 'gray'} />;
}

const RESULT_CHIP = {
  valid: { label: 'Valid', color: 'success', tone: 'green' },
  invalid: { label: 'Invalid', color: 'error', tone: 'red' },
  duplicate: { label: 'Duplicate', color: 'default', tone: 'gray' },
};

const PAGE_SIZE = 50;

export default function ImportDialog({
  entityType, entityLabel, open, onClose, onImported,
  itemLabel = 'Obligation', contextLabel = 'Regulator / Act', invalidateKeys,
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [downloadError, setDownloadError] = useState('');

  const preview = useMutation({
    mutationFn: (f) => api.imports.preview(entityType, f),
    onSuccess: () => { setFilter('all'); setPage(0); },
  });

  const commit = useMutation({
    mutationFn: (batchId) => api.imports.commit(batchId),
    onSuccess: (summary) => {
      (invalidateKeys ?? [[entityType]]).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      onImported?.(summary);
    },
  });

  const template = useMutation({
    mutationFn: () => api.imports.template(entityType),
    onMutate: () => setDownloadError(''),
    onError: (e) => setDownloadError(e.message),
  });

  const errorsFile = useMutation({
    mutationFn: (batchId) => api.imports.errors(batchId),
    onMutate: () => setDownloadError(''),
    onError: (e) => setDownloadError(e.message),
  });

  const result = preview.data;
  const summary = commit.data;
  const step = summary ? 3 : result ? 2 : 1;

  const rows = useMemo(() => {
    const all = result?.rows || [];
    return filter === 'all' ? all : all.filter((r) => r.result === filter);
  }, [result, filter]);
  const pageRows = rows.length > PAGE_SIZE ? rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : rows;

  function reset() {
    setFile(null);
    setFilter('all');
    setPage(0);
    setDownloadError('');
    preview.reset();
    commit.reset();
    template.reset();
    errorsFile.reset();
    if (fileInput.current) fileInput.current.value = '';
  }

  function handleClose() {
    if (preview.isPending || commit.isPending) return;
    reset();
    onClose?.();
  }

  function pickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    preview.reset();
  }

  function back() {
    preview.reset();
    commit.reset();
    setDownloadError('');
  }

  function applyFilter(f) {
    setFilter((cur) => (cur === f ? 'all' : f));
    setPage(0);
  }

  const summaryChips = result ? [
    { key: 'valid', label: `Valid ${result.validRows ?? 0}`, color: 'success' },
    { key: 'invalid', label: `Invalid ${result.invalidRows ?? 0}`, color: 'error' },
    { key: 'duplicate', label: `Duplicate ${result.duplicateRows ?? 0}`, color: 'default' },
  ] : [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Box>
          <Typography component="span" sx={{ font: 'inherit', display: 'block' }}>Import {entityLabel}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Step {step} of 3 — {step === 1 ? 'Upload file' : step === 2 ? 'Review rows' : 'Done'}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={preview.isPending || commit.isPending}><XMarkIcon size={18} /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {downloadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDownloadError('')}>{downloadError}</Alert>}

        {step === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Bulk-load existing {entityLabel} from a spreadsheet. Download the template, fill in one row per
              record (dropdown columns accept only the listed values), then upload it. You will see a preview of
              every row before anything is written to the register.
            </Typography>
            <Button variant="outlined" startIcon={template.isPending ? <CircularProgress size={16} /> : <ArrowDownTrayIcon size={16} />}
              onClick={() => template.mutate()} disabled={template.isPending} sx={{ mb: 3 }}>
              Download template
            </Button>

            <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <input ref={fileInput} type="file" hidden onChange={pickFile}
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
              <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => fileInput.current?.click()}
               >
                Choose .xlsx file
              </Button>
              {file ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  <DocumentIcon size={18} sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No file chosen</Typography>
              )}
            </Paper>

            {preview.isError && <Alert severity="error" sx={{ mt: 2 }}>{preview.error.message}</Alert>}
          </Box>
        )}

        {step === 2 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                {result.fileName} — {result.totalRows} row{result.totalRows !== 1 ? 's' : ''}
              </Typography>
              {summaryChips.map((c) => (
                <Chip key={c.key} size="small" label={c.label} color={c.color} clickable
                  variant={filter === c.key ? 'filled' : 'outlined'} onClick={() => applyFilter(c.key)} />
              ))}
              {filter !== 'all' && (
                <Button size="small" onClick={() => applyFilter('all')}>Show all</Button>
              )}
              <Box sx={{ flex: 1 }} />
              {result.invalidRows > 0 && (
                <Button size="small" variant="outlined" color="error"
                  startIcon={errorsFile.isPending ? <CircularProgress size={14} /> : <ArrowDownTrayIcon size={16} />}
                  disabled={errorsFile.isPending} onClick={() => errorsFile.mutate(result.batchId)}
                 >
                  Download errors
                </Button>
              )}
            </Box>

            {commit.isError && <Alert severity="error" sx={{ mb: 2 }}>{commit.error.message}</Alert>}

            <Paper variant="outlined">
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 50 }}>Row</TableCell>
                      <TableCell sx={{ minWidth: 260 }}>{itemLabel}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{contextLabel}</TableCell>
                      <TableCell sx={{ minWidth: 90 }}>Risk</TableCell>
                      <TableCell sx={{ minWidth: 110 }}>Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                          No rows match this filter.
                        </TableCell>
                      </TableRow>
                    ) : pageRows.map((r) => {
                      const chip = RESULT_CHIP[r.result] || { label: r.result, color: 'default', tone: 'gray' };
                      const errors = r.errors || [];
                      return (
                        <TableRow key={r.rowNumber} hover sx={{ '& > td': { py: 1 },
                          ...(r.result === 'duplicate' ? { opacity: 0.6 } : {}) }}>
                          <TableCell sx={{ color: 'text.secondary' }}>{r.rowNumber}</TableCell>
                          <TableCell sx={{ maxWidth: 340 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main', lineHeight: 1.3,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.primary || <span style={{ color: '#9CA3AF', fontWeight: 400 }}>Untitled</span>}
                            </Typography>
                            {r.secondary && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box',
                                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                                {r.secondary}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>
                            <Typography variant="body2" sx={{ fontSize: '.8rem' }}>{r.context || '-'}</Typography>
                          </TableCell>
                          <TableCell>{r.risk ? riskChip(r.risk) : <Typography variant="body2" color="text.secondary">-</Typography>}</TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <StatusBadge label={chip.label} tone={chip.tone || 'gray'} />
                            {errors.length > 0 && (
                              <Tooltip title={
                                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                                </Box>
                              }>
                                <Typography variant="caption" color={r.result === 'invalid' ? 'error' : 'text.secondary'}
                                  sx={{ display: 'block', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap', cursor: 'help' }}>
                                  {errors.join('; ')}
                                </Typography>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {rows.length > PAGE_SIZE && (
                <TablePagination component="div" count={rows.length} page={page}
                  onPageChange={(_, p) => setPage(p)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} />
              )}
            </Paper>
          </Box>
        )}

        {step === 3 && (
          <Alert severity="success">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Imported {summary.importedRows ?? 0} {entityLabel}.
            </Typography>
            {(summary.invalidRows > 0 || summary.duplicateRows > 0) && (
              <Typography variant="body2">
                Skipped {summary.invalidRows ?? 0} invalid and {summary.duplicateRows ?? 0} duplicate
                row{(summary.invalidRows ?? 0) + (summary.duplicateRows ?? 0) !== 1 ? 's' : ''}.
              </Typography>
            )}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {step === 1 && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" disabled={!file || preview.isPending}
              startIcon={preview.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              onClick={() => preview.mutate(file)}>
              Preview
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button onClick={back} disabled={commit.isPending}>Back</Button>
            <Button variant="contained" disabled={!result.validRows || commit.isPending}
              startIcon={commit.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              onClick={() => commit.mutate(result.batchId)}>
              Import {result.validRows ?? 0} {entityLabel}
            </Button>
          </>
        )}
        {step === 3 && (
          <Button variant="contained" onClick={handleClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
