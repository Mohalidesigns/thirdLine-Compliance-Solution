import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Box, Typography, Alert, Tooltip, Chip, Button } from '@mui/material';
import { api } from '../services/api';
import {
  KpiCards, FilterBar, SectionTable, PageHeader,
  ArrowPathIcon, BuildingLibraryIcon, ScaleIcon, ClipboardDocumentListIcon, CalendarDaysIcon, PlusIcon,
} from 'shared';
import RegulatorFormDialog from '../components/modals/RegulatorFormDialog';
import { useAuth } from '../contexts/AuthContext';

const KPI_ICONS = {
  total: <BuildingLibraryIcon />,
  sanctions: <ScaleIcon />,
  obligations: <ClipboardDocumentListIcon />,
  returns: <CalendarDaysIcon />,
};

const COLUMNS = [
  { id: 'name', label: 'Regulator', minWidth: 300, sortable: true, render: (r) => (
    <Tooltip title={r.name || ''}>
      <Typography variant="body2" sx={{ maxWidth: 360, overflow: 'hidden', color: 'primary.main', fontWeight: 500,
        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.name || 'Untitled'}
      </Typography>
    </Tooltip>
  ) },
  { id: 'abbreviation', label: 'Abbrev', minWidth: 110, sortable: true, render: (r) => (
    r.abbreviation
      ? <Chip label={r.abbreviation} size="small" />
      : <Typography variant="body2" color="text.secondary">—</Typography>
  ) },
  { id: 'obligationCount', label: 'Obligations', minWidth: 120, render: (r) => (
    <Typography variant="body2">{r.obligationCount ?? 0}</Typography>
  ) },
  { id: 'returnCount', label: 'Returns', minWidth: 100, render: (r) => (
    <Typography variant="body2">{r.returnCount ?? 0}</Typography>
  ) },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110, render: (r) => (
    <Typography variant="body2">{r.sanctionCount ?? 0}</Typography>
  ) },
];

export default function RegulatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = ['TENANT_ADMIN', 'CCO'].includes(user?.role);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'name');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, page, size, sortField, sortDir, setSearchParams]);

  const statsQuery = useQuery({
    queryKey: ['regulators', 'stats'],
    queryFn: ({ signal }) => api.regulators.stats({ signal }),
    staleTime: 5 * 60 * 1000,
  });
  const stats = statsQuery.data;

  const params = {
    search: q || undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const listQuery = useQuery({
    queryKey: ['regulators', 'list', params],
    queryFn: ({ signal }) => api.regulators.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const rows = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements ?? 0;

  const hasFilters = !!searchInput;

  function clearFilters() {
    setSearchInput(''); setQ(''); setPage(0);
  }

  function handleSort(field) {
    if (!field) return;
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function onKpiSelect() {
    setPage(0);
    setSearchInput(''); setQ('');
  }

  function onKpiDrill(_key, label) {
    setPage(0);
    setSearchInput(label); setQ(label);
  }

  const kpiItems = [
    { key: 'total', label: 'Total Regulators', tone: 'blue', icon: KPI_ICONS.total,
      value: stats?.total ?? 0, breakdown: stats?.totalBreakdown },
    { key: 'sanctions', label: 'Sanctions', tone: 'purple', icon: KPI_ICONS.sanctions,
      value: stats?.sanctions ?? 0, breakdown: stats?.sanctionsBreakdown },
    { key: 'obligations', label: 'Obligations', tone: 'green', icon: KPI_ICONS.obligations,
      value: stats?.obligations ?? 0, breakdown: stats?.obligationsBreakdown },
    { key: 'returns', label: 'Returns', tone: 'orange', icon: KPI_ICONS.returns,
      value: stats?.returns ?? 0, breakdown: stats?.returnsBreakdown },
  ];

  return (
    <Box>
      <PageHeader
        title="Regulators"
        subtitle={`${total} regulator${total !== 1 ? 's' : ''} — your regulatory subscriptions`}
        actions={(
          <>
            <Tooltip title="Refresh">
              <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />}
                onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}>
                Refresh
              </Button>
            </Tooltip>
            {canManage && (
              <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
                Add Regulator
              </Button>
            )}
          </>
        )}
      />

      {listQuery.error && <Alert severity="error" sx={{ mb: 2 }}>{listQuery.error.message}</Alert>}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search name or abbreviation...', minWidth: 240 }}
        showClear={hasFilters}
        onClear={clearFilters}
      />

      <SectionTable
        columns={COLUMNS}
        rows={rows}
        total={total}
        page={page}
        size={size}
        loading={listQuery.isLoading}
        error={null}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(r) => navigate(`/regulators/${r.id}`)}
        rowKey={(r) => r.id}
        emptyMessage="No regulators subscribed."
      />

      <RegulatorFormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); listQuery.refetch(); statsQuery.refetch(); }} />
    </Box>
  );
}