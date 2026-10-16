import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TablePagination, TableSortLabel, Button, CircularProgress, Alert,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, returnColumns, TL,
  ArrowPathIcon, DocumentTextIcon, CalendarDaysIcon, UserGroupIcon, ExclamationCircleIcon,
} from 'shared';
import api from '../../../services/api';

const COLUMNS = returnColumns();

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

  const { data: stats, refetch: refetchStats } = useQuery({
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

  const { data, isLoading, error, refetch } = useQuery({
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
    { key: 'total', label: 'Total Returns', value: stats?.totalReturns ?? 0, tone: 'blue',
      icon: <DocumentTextIcon />, breakdown: stats?.byFrequencyType },
    { key: 'frequencies', label: 'Frequency Types', value: stats?.frequencyTypeCount ?? 0, tone: 'teal',
      icon: <CalendarDaysIcon />, breakdown: stats?.byFrequencyType },
    { key: 'units', label: 'Responsible Units', value: stats?.responsibleUnitCount ?? 0, tone: 'purple',
      icon: <UserGroupIcon />, breakdown: stats?.byResponsibleUnit },
    { key: 'unassigned', label: 'Unassigned', value: stats?.unassignedCount ?? 0, tone: 'orange',
      icon: <ExclamationCircleIcon />, breakdown: stats?.byFrequencyType },
  ];

  const hasFilters = searchInput || frequencyFilter !== 'All' || unitFilter !== 'All' || actFilter !== 'All';

  return (
    <Box>
      <PageHeader
        title="Return Explorer"
        subtitle={`${total} regulatory return${total !== 1 ? 's' : ''} — filing obligations across the compliance universe`}
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { refetch(); refetchStats(); }}>
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      <KpiCards items={kpis} columns={4} onSelect={applyKpi} onDrill={drillKpi} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search returns...' }}
        filters={[
          {
            key: 'frequency', label: 'Frequency type', value: frequencyFilter, allLabel: 'All frequencies',
            onChange: (v) => { setFrequencyFilter(v); setPage(0); },
            options: frequencyTypes.map(f => ({ value: f, label: f })),
          },
          {
            key: 'unit', label: 'Responsible unit', value: unitFilter, allLabel: 'All units', minWidth: 220,
            onChange: (v) => { setUnitFilter(v); setPage(0); },
            options: responsibleUnits.map(u => ({ value: u, label: u })),
          },
          {
            key: 'act', label: 'Act', value: actFilter, allLabel: 'All acts', minWidth: 220,
            onChange: (v) => { setActFilter(v); setPage(0); },
            options: actOptions.map(a => ({ value: String(a.actId), label: a.name })),
          },
        ]}
        showClear={!!hasFilters}
        onClear={clearAll}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <DocumentTextIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No returns found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth,
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
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: TL.mono, fontSize: '0.75rem' }}>{(page * size) + idx + 1}</TableCell>
                    {COLUMNS.map(c => (
                      <TableCell key={c.id}>{c.render ? c.render(row) : (row[c.id] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size} onRowsPerPageChange={e => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
