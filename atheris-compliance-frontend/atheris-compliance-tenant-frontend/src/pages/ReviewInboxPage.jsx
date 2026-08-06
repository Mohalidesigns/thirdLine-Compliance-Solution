import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Snackbar, Tooltip, TablePagination, TableSortLabel,
} from '@mui/material';
import {
  Search, Refresh, Visibility, ArrowForward, Close, Article, CloudUpload as CloudUploadIcon, Inbox as InboxIcon,
} from '@mui/icons-material';
import { api, API_BASE, getToken } from '../services/api';

const RISK_CONFIG = {
  Extreme: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

const SOURCE_CONFIG = {
  intel: { label: 'Intel', color: 'default' },
  upload: { label: 'Upload', color: 'info' },
};

const COLUMNS = [
  { id: 'source', label: 'Source', minWidth: 90, sortField: 'source' },
  { id: 'title', label: 'Title', minWidth: 300, sortField: 'sourceTitle' },
  { id: 'regulator', label: 'Regulator', minWidth: 110, sortField: 'regulatorAbbreviation' },
  { id: 'risk', label: 'Risk', minWidth: 90, sortField: 'riskRating' },
  { id: 'obligations', label: 'Obligations', minWidth: 100 },
  { id: 'published', label: 'Received', minWidth: 110, sortField: 'createdAt' },
  { id: 'actions', label: 'Actions', minWidth: 140 },
];

export default function ReviewInboxPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

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

  const loadStats = useCallback(async () => {
    try { setStats(await api.review.stats()); } catch { /* optional */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: rowsPerPage };
      if (search) params.q = search;
      if (sourceFilter !== 'All') params.source = sourceFilter;
      if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
      if (sortField) params.sort = `${sortField},${sortDir}`;
      const data = await api.review.list(params);
      setItems(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (e) { setError(e.message || 'Failed to load review queue.'); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, search, sourceFilter, regulatorFilter, sortField, sortDir]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadStats(); }, []);

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

  async function handleSkip(item) {
    try {
      await api.review.skip(item.reviewId);
      notify('success', 'Review skipped.');
      loadList(); loadStats();
    } catch (e) { notify('error', e.message || 'Failed to skip.'); }
  }

  function riskChip(rating) {
    const cfg = RISK_CONFIG[rating];
    if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22 }} />;
    return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22 }} />;
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleViewPdf(item) {
    const id = item?.instrumentId;
    if (!id) { notify('warning', 'No PDF available yet.'); return; }
    try {
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${id}/pdf`, {
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      });
      if (!res.ok) throw new Error('PDF load failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { notify('error', 'Failed to load PDF.'); }
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
          <IconButton onClick={() => { loadList(); loadStats(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

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
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const rc = RISK_CONFIG[item.riskRating] || {};
                  return (
                    <TableRow key={item.reviewId} hover
                      onClick={() => openReview(item)}
                      sx={{ cursor: 'pointer', bgcolor: rc.bg || 'inherit',
                        '&:hover': { bgcolor: rc.bg || '#F7FAFC' },
                        borderLeft: rc.chip ? `3px solid ${rc.chip}` : '3px solid transparent' }}>
                      <TableCell>
                        <Chip size="small" label={SOURCE_CONFIG[item.source]?.label || item.source}
                          color={SOURCE_CONFIG[item.source]?.color || 'default'} sx={{ height: 22 }} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={item.sourceTitle || 'Untitled document'}>
                          <Typography variant="body2" sx={{ maxWidth: 300,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sourceTitle || 'Untitled document'}
                          </Typography>
                        </Tooltip>
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
                            onClick={(e) => { e.stopPropagation(); openReview(item); }} sx={{ fontSize: '0.7rem', py: 0.3 }}>
                            Review
                          </Button>
                          {item.instrumentId && (
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleViewPdf(item); }}
                              title="View PDF"><Visibility sx={{ fontSize: 18 }} /></IconButton>
                          )}
                          <Button size="small" variant="outlined" color="inherit"
                            onClick={(e) => { e.stopPropagation(); handleSkip(item); }} sx={{ fontSize: '0.7rem', py: 0.3 }}>
                            Skip
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
