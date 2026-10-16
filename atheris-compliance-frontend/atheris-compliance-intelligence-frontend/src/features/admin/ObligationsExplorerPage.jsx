import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Box, Typography, Chip, Tooltip, IconButton, Alert } from '@mui/material';
import { Refresh, InfoOutlined } from '@mui/icons-material';
import { KpiCards, FilterBar, SectionTable } from 'shared';
import api from '../../services/api';

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

const COLUMNS = [
  { id: 'title', label: 'Obligation', minWidth: 360, sortable: true, sortField: 'title',
    render: (item) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={item.title || item.plainEnglishStatement || ''}>
          <Typography variant="body2" sx={ellipsis(420)}>
            {item.title || item.plainEnglishStatement || 'Untitled obligation'}
          </Typography>
        </Tooltip>
        {item.description && (
          <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Box>}>
            <InfoOutlined sx={{ fontSize: 14, color: '#A0AEC0', flexShrink: 0 }} />
          </Tooltip>
        )}
      </Box>
    ) },
  { id: 'regulatorAbbreviation', label: 'Regulator', minWidth: 130,
    render: (item) => (item.regulatorAbbreviation
      ? <Chip size="small" label={item.regulatorAbbreviation}
          sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
  { id: 'returnCount', label: 'Returns', minWidth: 100,
    render: (item) => (
      <Typography variant="body2"
        sx={(item.returnCount ?? 0) === 0 ? { color: 'text.secondary' } : { color: '#DD6B20' }}>
        {item.returnCount ?? 0}
      </Typography>
    ) },
  { id: 'controlCount', label: 'Controls', minWidth: 110,
    render: (item) => (
      <Typography variant="body2"
        sx={(item.controlCount ?? 0) === 0 ? { color: 'text.secondary' } : { color: '#2D7D46' }}>
        {item.controlCount ?? 0}
      </Typography>
    ) },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110,
    render: (item) => (
      <Typography variant="body2"
        sx={(item.sanctionCount ?? 0) === 0 ? { color: 'text.secondary' } : { color: '#805AD5' }}>
        {item.sanctionCount ?? 0}
      </Typography>
    ) },
];

export default function ObligationsExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [risk, setRisk] = useState(searchParams.get('risk') || 'All');
  const [regulator, setRegulator] = useState(searchParams.get('regulator') || 'All');
  const [area, setArea] = useState(searchParams.get('areaOfFocus') || 'All');
  const [act, setAct] = useState(searchParams.get('act') || 'All');
  const [hasPoints, setHasPoints] = useState(searchParams.get('hasPoints') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || '');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (risk !== 'All') p.risk = risk;
    if (regulator !== 'All') p.regulator = regulator;
    if (area !== 'All') p.areaOfFocus = area;
    if (act !== 'All') p.act = act;
    if (hasPoints !== 'All') p.hasPoints = hasPoints;
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, risk, regulator, area, act, hasPoints, page, size, sortField, sortDir, setSearchParams]);

  const statsQuery = useQuery({
    queryKey: ['obligations', 'stats'],
    queryFn: ({ signal }) => api.platform.obligations.stats(signal),
  });
  const stats = statsQuery.data;

  const queryParams = {
    q: q || undefined,
    risk: risk !== 'All' ? risk : undefined,
    regulator: regulator !== 'All' ? regulator : undefined,
    areaOfFocus: area !== 'All' ? area : undefined,
    act: act !== 'All' ? act : undefined,
    hasPoints: hasPoints === 'With' ? true : hasPoints === 'Without' ? false : undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const listQuery = useQuery({
    queryKey: ['obligations', 'list', queryParams],
    queryFn: ({ signal }) => api.platform.obligations.list(queryParams, signal),
    placeholderData: keepPreviousData,
  });

  const rows = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements ?? 0;

  const hasFilters = !!searchInput || risk !== 'All' || regulator !== 'All'
    || area !== 'All' || act !== 'All' || hasPoints !== 'All';

  function clearFilters() {
    setSearchInput(''); setQ(''); setRisk('All'); setRegulator('All');
    setArea('All'); setAct('All'); setHasPoints('All'); setPage(0);
  }

  function handleSort(field) {
    if (!field) return;
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function applyKpi(key) {
    setPage(0);
    if (key === 'highRisk') { setRisk('High'); setHasPoints('All'); }
    else if (key === 'withPoints') { setHasPoints('With'); setRisk('All'); }
    else if (key === 'withoutPoints') { setHasPoints('Without'); setRisk('All'); }
    else { setRisk('All'); setHasPoints('All'); }
  }

  function drillKpi(_key, label) {
    setPage(0);
    setRisk(label);
  }

  const kpiItems = [
    { key: 'total', label: 'Total', color: '#1976d2', value: stats?.total ?? 0, breakdown: stats?.byRiskRating },
    { key: 'highRisk', label: 'High Risk', color: '#d32f2f', value: stats?.highRisk ?? 0 },
    { key: 'withPoints', label: 'With Points', color: '#2e7d32', value: stats?.withPoints ?? 0 },
    { key: 'withoutPoints', label: 'Without Points', color: '#ed6c02', value: stats?.withoutPoints ?? 0 },
  ];

  const toOptions = (values) => (values || []).map((v) => ({ value: v, label: v }));
  const riskOptions = toOptions(stats?.risks?.length ? stats.risks : ['Critical', 'High', 'Moderate', 'Low']);
  const regulatorOptions = toOptions(stats?.regulators);
  const areaOptions = toOptions(stats?.areas);
  const actOptions = toOptions(stats?.acts);
  const pointOptions = [{ value: 'With', label: 'With' }, { value: 'Without', label: 'Without' }];

  const filterDefs = [
    { key: 'risk', label: 'Risk', value: risk, onChange: (v) => { setRisk(v); setPage(0); }, options: riskOptions, minWidth: 110 },
    { key: 'regulator', label: 'Regulator', value: regulator, onChange: (v) => { setRegulator(v); setPage(0); }, options: regulatorOptions, minWidth: 130 },
    { key: 'areaOfFocus', label: 'Area of Focus', value: area, onChange: (v) => { setArea(v); setPage(0); }, options: areaOptions, minWidth: 160 },
    { key: 'act', label: 'Act', value: act, onChange: (v) => { setAct(v); setPage(0); }, options: actOptions, minWidth: 140 },
    { key: 'hasPoints', label: 'Points', value: hasPoints, onChange: (v) => { setHasPoints(v); setPage(0); }, options: pointOptions, minWidth: 120 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Obligations Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} obligation{total !== 1 ? 's' : ''} — the platform's curated obligation catalogue
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {listQuery.error && <Alert severity="error" sx={{ mb: 2 }}>{listQuery.error.message}</Alert>}

      <KpiCards items={kpiItems} onSelect={applyKpi} onDrill={drillKpi} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search obligation, title or regulator...', minWidth: 240 }}
        filters={filterDefs}
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
        onRowClick={(r) => navigate(`/admin/obligations/${r.obligationId}`)}
        rowKey={(r) => r.obligationId}
        emptyMessage="No obligations found."
      />
    </Box>
  );
}
