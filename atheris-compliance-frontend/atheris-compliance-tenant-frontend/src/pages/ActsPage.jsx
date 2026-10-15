import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Alert } from '@mui/material';
import {
  SectionTable, PageHeader, KpiCards, FilterBar,
  ArrowPathIcon, BuildingLibraryIcon, ScaleIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, BanknotesIcon,
} from 'shared';
import { api } from '../services/api';

const COLUMNS = [
  { id: 'name', label: 'Act', minWidth: 320, truncate: true, maxWidth: 380, sortable: true, sortField: 'name' },
  { id: 'regulatorName', label: 'Regulator', minWidth: 180, truncate: true, maxWidth: 200 },
  { id: 'obligationCount', label: 'Obligations', minWidth: 110 },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110 },
  { id: 'returnCount', label: 'Returns', minWidth: 100 },
];

/** Top-10 slice of a breakdown map (the KPI dropdown lists at most ten entries). */
function topTen(breakdown) {
  return Object.fromEntries(Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 10));
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
    { key: 'total', label: 'Total Acts', value: stats?.totalActs ?? 0, tone: 'blue',
      icon: <BuildingLibraryIcon />, breakdown: topTen(stats?.byRegulator),
      active: regulatorFilter !== 'All' },
    { key: 'obligations', label: 'Obligations (page)', value: pageTotals.obligations, tone: 'purple',
      icon: <ScaleIcon /> },
    { key: 'controls', label: 'Controls (page)', value: pageTotals.controls, tone: 'teal',
      icon: <ClipboardDocumentCheckIcon /> },
    { key: 'returns', label: 'Returns (page)', value: pageTotals.returns, tone: 'orange',
      icon: <DocumentTextIcon /> },
    { key: 'sanctions', label: 'Sanctions (page)', value: pageTotals.sanctions, tone: 'red',
      icon: <BanknotesIcon /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Acts"
        subtitle={`${total} act${total !== 1 ? 's' : ''} — browse the acts linked to your compliance obligations`}
        actions={(
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={refresh}>
            Refresh
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      <KpiCards items={kpis} onSelect={onKpiSelect} onDrill={onKpiDrill} columns={5} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search acts...' }}
        filters={[
          {
            key: 'regulator', label: 'Regulator', value: regulatorFilter,
            onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: regulatorOptions.map((r) => ({ value: r, label: r })),
            allLabel: 'All regulators', minWidth: 220,
          },
        ]}
        showClear={hasFilters}
        onClear={clearFilters}
      />

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