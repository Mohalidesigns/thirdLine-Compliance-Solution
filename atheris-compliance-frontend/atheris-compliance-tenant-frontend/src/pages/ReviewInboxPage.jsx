import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Snackbar, Tooltip, TablePagination, TableSortLabel,
  Collapse, Skeleton,
} from '@mui/material';
import {
  Search, Refresh, Visibility, ArrowForward, Close, Article,
  KeyboardArrowDown, KeyboardArrowUp, InfoOutlined,
} from '@mui/icons-material';
import { api, API_BASE, getToken, pdfErrorMessage } from '../services/api';

const RISK_CONFIG = {
  Critical: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Extreme: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Moderate: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

// harmonized with ReviewEditPage
const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

const SOURCE_CONFIG = {
  intel: { label: 'Intel', color: 'default' },
  upload: { label: 'Upload', color: 'info' },
};

const COLUMNS = [
  { id: 'document', label: 'Document', minWidth: 320, sortField: 'sourceTitle' },
  { id: 'regulator', label: 'Regulator', minWidth: 120, sortField: 'regulatorAbbreviation' },
  { id: 'risk', label: 'Risk', minWidth: 90, sortField: 'riskRating' },
  { id: 'obligations', label: 'Obligations', minWidth: 110 },
  { id: 'received', label: 'Received', minWidth: 110, sortField: 'createdAt' },
];

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" sx={{ height: 22 }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22 }} />;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ObligationSummary({ obligations }) {
  if (obligations.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: '#A0AEC0', py: 3, textAlign: 'center' }}>
        No obligations extracted for this document.
      </Typography>
    );
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 36 }}>#</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', minWidth: 260 }}>Obligation (Title + Interpreted)</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 110 }}>Section</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 140 }}>Area</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 120 }}>Risk</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 120 }}>Act</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {obligations.map((o, i) => {
            const excluded = o.applicable === false;
            return (
              <TableRow key={o.obligationNumber ?? i} hover
                sx={{ '& > td': { py: 1 }, opacity: excluded ? 0.45 : 1 }}>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {o.obligationNumber ?? i + 1}
                </TableCell>
                <TableCell sx={{ minWidth: 260, maxWidth: 380 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 330 }}>
                      {o.title || <span style={{ color: '#A0AEC0', fontWeight: 400 }}>Untitled obligation</span>}
                    </Typography>
                    {o.description && (
                      <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{o.description}</Box>}>
                        <InfoOutlined sx={{ fontSize: 14, color: '#A0AEC0', flexShrink: 0 }} />
                      </Tooltip>
                    )}
                    {excluded && (
                      <Chip size="small" variant="outlined" label="Not applicable"
                        sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem' }} />
                    )}
                  </Box>
                  {o.plainEnglishStatement ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                      {o.plainEnglishStatement}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.sectionReference ? (
                    <Chip size="small" label={o.sectionReference.slice(0, 24)} variant="outlined"
                      sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.areaOfFocus ? (
                    <Chip size="small" variant="outlined" label={o.areaOfFocus}
                      sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 130 }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {inherentRiskChip(o.inherentRiskRating, o.inherentLikelihood, o.inherentImpact)}
                </TableCell>
                <TableCell>
                  {o.actName ? (
                    <Chip size="small" variant="outlined" label={o.actName.slice(0, 22)}
                      sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 110 }} />
                  ) : o.regulationId ? (
                    <Chip size="small" variant="outlined" label={`Reg #${o.regulationId}`} sx={{ height: 22, borderRadius: '4px' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ReviewRow({ item, onOpen, onSkip, onViewPdf }) {
  const [open, setOpen] = useState(false);
  const rc = RISK_CONFIG[item.riskRating] || {};

  const detail = useQuery({
    queryKey: ['review', String(item.reviewId)],
    queryFn: ({ signal }) => api.review.get(item.reviewId, { signal }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const obligations = Array.isArray(detail.data?.obligations) ? detail.data.obligations : [];

  return (
    <>
      <TableRow hover onClick={() => onOpen(item)}
        sx={{ cursor: 'pointer', bgcolor: rc.bg || 'inherit',
          '&:hover': { bgcolor: rc.bg || '#F7FAFC' },
          borderLeft: rc.chip ? `3px solid ${rc.chip}` : '3px solid transparent' }}>
        <TableCell sx={{ width: 36, p: 0.5 }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            title={open ? 'Hide obligations' : 'Show obligations'}>
            {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Chip size="small" label={SOURCE_CONFIG[item.source]?.label || item.source}
              color={SOURCE_CONFIG[item.source]?.color || 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
            <Tooltip title={item.sourceTitle || 'Untitled document'}>
              <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 300,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.sourceTitle || 'Untitled document'}
              </Typography>
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell>
          {item.regulatorAbbreviation || item.regulatorName || '-'}
        </TableCell>
        <TableCell>{riskChip(item.riskRating)}</TableCell>
        <TableCell>
          <Chip size="small" variant="outlined"
            label={`${item.obligationCount} obligation${item.obligationCount !== 1 ? 's' : ''}`}
            sx={{ height: 22 }} />
        </TableCell>
        <TableCell sx={{ color: 'text.secondary' }}>{formatDate(item.createdAt)}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" variant="contained" startIcon={<ArrowForward />}
              onClick={(e) => { e.stopPropagation(); onOpen(item); }} sx={{ fontSize: '0.7rem', py: 0.3 }}>
              Review
            </Button>
            {item.instrumentId && (
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onViewPdf(item); }}
                title="View PDF"><Visibility sx={{ fontSize: 18 }} /></IconButton>
            )}
            <Button size="small" variant="contained" color="error"
              onClick={(e) => { e.stopPropagation(); onSkip(item); }} sx={{ fontSize: '0.7rem', py: 0.3 }}>
              Not Applicable
            </Button>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box onClick={(e) => e.stopPropagation()} sx={{ p: 2, bgcolor: '#F7FAFC' }}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoOutlined sx={{ fontSize: 16 }} /> Obligation Summary (harmonized)
                </Typography>
                {detail.isPending ? (
                  <Box>
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 1 }} />
                  </Box>
                ) : detail.isError ? (
                  <Alert severity="error" action={
                    <Button size="small" onClick={() => detail.refetch()}>Retry</Button>
                  }>
                    {detail.error?.message || 'Failed to load obligations.'}
                  </Alert>
                ) : (
                  <ObligationSummary obligations={obligations} />
                )}
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ReviewInboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [snack, setSnack] = useState(null);
  const notify = (severity, message) => setSnack({ severity, message });

  const hasFilters = search || sourceFilter !== 'All' || regulatorFilter !== 'All';

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (sourceFilter !== 'All') params.source = sourceFilter;
  if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['review', 'list', params],
    queryFn: ({ signal }) => api.review.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['review', 'stats'],
    queryFn: ({ signal }) => api.review.stats({ signal }),
  });

  const skipMutation = useMutation({
    mutationFn: (reviewId) => api.review.skip(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] });
      notify('success', 'Review skipped.');
    },
    onError: (e) => notify('error', e.message || 'Failed to skip.'),
  });

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const loading = listQuery.isPending;

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'intel') setSourceFilter('intel');
    else if (type === 'upload') setSourceFilter('upload');
    else setSourceFilter('All');
  }

  const kpis = [
    { key: 'total', label: 'Total Pending', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'intel', label: 'From Intel', value: stats?.intel ?? 0, color: '#805AD5', bg: '#FAF5FF' },
    { key: 'upload', label: 'From Upload', value: stats?.upload ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
  ];

  function clearFilters() {
    setSearch(''); setSourceFilter('All'); setRegulatorFilter('All'); setPage(0);
  }

  function openReview(item) {
    navigate(`/review/${item.reviewId}`);
  }

  function handleSkip(item) {
    skipMutation.mutate(item.reviewId);
  }

  async function handleViewPdf(item) {
    const id = item?.instrumentId;
    if (!id) { notify('warning', 'No PDF available yet.'); return; }
    try {
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${id}/pdf`, {
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      });
      if (!res.ok) throw new Error(await pdfErrorMessage(res));
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { notify('error', e.message || 'Failed to load PDF.'); }
  }

  const regulators = Array.isArray(stats?.regulators) ? stats.regulators : [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Review Inbox</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} document{total !== 1 ? 's' : ''} awaiting review — vet obligations before they enter the register
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {listQuery.error?.message || 'Failed to load review queue.'}
        </Alert>
      )}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            onClick={() => applyKpiFilter(k.key)}
            sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${k.color}`,
              transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0); }}
          label="Source" sx={{ minWidth: 110 }}>
          <MenuItem value="All">All</MenuItem>
          <MenuItem value="intel">Intel</MenuItem>
          <MenuItem value="upload">Upload</MenuItem>
        </TextField>
        <TextField select size="small" value={regulatorFilter} onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 130 }}>
          <MenuItem value="All">All</MenuItem>
          {regulators.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No documents awaiting review.</Typography>
          <Typography variant="body2" color="text.secondary">New instruments from Intel and uploaded documents will appear here.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 36, bgcolor: '#F7FAFC' }} />
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(c.sortField);
                            setSortDir('asc');
                          }
                          setPage(0);
                        } : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={sortDir}
                              sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                              {c.label}
                            </TableSortLabel>
                          : c.label}
                      </TableCell>
                    );
                  })}
                  <TableCell sx={{ minWidth: 140, fontWeight: 700, bgcolor: '#F7FAFC' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <ReviewRow key={item.reviewId} item={item} onOpen={openReview}
                    onSkip={handleSkip} onViewPdf={handleViewPdf} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
