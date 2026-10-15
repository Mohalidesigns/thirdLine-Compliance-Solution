import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, IconButton, Button, MenuItem, Collapse,
} from '@mui/material';
import {
  Search, Refresh, Close, Gavel, CheckCircle, KeyboardArrowDown, KeyboardArrowUp,
} from '@mui/icons-material';
import api from '../../../services/api';

const MONO_CHIP_SX = {
  height: 22, borderRadius: '4px',
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
};

function formatNaira(amount) {
  if (amount == null) return '-';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const COLUMNS = [
  { id: 'actName', label: 'Act & Section', minWidth: 280, sortField: 'regulationId' },
  { id: 'sanctionType', label: 'Type', minWidth: 150, sortField: 'sanctionType' },
  { id: 'amount', label: 'Amount', minWidth: 150, sortField: 'sanctionAmountNaira' },
  { id: 'severity', label: 'Severity & Enforcement', minWidth: 200, sortField: 'severityScore' },
  { id: 'liableRoles', label: 'Liable Roles', minWidth: 200 },
];

function SanctionDetail({ item }) {
  const blocks = [
    { key: 'violation', label: 'Violation', text: item.description },
    { key: 'penalty', label: 'Penalty', text: item.penaltyDetails },
    { key: 'impact', label: 'Impact', text: item.riskExplanation },
  ].filter(b => b.text);

  if (blocks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No violation, penalty or impact detail recorded for this sanction.
      </Typography>
    );
  }

  return (
    <>
      {blocks.map((b, i) => (
        <Box key={b.key} sx={{ mb: i === blocks.length - 1 ? 0 : 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{b.label}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{b.text}</Typography>
        </Box>
      ))}
    </>
  );
}

function SanctionRow({ item, index, open, onToggle, onOpen }) {
  const hasDetail = !!(item.description || item.penaltyDetails || item.riskExplanation);
  const roles = Array.isArray(item.liableRoles) ? item.liableRoles : [];

  return (
    <>
      <TableRow hover onClick={onOpen} sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
        <TableCell sx={{ width: 72, p: 0.5, whiteSpace: 'nowrap' }}>
          {hasDetail ? (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle(); }}
              title={open ? 'Hide detail' : 'Show violation, penalty and impact'}>
              {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
            </IconButton>
          ) : (
            <Box sx={{ display: 'inline-block', width: 30 }} />
          )}
          <Typography variant="caption" color="text.secondary">{index}</Typography>
        </TableCell>
        <TableCell>
          <Tooltip title={item.actName || '-'}>
            <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 280,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.actName || '-'}
            </Typography>
          </Tooltip>
          {item.sourceSectionReference && (
            <Chip size="small" variant="outlined" label={item.sourceSectionReference.slice(0, 24)}
              sx={{ ...MONO_CHIP_SX, mt: 0.5 }} />
          )}
        </TableCell>
        <TableCell>
          {item.sanctionType
            ? <Chip size="small" label={item.sanctionType} color="error" variant="outlined"
                sx={{ height: 22, borderRadius: '4px', fontWeight: 600, textTransform: 'capitalize' }} />
            : <Typography variant="body2" color="text.secondary">-</Typography>}
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
            {formatNaira(item.sanctionAmountNaira)}{item.sanctionAmountPerDay ? ' /day' : ''}
          </Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.severityScore != null ? (
              <Chip size="small" label={`Sev ${item.severityScore}`}
                color={item.severityScore > 7 ? 'error' : item.severityScore > 4 ? 'warning' : 'default'}
                sx={{ height: 22, borderRadius: '4px' }} />
            ) : (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )}
            {item.hasBeenEnforced
              ? <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Enforced" size="small" color="success"
                  sx={{ height: 22, borderRadius: '4px' }} />
              : <Chip label="Not enforced" size="small" variant="outlined"
                  sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', color: 'text.secondary' }} />}
          </Box>
        </TableCell>
        <TableCell>
          {roles.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {roles.map(r => (
                <Chip key={r} size="small" label={r} sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem' }} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={COLUMNS.length + 1} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box onClick={(e) => e.stopPropagation()} sx={{ p: 2, bgcolor: '#F7FAFC' }}>
              <Paper variant="outlined" sx={{ p: 1.5, borderColor: '#FED7D7', bgcolor: '#FFFAFA' }}>
                <SanctionDetail item={item} />
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function SanctionExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [enforcedFilter, setEnforcedFilter] = useState('All');
  const [sortField, setSortField] = useState('severityScore');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);

  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => () => { mounted.current = false; }, []);

  const hasFilters = search || typeFilter !== 'All' || enforcedFilter !== 'All';

  const loadStats = useCallback(async () => {
    try {
      const data = await api.platform.sanctions.stats();
      if (mounted.current) setStats(data);
    } catch { /* optional */ }
  }, []);

  const loadRows = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
      if (search) params.set('q', search);
      if (typeFilter !== 'All') params.set('sanctionType', typeFilter);
      if (enforcedFilter !== 'All') params.set('hasBeenEnforced', enforcedFilter === 'Yes');
      const data = await api.platform.sanctions.list(params.toString());
      if (!mounted.current || id !== requestId.current) return;
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      setError(err.message);
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [page, rowsPerPage, search, typeFilter, enforcedFilter, sortField, sortDir]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadStats(); }, [loadStats]);

  function clearFilters() {
    setSearch(''); setTypeFilter('All'); setEnforcedFilter('All');
    setPage(0); setExpandedRow(null);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
    setExpandedRow(null);
  }

  const kpis = [
    { key: 'total', label: 'Total Sanctions', value: stats?.total ?? 0, color: '#2B6CB0' },
    { key: 'highSeverity', label: 'High Severity', value: stats?.highSeverity ?? 0, color: '#E53E3E' },
    { key: 'enforced', label: 'Enforced', value: stats?.enforced ?? 0, color: '#38A169' },
    { key: 'notEnforced', label: 'Not Enforced', value: stats?.notEnforced ?? 0, color: '#718096' },
    { key: 'exposure', label: 'Total Exposure', value: formatNaira(stats?.totalExposure), color: '#DD6B20' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Sanction Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} sanction{total !== 1 ? 's' : ''} — penalties, enforcement and monetary exposure
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { loadRows(); loadStats(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            sx={{ p: 2, borderLeft: `3px solid ${k.color}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
              <Box sx={{ color: k.color, opacity: 0.5 }}><Gavel sx={{ fontSize: 20 }} /></Box>
            </Box>
            <Typography variant={k.key === 'exposure' ? 'h5' : 'h4'} sx={{ fontWeight: 700, color: k.color }}>
              {k.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search description, penalty or type..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); setExpandedRow(null); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 280 }} />
        <TextField select size="small" value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(0); setExpandedRow(null); }}
          label="Sanction Type" sx={{ minWidth: 180 }}>
          <MenuItem value="All">All types</MenuItem>
          {(stats?.sanctionTypes || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={enforcedFilter}
          onChange={e => { setEnforcedFilter(e.target.value); setPage(0); setExpandedRow(null); }}
          label="Enforced" sx={{ minWidth: 130 }}>
          <MenuItem value="All">All</MenuItem>
          <MenuItem value="Yes">Yes</MenuItem>
          <MenuItem value="No">No</MenuItem>
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
          <Gavel sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No sanctions found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 72 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => handleSort(c.sortField) : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={active ? sortDir : 'asc'}
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
                {rows.map((item, idx) => (
                  <SanctionRow key={item.sanctionId} item={item}
                    index={page * rowsPerPage + idx + 1}
                    open={expandedRow === item.sanctionId}
                    onToggle={() => setExpandedRow(expandedRow === item.sanctionId ? null : item.sanctionId)}
                    onOpen={() => navigate(`/admin/sanctions/${item.sanctionId}`)} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => { setPage(p); setExpandedRow(null); }}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); setExpandedRow(null); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
