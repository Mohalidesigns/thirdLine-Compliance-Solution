import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Tooltip, TablePagination, TableSortLabel,
  Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  Search, Refresh, Close, Gavel, WarningAmber, CheckCircle,
} from '@mui/icons-material';
import { api } from '../services/api';

const SEVERITY_CONFIG = {
  5: { label: 'Critical', color: 'error' },
  4: { label: 'High', color: 'error' },
  3: { label: 'Medium', color: 'warning' },
  2: { label: 'Low', color: 'info' },
  1: { label: 'Minimal', color: 'default' },
};

function formatMoney(n) {
  if (!n) return '-';
  return `₦${Number(n).toLocaleString()}`;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  { id: 'actName', label: 'Act', minWidth: 260, sortField: 'actName' },
  { id: 'sanctionType', label: 'Type', minWidth: 160, sortField: 'sanctionType' },
  { id: 'amount', label: 'Amount (₦)', minWidth: 140, sortField: 'sanctionAmountNaira' },
  { id: 'severity', label: 'Severity', minWidth: 100, sortField: 'severityScore' },
  { id: 'liableRoles', label: 'Liable Roles', minWidth: 180 },
  { id: 'enforced', label: 'Enforced', minWidth: 100, sortField: 'hasBeenEnforced' },
  { id: 'section', label: 'Section', minWidth: 120 },
];

export default function SanctionsPage() {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [actFilter, setActFilter] = useState('All');
  const [enforcedFilter, setEnforcedFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedRow, setExpandedRow] = useState(null);

  const [snackbar, setSnackbar] = useState('');

  const hasFilters = search || typeFilter !== 'All' || actFilter !== 'All' || enforcedFilter !== 'All';

  const loadStats = useCallback(async () => {
    try { setStats(await api.sanctions.stats()); } catch { /* optional */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: rowsPerPage };
      if (search) params.q = search;
      if (typeFilter !== 'All') params.sanctionType = typeFilter;
      if (actFilter !== 'All') params.actName = actFilter;
      if (enforcedFilter !== 'All') params.enforced = enforcedFilter === 'Yes';
      if (sortField) params.sort = `${sortField},${sortDir}`;
      const data = await api.sanctions.list(params);
      setItems(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (e) { setError(e.message || 'Failed to load sanctions.'); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, search, typeFilter, actFilter, enforcedFilter, sortField, sortDir]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadStats(); }, []);

  function clearFilters() {
    setSearch(''); setTypeFilter('All'); setActFilter('All'); setEnforcedFilter('All');
    setPage(0);
  }

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'highSeverity') { /* filter by severity >= 4 — client side */ }
    else if (type === 'enforced') setEnforcedFilter('Yes');
    else setEnforcedFilter('All');
  }

  const kpis = [
    { key: 'total', label: 'Total Sanctions', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'highSeverity', label: 'High Severity', value: stats?.highSeverity ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
    { key: 'enforced', label: 'Enforced', value: stats?.enforced ?? 0, color: '#38A169', bg: '#F0FFF4' },
    { key: 'exposure', label: 'Total Exposure', value: formatMoney(stats?.totalExposure), color: '#DD6B20', bg: '#FFFAF0' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Sanctions Register</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} sanction{total !== 1 ? 's' : ''} — penalties, enforcement and exposure tracking
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
        <TextField size="small" placeholder="Search act, type or description..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 280 }} />
        <TextField select size="small" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          label="Sanction Type" sx={{ minWidth: 150 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.sanctionTypes || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={actFilter} onChange={e => { setActFilter(e.target.value); setPage(0); }}
          label="Act" sx={{ minWidth: 200 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.actNames || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={enforcedFilter} onChange={e => { setEnforcedFilter(e.target.value); setPage(0); }}
          label="Enforced" sx={{ minWidth: 120 }}>
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
      ) : items.length === 0 ? (
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
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else { setSortField(c.sortField); setSortDir('asc'); }
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
                {items.map((item, idx) => {
                  const sev = SEVERITY_CONFIG[item.severityScore] || {};
                  const isExpanded = expandedRow === item.sanctionId;
                  return (
                    <TableRow key={item.sanctionId} hover
                      onClick={() => setExpandedRow(isExpanded ? null : item.sanctionId)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                      <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>
                        <Tooltip title={item.actName || '-'}>
                          <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 280,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.actName || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {item.sanctionType
                          ? <Typography variant="body2">{item.sanctionType}</Typography>
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {formatMoney(item.sanctionAmountNaira)}
                        </Typography>
                        {item.sanctionAmountPerDay && (
                          <Typography variant="caption" color="text.secondary">per day</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {sev.label
                          ? <Chip size="small" label={sev.label} color={sev.color} sx={{ height: 22 }} />
                          : <Typography variant="body2" color="text.secondary">-</Typography>}
                      </TableCell>
                      <TableCell>
                        {item.liableRoles && item.liableRoles.length > 0
                          ? <Tooltip title={item.liableRoles.join(', ')}>
                              <Typography variant="body2" sx={{ maxWidth: 180,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.liableRoles.join(', ')}
                              </Typography>
                            </Tooltip>
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {item.hasBeenEnforced
                          ? <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Yes" size="small" color="success" sx={{ height: 22 }} />
                          : <Chip label="No" size="small" color="default" sx={{ height: 22 }} />}
                      </TableCell>
                      <TableCell>
                        {item.sourceSectionReference
                          ? <Typography variant="body2" color="text.secondary">{item.sourceSectionReference}</Typography>
                          : '-'}
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

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}
