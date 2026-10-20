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
  // Default to the acts in this tenant's register (the platform has hundreds the tenant never adopted).
  const [allActs, setAllActs] = useState(searchParams.get('all') === '1');

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
    if (allActs) p.all = '1';
    setSearchParams(p, { replace: true });
  }, [q, regulatorFilter, page, size, sortField, sortDir, allActs, setSearchParams]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['acts-stats'],
    queryFn: ({ signal }) => api.acts.stats({ signal }),
  });

  const params = {
    q: q || undefined,
    regulator: regulatorFilter !== 'All' ? regulatorFilter : undefined,
    inRegister: allActs ? undefined : 'true',
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['acts', q, regulatorFilter, allActs, page, size, sortField, sortDir],
    queryFn: ({ signal }) => api.acts.list(params, { signal }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;
  const regulatorOptions = stats?.regulators || [];

  const hasFilters = !!searchInput || regulatorFilter !== 'All' || allActs;

  function clearFilters() { setSearchInput(''); setQ(''); setRegulatorFilter('All'); setAllActs(false); setPage(0); }

  function handleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function refresh() { refetch(); refetchStats(); }

  function onKpiSelect(key) {
    setPage(0);
    if (key === 'register') { setAllActs(false); setRegulatorFilter('All'); }
    if (key === 'total') { setAllActs(true); setRegulatorFilter('All'); }
  }

  // Drill into a regulator from the Total Acts breakdown.
  function onKpiDrill(key, label) {
    if (key !== 'total') return;
    setAllActs(true); // the breakdown counts every platform act
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
    { key: 'register', label: 'In My Register', value: stats?.actsInRegister ?? 0, tone: 'green',
      icon: <ScaleIcon />, active: !allActs },
    { key: 'total', label: 'All Platform Acts', value: stats?.totalActs ?? 0, tone: 'blue',
      icon: <BuildingLibraryIcon />, breakdown: topTen(stats?.byRegulator),
      active: allActs },
    { key: 'obligations', label: 'Obligations (page)', value: pageTotals.obligations, tone: 'purple',
      icon: <ScaleIcon /> },
    { key: 'controls', label: 'Controls (page)', value: pageTotals.controls, tone: 'teal',
      icon: <ClipboardDocumentCheckIcon /> },
    { key: 'returns', label: 'Returns (page)', value: pageTotals.returns, tone: 'orange',
      icon: <DocumentTextIcon /> },
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