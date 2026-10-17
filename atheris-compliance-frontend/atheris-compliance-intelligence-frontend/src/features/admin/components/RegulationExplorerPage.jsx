import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Alert, Tooltip,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, StateBadge,
  ArrowPathIcon, InboxArrowDownIcon, ScaleIcon, DocumentTextIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, CalendarDaysIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const COLUMNS = [
  { id: 'name', label: 'Act', minWidth: 320, maxWidth: 380, sortable: true,
    // status + instrument count folded into a caption under the act name (keeps the table at 5 columns)
    render: (row) => (
      <Box>
        <Tooltip title={row.name || 'Untitled act'} placement="top">
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 380,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name || 'Untitled act'}
          </Typography>
        </Tooltip>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <StateBadge value={row.status || 'Active'} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {row.instrumentCount ?? 0} instrument{(row.instrumentCount ?? 0) !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>
    ) },
  { id: 'regulatorName', label: 'Regulator', minWidth: 180, truncate: true, maxWidth: 200 },
  { id: 'obligationCount', label: 'Obligations', minWidth: 110, sortable: true },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110, sortable: true },
  { id: 'returnCount', label: 'Returns', minWidth: 100, sortable: true },
];

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
    { key: 'total', label: 'Total Acts', value: stats?.totalActs ?? 0, tone: 'blue',
      icon: <ScaleIcon />, breakdown: Object.fromEntries((stats?.byRegulator || []).map((r) => [r.name, r.count])) },
    { key: 'instruments', label: 'Instruments', value: stats?.totalInstruments ?? 0, tone: 'teal',
      icon: <DocumentTextIcon />, breakdown: toBreakdown(stats?.topInstruments) },
    { key: 'obligations', label: 'Obligations', value: stats?.totalObligations ?? 0, tone: 'purple',
      icon: <ClipboardDocumentListIcon />, breakdown: toBreakdown(stats?.topObligations) },
    { key: 'sanctions', label: 'Sanctions', value: stats?.totalSanctions ?? 0, tone: 'red',
      icon: <ExclamationTriangleIcon />, breakdown: toBreakdown(stats?.topSanctions) },
    { key: 'returns', label: 'Returns', value: stats?.totalReturns ?? 0, tone: 'orange',
      icon: <CalendarDaysIcon />, breakdown: toBreakdown(stats?.topReturns) },
  ];

  return (
    <Box>
      <PageHeader
        title="Act Explorer"
        subtitle={`${total} act${total !== 1 ? 's' : ''} — browse the curated Nigerian compliance universe`}
        actions={
          <>
            <Button variant="outlined" disabled={importing}
              startIcon={importing ? undefined : <InboxArrowDownIcon size={16} />}
              onClick={handleToolkitImport}>
              {importing ? 'Importing…' : 'Re-import toolkit'}
            </Button>
            <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { refetch(); refetchStats(); }}>
              Refresh
            </Button>
          </>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {importResult && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setImportResult('')}>{importResult}</Alert>}

      <KpiCards items={kpis} columns={5} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search acts...' }}
        filters={[
          {
            // value is the numeric regulatorId (as a string) — the backend filters by id, not name
            key: 'regulator', label: 'Regulator', value: regulatorFilter, allLabel: 'All regulators', minWidth: 220,
            onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: regulatorOptions.map((r) => ({ value: String(r.regulatorId), label: r.name })),
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
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(row) => navigate(`${ROUTES.ADMIN_ACTS}/${row.regulationId}`)}
        rowKey={(r) => r.regulationId}
        emptyMessage="No acts found."
        emptyIcon={<ScaleIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />}
      />
    </Box>
  );
}
