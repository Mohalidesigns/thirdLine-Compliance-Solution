import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, TablePagination, TableSortLabel,
  Button, CircularProgress, Paper, Tooltip, IconButton, Menu, Alert,
} from '@mui/material';
import {
  Search, Close, Refresh, Gavel, Payments, Warning, Verified, ArrowDropDown,
} from '@mui/icons-material';
import api from '../../../services/api';
import { sanctionColumns } from 'shared';

const PENALTY_TYPE_LABEL = {
  MONETARY: 'Monetary',
  MONETARY_PER_UNIT: 'Per unit',
  MONETARY_PER_DAY: 'Per day',
  PERCENTAGE: 'Percentage',
  IMPRISONMENT: 'Imprisonment',
  LICENCE_ACTION: 'Licence action',
  FORFEITURE: 'Forfeiture',
  RECOVERY: 'Recovery',
  CRIMINAL: 'Criminal',
  DISCRETIONARY: 'Discretionary',
  QUALITATIVE: 'Qualitative',
};

function friendlyTypes(list) {
  if (!list || !list.length) return '—';
  return list.map(t => PENALTY_TYPE_LABEL[t] || t).join(', ');
}

function formatNaira(amount) {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const COLUMNS = sanctionColumns();

/* KPI card with a breakdown dropdown (mirrors the Returns/Instruments pattern). */
function KpiCard({ kpi, onSelect, onDrill }) {
  const [anchor, setAnchor] = useState(null);
  const entries = Object.entries(kpi.breakdown || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Card variant="outlined" onClick={() => onSelect(kpi.key)}
      sx={{ cursor: 'pointer', borderLeft: `4px solid ${kpi.color}`, '&:hover': { boxShadow: 1 } }}>
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ color: kpi.color, opacity: 0.5 }}>{kpi.icon}</Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{kpi.label}</Typography>
          </Box>
          {entries.length > 0 && (
            <IconButton size="small" aria-label={`${kpi.label} breakdown`}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
              <ArrowDropDown fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>{kpi.value}</Typography>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
          onClick={e => e.stopPropagation()}>
          {entries.map(([label, count]) => (
            <MenuItem key={label} dense onClick={() => { setAnchor(null); onDrill(kpi.key, label); }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, width: '100%' }}>
                <span>{label}</span>
                <span style={{ color: '#718096' }}>{count}</span>
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </CardContent>
    </Card>
  );
}

export default function SanctionExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [actFilter, setActFilter] = useState(searchParams.get('actId') || 'All');
  const [penaltyTypeFilter, setPenaltyTypeFilter] = useState(searchParams.get('penaltyType') || 'All');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('liableRole') || 'All');
  const [minAmount, setMinAmount] = useState(searchParams.get('minAmount') || '');
  const [maxAmount, setMaxAmount] = useState(searchParams.get('maxAmount') || '');
  const [enforcedFilter, setEnforcedFilter] = useState(searchParams.get('enforced') || 'All');
  const [minSeverity, setMinSeverity] = useState(searchParams.get('minSeverity') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'severityScore');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'desc');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (actFilter !== 'All') p.actId = actFilter;
    if (penaltyTypeFilter !== 'All') p.penaltyType = penaltyTypeFilter;
    if (roleFilter !== 'All') p.liableRole = roleFilter;
    if (minAmount) p.minAmount = minAmount;
    if (maxAmount) p.maxAmount = maxAmount;
    if (enforcedFilter !== 'All') p.enforced = enforcedFilter;
    if (minSeverity) p.minSeverity = String(minSeverity);
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, actFilter, penaltyTypeFilter, roleFilter, minAmount, maxAmount, enforcedFilter,
      minSeverity, page, size, sortField, sortDir, setSearchParams]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['sanctions-stats'],
    queryFn: ({ signal }) => api.platform.sanctions.stats(signal),
  });

  const queryParams = {
    q: q || undefined,
    regulationId: actFilter !== 'All' ? actFilter : undefined,
    penaltyType: penaltyTypeFilter !== 'All' ? penaltyTypeFilter : undefined,
    liableRole: roleFilter !== 'All' ? roleFilter : undefined,
    minAmount: minAmount || undefined,
    maxAmount: maxAmount || undefined,
    hasBeenEnforced: enforcedFilter === 'Yes' ? true : undefined,
    minSeverity: minSeverity || undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sanctions', q, actFilter, penaltyTypeFilter, roleFilter, minAmount, maxAmount,
      enforcedFilter, minSeverity, page, size, sortField, sortDir],
    queryFn: ({ signal }) => api.platform.sanctions.list(queryParams, signal),
    placeholderData: (prev) => prev,
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;

  const actOptions = stats?.acts || [];
  const penaltyTypeOptions = stats?.penaltyTypes || [];
  const roleOptions = stats?.liableRoles || [];

  const hasFilters = !!searchInput || actFilter !== 'All' || penaltyTypeFilter !== 'All'
    || roleFilter !== 'All' || !!minAmount || !!maxAmount || enforcedFilter !== 'All' || !!minSeverity;

  function clearFilters() {
    setSearchInput(''); setQ(''); setActFilter('All'); setPenaltyTypeFilter('All');
    setRoleFilter('All'); setMinAmount(''); setMaxAmount(''); setEnforcedFilter('All');
    setMinSeverity(''); setPage(0);
  }

  function handleSort(field) {
    if (!field) return;
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function onKpiSelect(key) {
    setPage(0);
    if (key === 'highSeverity') { setMinSeverity('8'); return; }
    if (key === 'enforced') { setEnforcedFilter('Yes'); return; }
    if (key === 'exposure') { setSortField('sanctionAmountNaira'); setSortDir('desc'); return; }
    setMinSeverity(''); setEnforcedFilter('All');
  }

  function onKpiDrill(key, label) {
    setPage(0);
    if (key === 'exposure') {
      const hit = (stats?.byActExposure || []).find(a => (a.name || `Act ${a.actId}`) === label);
      if (hit) setActFilter(String(hit.actId));
      return;
    }
    setPenaltyTypeFilter(label);
    if (key === 'enforced') setEnforcedFilter('Yes');
  }

  const kpis = [
    { key: 'total', label: 'Total Sanctions', value: stats?.total ?? 0, color: '#2B6CB0',
      icon: <Gavel sx={{ fontSize: 20 }} />, breakdown: stats?.byPenaltyType },
    { key: 'exposure', label: 'Monetary Exposure', value: formatNaira(stats?.totalExposure), color: '#DD6B20',
      icon: <Payments sx={{ fontSize: 20 }} />,
      breakdown: Object.fromEntries((stats?.byActExposure || []).slice(0, 8)
        .map(a => [a.name || `Act ${a.actId}`, formatNaira(a.amount)])) },
    { key: 'highSeverity', label: 'High Severity', value: stats?.highSeverity ?? 0, color: '#E53E3E',
      icon: <Warning sx={{ fontSize: 20 }} />, breakdown: stats?.byPenaltyType },
    { key: 'enforced', label: 'Enforced', value: stats?.enforced ?? 0, color: '#38A169',
      icon: <Verified sx={{ fontSize: 20 }} />, breakdown: stats?.enforcedByPenaltyType },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Sanction Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} sanction{total !== 1 ? 's' : ''} — obligations, penalties and responsible parties
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { refetch(); refetchStats(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      {/* KPI cards with breakdown dropdowns */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpis.map(k => (
          <Grid key={k.key} size={{ xs: 6, md: 3 }}>
            <KpiCard kpi={k} onSelect={onKpiSelect} onDrill={onKpiDrill} />
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search obligation..." value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Act</InputLabel>
          <Select label="Act" value={actFilter} onChange={e => { setActFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All acts</MenuItem>
            {actOptions.map(a => (
              <MenuItem key={a.actId} value={String(a.actId)}>
                {a.name?.length > 60 ? a.name.slice(0, 60) + '…' : a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Penalty Type</InputLabel>
          <Select label="Penalty Type" value={penaltyTypeFilter}
            onChange={e => { setPenaltyTypeFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All penalty types</MenuItem>
            {penaltyTypeOptions.map(t => <MenuItem key={t} value={t}>{PENALTY_TYPE_LABEL[t] || t}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" type="number" label="Min amount" value={minAmount}
          onChange={e => { setMinAmount(e.target.value); setPage(0); }} sx={{ width: 130 }} />
        <TextField size="small" type="number" label="Max amount" value={maxAmount}
          onChange={e => { setMaxAmount(e.target.value); setPage(0); }} sx={{ width: 130 }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Responsible Party</InputLabel>
          <Select label="Responsible Party" value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All parties</MenuItem>
            {roleOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        {hasFilters && <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>}
      </Paper>

      {/* Table */}
      {isLoading ? (
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
                {rows.map(s => (
                  <TableRow key={s.sanctionId} hover
                    sx={{ cursor: 'pointer', '& td': { py: 1.5, verticalAlign: 'middle' } }}
                    onClick={() => navigate(`/admin/sanctions/${s.sanctionId}`)}>
                    {COLUMNS.map(c => (
                      <TableCell key={c.id}>{c.render ? c.render(s) : (s[c.id] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size}
            onRowsPerPageChange={e => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}