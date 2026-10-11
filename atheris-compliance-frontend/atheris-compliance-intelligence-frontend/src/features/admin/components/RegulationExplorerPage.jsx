import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Alert, Paper, IconButton, Tooltip, Menu, Card, CardContent,
} from '@mui/material';
import {
  Search, Close, Refresh, Balance, Assignment, Rule, Gavel, RequestQuote, ArrowDropDown, CloudSync,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import { SectionTable } from 'shared';

const COLUMNS = [
  { id: 'name', label: 'Act', minWidth: 320, truncate: true, maxWidth: 380, sortable: true },
  { id: 'regulatorName', label: 'Regulator', minWidth: 180, truncate: true, maxWidth: 200 },
  { id: 'obligationCount', label: 'Obligations', minWidth: 110, sortable: true },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110, sortable: true },
  { id: 'returnCount', label: 'Returns', minWidth: 100, sortable: true },
];

/* KPI card with a breakdown dropdown (mirrors the Sanctions/Returns pattern). */
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

export default function RegulationExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [regulatorFilter, setRegulatorFilter] = useState(searchParams.get('regulatorId') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'name');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (regulatorFilter !== 'All') p.regulatorId = regulatorFilter;
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, regulatorFilter, page, size, sortField, sortDir, setSearchParams]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['acts-stats'],
    queryFn: ({ signal }) => api.platform.acts.stats(signal),
  });

  const queryParams = {
    q: q || undefined,
    regulatorId: regulatorFilter !== 'All' ? regulatorFilter : undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['acts', q, regulatorFilter, page, size, sortField, sortDir],
    queryFn: ({ signal }) => api.platform.acts.list(queryParams, signal),
    placeholderData: (prev) => prev,
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;
  const regulatorOptions = stats?.regulators || [];

  const hasFilters = !!searchInput || regulatorFilter !== 'All';

  async function handleToolkitImport() {
    if (!window.confirm('Re-import the compliance toolkit? Existing records are kept; only missing fields are filled in.')) return;
    setImporting(true);
    setImportResult('');
    try {
      const r = await api.platform.acts.importToolkit();
      const parts = [
        ['acts added', r?.acts], ['obligations added', r?.obligations],
        ['sanctions added', r?.sanctions], ['returns added', r?.returns],
        ['controls added', r?.controls], ['duplicates removed', r?.controlsDeduplicated],
      ].filter(([, v]) => v != null).map(([k, v]) => `${v} ${k}`);
      setImportResult(parts.length ? `Toolkit import done: ${parts.join(', ')}.` : 'Toolkit import done.');
      refetch(); refetchStats();
    } catch (err) {
      setImportResult('');
      // eslint-disable-next-line no-alert
      window.alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  function clearFilters() { setSearchInput(''); setQ(''); setRegulatorFilter('All'); setPage(0); }

  function handleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function onKpiSelect(key) {
    setPage(0);
    if (key === 'total') { setRegulatorFilter('All'); }
  }

  function onKpiDrill(key, label) {
    setPage(0);
    const hit = (stats?.byRegulator || []).find((r) => (r.name || `Regulator ${r.regulatorId}`) === label);
    if (hit) setRegulatorFilter(String(hit.regulatorId));
  }

  const toBreakdown = (list) => Object.fromEntries((list || []).map((a) => [
    (a.name || `Act ${a.actId}`).length > 42 ? `${(a.name || `Act ${a.actId}`).slice(0, 42)}…` : (a.name || `Act ${a.actId}`),
    a.count,
  ]));

  const kpis = [
    { key: 'total', label: 'Total Acts', value: stats?.totalActs ?? 0, color: '#2B6CB0',
      icon: <Balance sx={{ fontSize: 20 }} />, breakdown: Object.fromEntries((stats?.byRegulator || []).map((r) => [r.name, r.count])) },
    { key: 'instruments', label: 'Instruments', value: stats?.totalInstruments ?? 0, color: '#2C7A7B',
      icon: <Assignment sx={{ fontSize: 20 }} />, breakdown: toBreakdown(stats?.topInstruments) },
    { key: 'obligations', label: 'Obligations', value: stats?.totalObligations ?? 0, color: '#805AD5',
      icon: <Rule sx={{ fontSize: 20 }} />, breakdown: toBreakdown(stats?.topObligations) },
    { key: 'sanctions', label: 'Sanctions', value: stats?.totalSanctions ?? 0, color: '#E53E3E',
      icon: <Gavel sx={{ fontSize: 20 }} />, breakdown: toBreakdown(stats?.topSanctions) },
    { key: 'returns', label: 'Returns', value: stats?.totalReturns ?? 0, color: '#DD6B20',
      icon: <RequestQuote sx={{ fontSize: 20 }} />, breakdown: toBreakdown(stats?.topReturns) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Act Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} act{total !== 1 ? 's' : ''} — browse the curated Nigerian compliance universe
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="outlined" size="small" disabled={importing}
            startIcon={importing ? undefined : <CloudSync />}
            onClick={handleToolkitImport} sx={{ textTransform: 'none' }}>
            {importing ? 'Importing…' : 'Re-import toolkit'}
          </Button>
          <Tooltip title="Refresh"><IconButton onClick={() => { refetch(); refetchStats(); }}><Refresh /></IconButton></Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {importResult && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setImportResult('')}>{importResult}</Alert>}

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
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Regulator</InputLabel>
          <Select label="Regulator" value={regulatorFilter}
            onChange={(e) => { setRegulatorFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All regulators</MenuItem>
            {regulatorOptions.map((r) => <MenuItem key={r.regulatorId} value={String(r.regulatorId)}>{r.name}</MenuItem>)}
          </Select>
        </FormControl>
        {hasFilters && <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>}
      </Paper>

      <SectionTable
        columns={COLUMNS}
        rows={rows}
        total={total}
        page={page}
        size={size}
        loading={isLoading}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(row) => navigate(`${ROUTES.ADMIN_ACTS}/${row.regulationId}`)}
        rowKey={(r) => r.regulationId}
        emptyMessage="No acts found."
      />
    </Box>
  );
}
