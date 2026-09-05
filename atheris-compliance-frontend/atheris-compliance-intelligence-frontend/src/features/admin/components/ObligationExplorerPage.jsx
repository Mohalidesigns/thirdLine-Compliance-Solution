import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, IconButton, Button, MenuItem,
} from '@mui/material';
import {
  Search, Refresh, Close, Gavel, Rule, Warning, Category, InfoOutlined,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

const MONO_CHIP = {
  height: 22,
  borderRadius: '4px',
  fontFamily: 'Roboto Mono, monospace',
  fontSize: '0.7rem',
};

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) {
    return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  }
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

function prettify(v) {
  return v ? String(v).replace(/_/g, ' ') : '';
}

const COLUMNS = [
  { id: 'obligation', label: 'Obligation (Title + Interpreted)', minWidth: 360, sortField: 'title' },
  { id: 'act', label: 'Act', minWidth: 180 },
  { id: 'type', label: 'Type', minWidth: 130, sortField: 'obligationType' },
  { id: 'deadline', label: 'Deadline', minWidth: 130, sortField: 'recurringDeadlineType' },
  { id: 'risk', label: 'Inherent Risk', minWidth: 120, sortField: 'inherentRiskRating' },
];

export default function ObligationExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortField, setSortField] = useState('title');
  const [sortDir, setSortDir] = useState('asc');
  const [reloadKey, setReloadKey] = useState(0);

  const hasFilters = search || areaFilter !== 'All' || riskFilter !== 'All' || typeFilter !== 'All';

  const loadStats = useCallback(async () => {
    try { setStats(await api.platform.obligations.stats()); } catch { /* optional */ }
  }, []);

  // guarded fetch — the cleanup flips `active` so a stale response never wins
  const loadRows = useCallback((signalRef) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
    if (search) params.set('q', search);
    if (areaFilter !== 'All') params.set('areaOfFocus', areaFilter);
    if (riskFilter !== 'All') params.set('inherentRiskRating', riskFilter);
    if (typeFilter !== 'All') params.set('obligationType', typeFilter);
    return api.platform.obligations.list(params.toString())
      .then((data) => {
        if (signalRef && !signalRef.active) return;
        setRows(data.content || []);
        setTotal(data.totalElements || 0);
      })
      .catch((err) => { if (!signalRef || signalRef.active) setError(err.message); })
      .finally(() => { if (!signalRef || signalRef.active) setLoading(false); });
  }, [page, rowsPerPage, search, areaFilter, riskFilter, typeFilter, sortField, sortDir]);

  useEffect(() => {
    const ref = { active: true };
    loadRows(ref);
    return () => { ref.active = false; };
  }, [loadRows, reloadKey]);

  useEffect(() => { loadStats(); }, [loadStats, reloadKey]);

  function clearFilters() {
    setSearch(''); setAreaFilter('All'); setRiskFilter('All'); setTypeFilter('All'); setPage(0);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }

  const kpis = [
    { key: 'total', label: 'Total Obligations', value: stats?.totalObligations ?? 0, color: '#805AD5', bg: '#FAF5FF', icon: <Rule sx={{ fontSize: 20 }} /> },
    { key: 'high', label: 'High / Critical', value: stats?.highRiskCount ?? 0, color: '#E53E3E', bg: '#FFF5F5', icon: <Warning sx={{ fontSize: 20 }} /> },
    { key: 'areas', label: 'Areas of Focus', value: stats?.areaCount ?? 0, color: '#2C7A7B', bg: '#E6FFFA', icon: <Category sx={{ fontSize: 20 }} /> },
    { key: 'types', label: 'Obligation Types', value: (stats?.obligationTypes || []).length, color: '#2B6CB0', bg: '#EBF8FF', icon: <Gavel sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Obligation Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} obligation{total !== 1 ? 's' : ''} — browse extracted obligations across the compliance universe
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => setReloadKey(k => k + 1)}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            sx={{ p: 2, borderLeft: `3px solid ${k.color}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
              <Box sx={{ color: k.color, opacity: 0.5 }}>{k.icon}</Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search obligations..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <TextField select size="small" value={areaFilter}
          onChange={e => { setAreaFilter(e.target.value); setPage(0); }}
          label="Area of Focus" sx={{ minWidth: 200 }}>
          <MenuItem value="All">All areas</MenuItem>
          {(stats?.areasOfFocus || []).map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk Rating" sx={{ minWidth: 170 }}>
          <MenuItem value="All">All ratings</MenuItem>
          {(stats?.riskRatings || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          label="Obligation Type" sx={{ minWidth: 180 }}>
          <MenuItem value="All">All types</MenuItem>
          {(stats?.obligationTypes || []).map(t => <MenuItem key={t} value={t}>{prettify(t)}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Rule sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No obligations found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                      cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={c.sortField ? () => handleSort(c.sortField) : undefined}>
                      {c.sortField
                        ? <TableSortLabel active={sortField === c.sortField} direction={sortField === c.sortField ? sortDir : 'asc'}
                            sx={{ '& .MuiTableSortLabel-icon': { opacity: sortField === c.sortField ? 1 : 0.4 } }}>
                            {c.label}
                          </TableSortLabel>
                        : c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.obligationId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_OBLIGATIONS}/${row.obligationId}`)}
                    sx={{ cursor: 'pointer', '& > td': { py: 1 }, '&:hover': { bgcolor: '#F7FAFC' } }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{total - (page * rowsPerPage) - idx}</TableCell>
                    <TableCell sx={{ minWidth: 360, maxWidth: 440 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, maxWidth: 380,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.title || <span style={{ color: '#A0AEC0', fontWeight: 400 }}>Untitled obligation</span>}
                        </Typography>
                        {row.description && (
                          <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{row.description}</Box>}>
                            <InfoOutlined sx={{ fontSize: 14, color: '#A0AEC0', flexShrink: 0 }} />
                          </Tooltip>
                        )}
                      </Box>
                      {row.plainEnglishStatement ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 420,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.plainEnglishStatement}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {row.specificSectionReference && (
                          <Chip size="small" variant="outlined" label={row.specificSectionReference.slice(0, 24)}
                            sx={MONO_CHIP} />
                        )}
                        {row.areaOfFocus && (
                          <Chip size="small" variant="outlined" label={row.areaOfFocus}
                            sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 150 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.actName
                        ? <Tooltip title={row.actName}>
                            <Chip size="small" variant="outlined" label={row.actName}
                              sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 180 }} />
                          </Tooltip>
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{prettify(row.obligationType) || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {prettify(row.recurringDeadlineType) || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {inherentRiskChip(row.inherentRiskRating, row.inherentLikelihood, row.inherentImpact)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
