import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Tooltip, TablePagination, TableSortLabel, Collapse,
  Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  Search, Refresh, Close, Gavel, CheckCircle,
  KeyboardArrowDown, KeyboardArrowUp,
} from '@mui/icons-material';
import { api } from '../services/api';

const MONO_CHIP_SX = {
  height: 22, borderRadius: '4px',
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
};

function formatNaira(amount) {
  if (amount == null) return '-';
  try {
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount);
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch { return String(amount); }
}

const COLUMNS = [
  { id: 'actName', label: 'Act & Section', minWidth: 280, sortField: 'actName' },
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

function SanctionRow({ item, index, open, onToggle }) {
  const hasDetail = !!(item.description || item.penaltyDetails || item.riskExplanation);
  const roles = Array.isArray(item.liableRoles) ? item.liableRoles : [];

  return (
    <>
      <TableRow hover
        onClick={hasDetail ? onToggle : undefined}
        sx={{ cursor: hasDetail ? 'pointer' : 'default', '&:hover': { bgcolor: '#F7FAFC' } }}>
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

export default function SanctionsPage() {
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

  const params = useMemo(() => {
    const p = { page, size: rowsPerPage };
    if (search) p.q = search;
    if (typeFilter !== 'All') p.sanctionType = typeFilter;
    if (actFilter !== 'All') p.actName = actFilter;
    if (enforcedFilter !== 'All') p.enforced = enforcedFilter === 'Yes';
    if (sortField) p.sort = `${sortField},${sortDir}`;
    return p;
  }, [page, rowsPerPage, search, typeFilter, actFilter, enforcedFilter, sortField, sortDir]);

  const listQuery = useQuery({
    queryKey: ['sanctions', 'list', params],
    queryFn: ({ signal }) => api.sanctions.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['sanctions', 'stats'],
    queryFn: ({ signal }) => api.sanctions.stats({ signal }),
    staleTime: 5 * 60 * 1000,
  });

  const stats = statsQuery.data;
  const items = useMemo(() => listQuery.data?.content || [], [listQuery.data]);
  const total = listQuery.data?.totalElements ?? 0;

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
    { key: 'exposure', label: 'Total Exposure', value: formatNaira(stats?.totalExposure), color: '#DD6B20', bg: '#FFFAF0' },
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
          <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {listQuery.error?.message || 'Failed to load sanctions.'}
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
      {listQuery.isPending ? (
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
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 72 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else { setSortField(c.sortField); setSortDir('asc'); }
                          setPage(0);
                          setExpandedRow(null);
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
                {items.map((item, idx) => (
                  <SanctionRow key={item.sanctionId} item={item}
                    index={page * rowsPerPage + idx + 1}
                    open={expandedRow === item.sanctionId}
                    onToggle={() => setExpandedRow(expandedRow === item.sanctionId ? null : item.sanctionId)} />
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

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}
