import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Table, TableHead, TableRow, TableCell, TableBody, TablePagination, TableSortLabel,
  Button, CircularProgress, Paper, Tooltip, IconButton, Menu, Alert,
} from '@mui/material';
import {
  Search, Close, RequestQuote, EventRepeat, Groups, HelpOutline, ArrowDropDown,
} from '@mui/icons-material';
import api from '../../../services/api';

const FREQUENCY_COLOR = {
  Daily: '#C53030',
  Weekly: '#DD6B20',
  Monthly: '#2B6CB0',
  Quarterly: '#2C7A7B',
  Biannual: '#6B46C1',
  Annual: '#2D7D46',
  Adhoc: '#718096',
  'Ad-hoc': '#718096',
  Event: '#805AD5',
};

const COLUMNS = [
  { id: 'title', label: 'Return', minWidth: 320, sortField: 'title' },
  { id: 'frequency', label: 'Frequency', minWidth: 190, sortField: 'frequencyType' },
  { id: 'deadline', label: 'Deadline', minWidth: 200, sortField: 'deadline' },
  { id: 'responsible', label: 'Responsible', minWidth: 200, sortField: 'responsibleUnit' },
];

/* KPI card with a breakdown dropdown (mirrors the Instruments page pattern). */
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

export default function ReturnExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [frequencyFilter, setFrequencyFilter] = useState(searchParams.get('frequencyType') || 'All');
  const [unitFilter, setUnitFilter] = useState(searchParams.get('responsibleUnit') || 'All');
  const [actFilter, setActFilter] = useState(searchParams.get('actId') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'title');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (frequencyFilter !== 'All') p.frequencyType = frequencyFilter;
    if (unitFilter !== 'All') p.responsibleUnit = unitFilter;
    if (actFilter !== 'All') p.actId = actFilter;
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, frequencyFilter, unitFilter, actFilter, page, size, sortField, sortDir, setSearchParams]);

  const returnsApi = api.platform?.returns ?? api.returns;

  const { data: stats } = useQuery({
    queryKey: ['returns-stats'],
    queryFn: ({ signal }) => returnsApi.stats(signal),
  });

  const queryParams = {
    q: q || undefined,
    frequencyType: frequencyFilter !== 'All' ? frequencyFilter : undefined,
    responsibleUnit: unitFilter !== 'All' ? unitFilter : undefined,
    actId: actFilter !== 'All' ? actFilter : undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['returns', q, frequencyFilter, unitFilter, actFilter, page, size, sortField, sortDir],
    queryFn: ({ signal }) => returnsApi.list(queryParams, signal),
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;

  const frequencyTypes = stats?.frequencyTypes || [];
  const responsibleUnits = stats?.responsibleUnits || [];
  const actOptions = stats?.acts || [];

  function clearAll() {
    setSearchInput(''); setQ(''); setFrequencyFilter('All'); setUnitFilter('All'); setActFilter('All');
    setPage(0); setSortField('title'); setSortDir('asc');
  }

  function applyKpi() {
    setPage(0);
    setQ(''); setFrequencyFilter('All'); setUnitFilter('All'); setActFilter('All');
  }

  function drillKpi(key, label) {
    setPage(0);
    if (key === 'units') { setUnitFilter(label); }
    else { setFrequencyFilter(label); }
  }

  function handleSort(field) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  const kpis = [
    { key: 'total', label: 'Total Returns', value: stats?.totalReturns ?? 0, color: '#DD6B20',
      icon: <RequestQuote sx={{ fontSize: 20 }} />, breakdown: stats?.byFrequencyType },
    { key: 'frequencies', label: 'Frequency Types', value: stats?.frequencyTypeCount ?? 0, color: '#2B6CB0',
      icon: <EventRepeat sx={{ fontSize: 20 }} />, breakdown: stats?.byFrequencyType },
    { key: 'units', label: 'Responsible Units', value: stats?.responsibleUnitCount ?? 0, color: '#2C7A7B',
      icon: <Groups sx={{ fontSize: 20 }} />, breakdown: stats?.byResponsibleUnit },
    { key: 'unassigned', label: 'Unassigned', value: stats?.unassignedCount ?? 0, color: '#805AD5',
      icon: <HelpOutline sx={{ fontSize: 20 }} />, breakdown: stats?.byFrequencyType },
  ];

  const hasFilters = searchInput || frequencyFilter !== 'All' || unitFilter !== 'All' || actFilter !== 'All';

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Return Explorer</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {total} regulatory return{total !== 1 ? 's' : ''} — filing obligations across the compliance universe
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpis.map(k => (
          <Grid key={k.key} size={{ xs: 6, md: 3 }}>
            <KpiCard kpi={k} onSelect={applyKpi} onDrill={drillKpi} />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search returns..." value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Frequency type</InputLabel>
          <Select value={frequencyFilter} label="Frequency type" onChange={e => { setFrequencyFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All frequencies</MenuItem>
            {frequencyTypes.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Responsible unit</InputLabel>
          <Select value={unitFilter} label="Responsible unit" onChange={e => { setUnitFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All units</MenuItem>
            {responsibleUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Act</InputLabel>
          <Select value={actFilter} label="Act" onChange={e => { setActFilter(e.target.value); setPage(0); }}>
            <MenuItem value="All">All acts</MenuItem>
            {actOptions.map(a => <MenuItem key={a.actId} value={String(a.actId)}>{a.name}</MenuItem>)}
          </Select>
        </FormControl>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearAll}>Clear</Button>
        )}
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <RequestQuote sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No returns found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <Box sx={{ overflowX: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 50 }}>#</TableCell>
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
                  <TableRow key={row.returnId} hover
                    onClick={() => navigate(`/admin/returns/${row.returnId}`)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{(page * size) + idx + 1}</TableCell>
                    <TableCell>
                      <Tooltip title={row.title || 'Untitled return'}>
                        <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 380,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.title}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {(row.frequencyType || row.frequency) ? (
                        <Chip size="small" label={row.frequencyType || row.frequency}
                          sx={{ height: 22, fontWeight: 700, fontSize: '0.65rem',
                            bgcolor: `${FREQUENCY_COLOR[row.frequencyType] || '#718096'}14`,
                            color: FREQUENCY_COLOR[row.frequencyType] || '#718096' }} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.deadline
                        ? <Tooltip title={row.deadline}>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.deadline}
                            </Typography>
                          </Tooltip>
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.responsibleUnit || 'Unassigned'}
                      </Typography>
                      {row.responsiblePerson && (
                        <Typography variant="caption" color="text.secondary">{row.responsiblePerson}</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size} onRowsPerPageChange={e => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
