import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Grid, TextField, MenuItem, Button, Alert, Paper, IconButton,
  Tooltip, Menu, Card, CardContent,
} from '@mui/material';
import {
  Search, Close, Refresh, Balance, Rule, Assignment, Gavel, RequestQuote, ArrowDropDown,
} from '@mui/icons-material';
import { SectionTable } from 'shared';
import { api } from '../services/api';

const COLUMNS = [
  { id: 'name', label: 'Act', minWidth: 320, truncate: true, maxWidth: 380, sortable: true, sortField: 'name' },
  { id: 'regulatorName', label: 'Regulator', minWidth: 180, truncate: true, maxWidth: 200 },
  { id: 'obligationCount', label: 'Obligations', minWidth: 110 },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110 },
  { id: 'returnCount', label: 'Returns', minWidth: 100 },
];

/* KPI card with a breakdown dropdown. */
function KpiCard({ kpi, onSelect, onDrill }) {
  const [anchor, setAnchor] = useState(null);
  const entries = Object.entries(kpi.breakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <Card variant="outlined" onClick={() => onSelect(kpi.key)}
      sx={{ cursor: 'pointer', borderLeft: `4px solid ${kpi.color}`, '&:hover': { boxShadow: 1 } }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ color: kpi.color, opacity: 0.5 }}>{kpi.icon}</Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{kpi.label}</Typography>
          </Box>
          {entries.length > 0 && (
            <IconButton size="small" aria-label={`${kpi.label} breakdown`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
              <ArrowDropDown fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>{kpi.value}</Typography>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={(e) => e.stopPropagation()}>
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

export default function ActsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [regulatorFilter, setRegulatorFilter] = useState(searchParams.get('regulator') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'name');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (regulatorFilter !== 'All') p.regulator = regulatorFilter;
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, regulatorFilter, page, size, sortField, sortDir, setSearchParams]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['acts-stats'],
    queryFn: ({ signal }) => api.acts.stats({ signal }),
  });

  const params = {
    q: q || undefined,
    regulator: regulatorFilter !== 'All' ? regulatorFilter : undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['acts', q, regulatorFilter, page, size, sortField, sortDir],
    queryFn: ({ signal }) => api.acts.list(params, { signal }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;
  const regulatorOptions = stats?.regulators || [];

  const hasFilters = !!searchInput || regulatorFilter !== 'All';

  function clearFilters() { setSearchInput(''); setQ(''); setRegulatorFilter('All'); setPage(0); }

  function handleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function refresh() { refetch(); refetchStats(); }

  function onKpiSelect(key) {
    setPage(0);
    if (key === 'total') setRegulatorFilter('All');
  }

  // Drill into a regulator from the Total Acts breakdown.
  function onKpiDrill(key, label) {
    if (key !== 'total') return;
    setRegulatorFilter(label);
    setPage(0);
  }

  const pageTotals = rows.reduce((acc, r) => ({
    obligations: acc.obligations + (r.obligationCount || 0),
    controls: acc.controls + (r.controlCount || 0),
    returns: acc.returns + (r.returnCount || 0),
    sanctions: acc.sanctions + (r.sanctionCount || 0),
  }), { obligations: 0, controls: 0, returns: 0, sanctions: 0 });

  const kpis = [
    { key: 'total', label: 'Total Acts', value: stats?.totalActs ?? 0, color: '#2B6CB0',
      icon: <Balance sx={{ fontSize: 20 }} />, breakdown: stats?.byRegulator || {} },
    { key: 'obligations', label: 'Obligations (page)', value: pageTotals.obligations, color: '#805AD5',
      icon: <Rule sx={{ fontSize: 20 }} /> },
    { key: 'controls', label: 'Controls (page)', value: pageTotals.controls, color: '#2C7A7B',
      icon: <Assignment sx={{ fontSize: 20 }} /> },
    { key: 'returns', label: 'Returns (page)', value: pageTotals.returns, color: '#DD6B20',
      icon: <RequestQuote sx={{ fontSize: 20 }} /> },
    { key: 'sanctions', label: 'Sanctions (page)', value: pageTotals.sanctions, color: '#E53E3E',
      icon: <Gavel sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Acts</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} act{total !== 1 ? 's' : ''} — browse the acts linked to your compliance obligations
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={refresh}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpis.map((k) => (
          <Grid key={k.key} size={{ xs: 6, md: 4, lg: 2.4 }}>
            <KpiCard kpi={k} onSelect={onKpiSelect} onDrill={onKpiDrill} />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search acts..." value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <TextField select size="small" value={regulatorFilter} label="Regulator"
          onChange={(e) => { setRegulatorFilter(e.target.value); setPage(0); }} sx={{ minWidth: 220 }}>
          <MenuItem value="All">All regulators</MenuItem>
          {regulatorOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {hasFilters && <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>}
      </Paper>

      <SectionTable
        columns={COLUMNS}
        rows={rows}
        total={total}
        page={page}
        size={size}
        loading={isLoading}
        error={error}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(row) => navigate(`/acts/${row.actId}`)}
        rowKey={(r) => r.actId}
        emptyMessage="No acts found."
      />
    </Box>
  );
}