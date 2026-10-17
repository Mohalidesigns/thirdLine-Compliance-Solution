import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, TextField, Alert, Button } from '@mui/material';
import api from '../../../services/api';
import {
  PageHeader, SectionTable, KpiCards, FilterBar, FilterField, sanctionColumns, sanctionRegister, PENALTY_TYPE_LABEL,
  ArrowPathIcon, ScaleIcon, BanknotesIcon, ExclamationTriangleIcon, CheckCircleIcon,
} from 'shared';

const COLUMNS = sanctionColumns();
const KPI_ICONS = {
  total: <ScaleIcon />,
  exposure: <BanknotesIcon />,
  highSeverity: <ExclamationTriangleIcon />,
  enforced: <CheckCircleIcon />,
};

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

  const hasFilters = !!searchInput || actFilter !== 'All' || penaltyTypeFilter !== 'All'
    || roleFilter !== 'All' || !!minAmount || !!maxAmount || enforcedFilter !== 'All' || !!minSeverity;

  function clearFilters() {
    setSearchInput(''); setQ(''); setActFilter('All'); setPenaltyTypeFilter('All');
    setRoleFilter('All'); setMinAmount(''); setMaxAmount(''); setEnforcedFilter('All');
    setMinSeverity(''); setPage(0);
  }

  function handleSort(field) {
    if (!field) return;
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
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
      const hit = (stats?.byActExposure || []).find((a) => (a.name || `Act ${a.actId}`) === label);
      if (hit) setActFilter(String(hit.actId));
      return;
    }
    setPenaltyTypeFilter(label);
    if (key === 'enforced') setEnforcedFilter('Yes');
  }

  const kpiItems = sanctionRegister.kpis.map((k) => ({
    key: k.key,
    label: k.label,
    color: k.color,
    icon: KPI_ICONS[k.key],
    value: k.value(stats),
    breakdown: k.breakdown ? k.breakdown(stats) : undefined,
  }));

  const filters = [
    { key: 'actId', label: 'Act', minWidth: 220, value: actFilter,
      onChange: (v) => { setActFilter(v); setPage(0); }, allLabel: 'All acts',
      options: (stats?.acts || []).map((a) => ({ value: String(a.actId),
        label: a.name?.length > 60 ? a.name.slice(0, 60) + '…' : a.name })) },
    { key: 'penaltyType', label: 'Penalty Type', minWidth: 160, value: penaltyTypeFilter,
      onChange: (v) => { setPenaltyTypeFilter(v); setPage(0); }, allLabel: 'All penalty types',
      options: (stats?.penaltyTypes || []).map((t) => ({ value: t, label: PENALTY_TYPE_LABEL[t] || t })) },
    { key: 'liableRole', label: 'Responsible Party', minWidth: 180, value: roleFilter,
      onChange: (v) => { setRoleFilter(v); setPage(0); }, allLabel: 'All parties',
      options: (stats?.liableRoles || []).map((r) => ({ value: r, label: r })) },
  ];

  return (
    <Box>
      <PageHeader
        title="Sanction Explorer"
        subtitle={`${total} sanction${total !== 1 ? 's' : ''} — obligations, penalties and responsible parties`}
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { refetch(); refetchStats(); }}>
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search obligation...' }}
        filters={filters}
        showClear={hasFilters}
        onClear={clearFilters}
      >
        <FilterField label="Min amount" minWidth={130}>
          <TextField size="small" type="number" value={minAmount}
            onChange={(e) => { setMinAmount(e.target.value); setPage(0); }}
            sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 40 } }} />
        </FilterField>
        <FilterField label="Max amount" minWidth={130}>
          <TextField size="small" type="number" value={maxAmount}
            onChange={(e) => { setMaxAmount(e.target.value); setPage(0); }}
            sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 40 } }} />
        </FilterField>
      </FilterBar>

      <SectionTable
        columns={COLUMNS}
        rows={rows}
        total={total}
        page={page}
        size={size}
        loading={isLoading}
        error={null}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(s) => navigate(`/admin/sanctions/${s.sanctionId}`)}
        rowKey={(s) => s.sanctionId}
        emptyMessage="No sanctions found."
      />
    </Box>
  );
}
