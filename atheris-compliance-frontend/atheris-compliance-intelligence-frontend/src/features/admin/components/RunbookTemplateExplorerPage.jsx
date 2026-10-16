import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Button, Alert, Tooltip } from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, RiskBadge, TL,
  ArrowPathIcon, ClipboardDocumentCheckIcon, ExclamationTriangleIcon, ExclamationCircleIcon, ListBulletIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import {
  CATEGORY_LABEL, CRITICALITY_LABEL, categoryLabel, criticalityLabel, formatDateTime, humanize,
} from './runbookTemplateLabels';

const CRITICALITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const COLUMNS = [
  { id: 'title', label: 'Template', minWidth: 360, sortable: true,
    // code chip + bold title + grey objective caption (keeps the table at 5 columns)
    render: (row) => (
      <Box sx={{ maxWidth: 520 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{
            fontFamily: TL.mono, fontSize: '0.7rem', px: 0.75, py: '1px', borderRadius: '4px',
            border: `1px solid ${TL.gray300}`, color: TL.gray600, whiteSpace: 'nowrap',
          }}>
            {row.templateCode}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.title}
          </Typography>
        </Box>
        {row.objective && (
          <Tooltip title={row.objective} placement="top-start">
            <Typography variant="caption" sx={{
              display: 'block', color: TL.gray500, mt: 0.25,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.objective}
            </Typography>
          </Tooltip>
        )}
      </Box>
    ) },
  { id: 'category', label: 'Category', minWidth: 160, sortable: true,
    render: (row) => <Typography variant="body2">{categoryLabel(row.category) || '—'}</Typography> },
  { id: 'criticality', label: 'Criticality', minWidth: 120, sortable: true,
    render: (row) => <RiskBadge value={criticalityLabel(row.criticality)} /> },
  { id: 'stepCount', label: 'Steps', minWidth: 90, sortable: true,
    render: (row) => (
      <Tooltip title={`${row.sectionCount ?? 0} section${row.sectionCount === 1 ? '' : 's'}`}>
        <Typography variant="body2">{row.stepCount ?? 0}</Typography>
      </Tooltip>
    ) },
  { id: 'updatedAt', label: 'Updated', minWidth: 130, sortable: true,
    render: (row) => (
      <Box>
        <Typography variant="body2">{formatDateTime(row.updatedAt) || '—'}</Typography>
        <Typography variant="caption" sx={{ color: TL.gray500 }}>v{row.templateVersion ?? 1}</Typography>
      </Box>
    ) },
];

/** Breakdown map keyed by display label (KpiCards shows the keys). */
function labelled(map, toLabel) {
  return Object.fromEntries(Object.entries(map || {}).map(([k, v]) => [toLabel(k), v]));
}

/** Reverse lookup display label → code (for onDrill). */
function codeFor(labels, label) {
  const hit = Object.entries(labels).find(([, l]) => l === label);
  return hit ? hit[0] : label;
}

export default function RunbookTemplateExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [criticality, setCriticality] = useState(searchParams.get('criticality') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'templateCode');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (category !== 'All') p.category = category;
    if (criticality !== 'All') p.criticality = criticality;
    if (page) p.page = String(page);
    if (size !== 20) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, category, criticality, page, size, sortField, sortDir, setSearchParams]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['runbook-templates-stats'],
    queryFn: ({ signal }) => api.platform.runbookTemplates.stats(signal),
  });

  const queryParams = {
    q: q || undefined,
    category: category !== 'All' ? category : undefined,
    criticality: criticality !== 'All' ? criticality : undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['runbook-templates', q, category, criticality, page, size, sortField, sortDir],
    queryFn: ({ signal }) => api.platform.runbookTemplates.list(queryParams, signal),
    placeholderData: (prev) => prev,
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;
  const hasFilters = !!searchInput || category !== 'All' || criticality !== 'All';

  function clearFilters() { setSearchInput(''); setQ(''); setCategory('All'); setCriticality('All'); setPage(0); }

  function handleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  function onKpiSelect(key) {
    setPage(0);
    if (key === 'total' || key === 'steps') { setCategory('All'); setCriticality('All'); }
    if (key === 'critical') setCriticality('CRITICAL');
    if (key === 'high') setCriticality('HIGH');
  }

  function onKpiDrill(key, label) {
    setPage(0);
    const cat = codeFor(CATEGORY_LABEL, label);
    if (key === 'critical') { setCriticality('CRITICAL'); setCategory(cat); return; }
    if (key === 'high') { setCriticality('HIGH'); setCategory(cat); return; }
    setCriticality('All');
    setCategory(cat);
  }

  const byCritCat = stats?.byCriticalityCategory || {};
  const kpis = [
    { key: 'total', label: 'Total Templates', value: stats?.total ?? 0, tone: 'blue',
      icon: <ClipboardDocumentCheckIcon />, breakdown: labelled(stats?.byCategory, categoryLabel) },
    { key: 'critical', label: 'Critical', value: stats?.byCriticality?.CRITICAL ?? 0, tone: 'red',
      icon: <ExclamationCircleIcon />, breakdown: labelled(byCritCat.CRITICAL, categoryLabel) },
    { key: 'high', label: 'High', value: stats?.byCriticality?.HIGH ?? 0, tone: 'orange',
      icon: <ExclamationTriangleIcon />, breakdown: labelled(byCritCat.HIGH, categoryLabel) },
    { key: 'steps', label: 'Steps', value: stats?.totalSteps ?? 0, tone: 'purple',
      icon: <ListBulletIcon />, breakdown: labelled(stats?.stepsByCategory, categoryLabel),
      caption: stats?.total ? `~${Math.round((stats.totalSteps || 0) / stats.total)} per template` : undefined },
  ];

  const categoryOptions = Object.keys({ ...CATEGORY_LABEL, ...(stats?.byCategory || {}) })
    .filter((c) => c !== 'UNSPECIFIED')
    .map((c) => ({ value: c, label: categoryLabel(c) }));
  const criticalityOptions = CRITICALITY_ORDER.map((c) => ({ value: c, label: CRITICALITY_LABEL[c] || humanize(c) }));

  return (
    <Box>
      <PageHeader
        title="Runbook Templates"
        subtitle={`${total} template${total !== 1 ? 's' : ''} — the platform runbook library tenants adopt from`}
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { refetch(); refetchStats(); }}>
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      <KpiCards items={kpis} columns={4} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search code, title or objective...' }}
        filters={[
          {
            key: 'category', label: 'Category', value: category, allLabel: 'All categories', minWidth: 200,
            onChange: (v) => { setCategory(v); setPage(0); },
            options: categoryOptions,
          },
          {
            key: 'criticality', label: 'Criticality', value: criticality, allLabel: 'All criticalities', minWidth: 170,
            onChange: (v) => { setCriticality(v); setPage(0); },
            options: criticalityOptions,
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
        onRowClick={(row) => navigate(`${ROUTES.ADMIN_RUNBOOK_TEMPLATES}/${encodeURIComponent(row.templateCode)}`)}
        rowKey={(r) => r.templateCode}
        emptyMessage="No runbook templates found."
        emptyIcon={<ClipboardDocumentCheckIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />}
      />
    </Box>
  );
}
