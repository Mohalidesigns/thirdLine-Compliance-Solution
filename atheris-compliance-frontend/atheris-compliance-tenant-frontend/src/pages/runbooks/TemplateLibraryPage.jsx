import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography } from '@mui/material';
import {
  FilterBar, KpiCards, PageHeader, RiskBadge, SectionTable, StatusBadge,
  BookOpenIcon, CheckCircleIcon, ArrowPathIcon, ExclamationTriangleIcon,
} from 'shared';
import { api } from '../../services/api';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import {
  CATEGORIES, CRITICALITIES, FREQUENCIES, areaOfFocus, humanize, label,
} from './runbookConstants';

const ADOPTION_OPTIONS = [
  { value: 'ADOPTED', label: 'Adopted' },
  { value: 'UPDATE', label: 'Update available' },
  { value: 'NOT_ADOPTED', label: 'Not adopted' },
];

const adoptionOf = (t) => (t.adopted ? (t.updateAvailable ? 'UPDATE' : 'ADOPTED') : 'NOT_ADOPTED');

function countBy(rows, fn) {
  return rows.reduce((acc, r) => {
    const k = fn(r);
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function AdoptionBadge({ t }) {
  if (!t.adopted) return <StatusBadge label="Not adopted" tone="gray" />;
  if (t.updateAvailable) {
    return (
      <StatusBadge label={`Update available (v${t.templateVersion})`} tone="amber"
        title={`Adopted v${t.adoptedTemplateVersion ?? '?'}; platform now at v${t.templateVersion}`} />
    );
  }
  return <StatusBadge label={`Adopted v${t.adoptedTemplateVersion ?? t.templateVersion}`} tone="green" />;
}

const COLUMNS = [
  { id: 'title', label: 'Template', minWidth: 320, render: (t) => (
    <Typography variant="body2" sx={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      title={t.title}>
      {t.title || 'Untitled template'}
    </Typography>
  ) },
  { id: 'category', label: 'Category', minWidth: 170, render: (t) => (
    <Box>
      <Typography variant="body2">{label(CATEGORIES, t.category)}</Typography>
      <Typography variant="caption" color="text.secondary">{label(FREQUENCIES, t.frequency)}</Typography>
    </Box>
  ) },
  { id: 'areaOfFocus', label: 'Area of focus', minWidth: 180, render: (t) => (
    <Typography variant="body2">{areaOfFocus(t.category)}</Typography>
  ) },
  { id: 'criticality', label: 'Criticality', minWidth: 120, render: (t) => <RiskBadge value={humanize(t.criticality)} /> },
  { id: 'status', label: 'Status', minWidth: 180, render: (t) => <AdoptionBadge t={t} /> },
];

export default function TemplateLibraryPage() {
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [criticality, setCriticality] = useState('All');
  const [adoption, setAdoption] = useState('All');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ['runbook-templates'],
    queryFn: ({ signal }) => api.runbooks.templates.list({ signal }),
  });
  const templates = useMemo(() => (Array.isArray(data) ? data : (data?.content || [])), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return templates.filter((t) => (category === 'All' || t.category === category)
      && (criticality === 'All' || t.criticality === criticality)
      && (adoption === 'All' || adoptionOf(t) === adoption)
      && (!needle || [t.templateCode, t.title, t.objective, ...(t.clauseRefs || [])]
        .some((v) => String(v || '').toLowerCase().includes(needle))));
  }, [templates, q, category, criticality, adoption]);
  const pageRows = filtered.slice(page * size, page * size + size);

  const adopted = templates.filter((t) => t.adopted);
  const updates = templates.filter((t) => t.adopted && t.updateAvailable);
  const critical = templates.filter((t) => t.criticality === 'CRITICAL');
  const byCat = (rows) => countBy(rows, (t) => label(CATEGORIES, t.category));
  const kpis = [
    { key: 'all', label: 'Templates', value: templates.length, tone: 'blue', icon: <BookOpenIcon size={16} />,
      breakdown: byCat(templates), active: adoption === 'All' && category === 'All' && criticality === 'All' },
    { key: 'ADOPTED', label: 'Adopted', value: adopted.length, tone: 'green', icon: <CheckCircleIcon size={16} />,
      caption: `${templates.length - adopted.length} not adopted`, breakdown: byCat(adopted), active: adoption === 'ADOPTED' },
    { key: 'UPDATE', label: 'Updates available', value: updates.length, tone: 'amber', icon: <ArrowPathIcon size={16} />,
      breakdown: byCat(updates), active: adoption === 'UPDATE' },
    { key: 'CRITICAL', label: 'Critical', value: critical.length, tone: 'red', icon: <ExclamationTriangleIcon size={16} />,
      breakdown: countBy(templates, (t) => humanize(t.criticality)), active: criticality === 'CRITICAL' },
  ];

  const clearFilters = () => { setQ(''); setCategory('All'); setCriticality('All'); setAdoption('All'); setPage(0); };
  const onKpiSelect = (key) => {
    setPage(0);
    if (key === 'all') clearFilters();
    else if (key === 'CRITICAL') setCriticality(criticality === 'CRITICAL' ? 'All' : 'CRITICAL');
    else setAdoption(adoption === key ? 'All' : key);
  };
  const onKpiDrill = (key, lbl) => {
    setPage(0);
    if (key === 'CRITICAL') {
      const c = CRITICALITIES.find((x) => humanize(x) === lbl);
      if (c) setCriticality(c);
      return;
    }
    const cat = CATEGORIES.find((c) => c.label === lbl);
    if (cat) setCategory(cat.value);
    if (key === 'ADOPTED' || key === 'UPDATE') setAdoption(key);
  };
  const resetPage = (fn) => (v) => { fn(v); setPage(0); };

  const openDetail = (t) => navigate(`/runbooks/templates/${encodeURIComponent(t.templateCode)}`);

  return (
    <Box>
      <PageHeader
        title="Runbook Templates"
        subtitle="Platform runbook templates you can adopt as your own versioned runbooks"
      />
      <RunbooksNav counts={updates.length ? { '/runbooks/templates': updates.length } : {}} />

      <KpiCards items={kpis} columns={4} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: q, onChange: resetPage(setQ), placeholder: 'Search code, title, objective or clause…' }}
        filters={[
          { key: 'category', label: 'Category', value: category, onChange: resetPage(setCategory), options: CATEGORIES },
          { key: 'criticality', label: 'Criticality', value: criticality, onChange: resetPage(setCriticality),
            options: CRITICALITIES.map((c) => ({ value: c, label: humanize(c) })) },
          { key: 'adoption', label: 'Status', value: adoption, onChange: resetPage(setAdoption), options: ADOPTION_OPTIONS },
        ]}
        showClear={q !== '' || category !== 'All' || criticality !== 'All' || adoption !== 'All'}
        onClear={clearFilters}
      />

      <SectionTable
        columns={COLUMNS}
        rows={pageRows}
        total={filtered.length}
        page={page}
        size={size}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        loading={isLoading}
        error={error}
        rowKey={(t) => t.templateCode}
        onRowClick={openDetail}
        emptyMessage={templates.length ? 'No templates match these filters.' : 'No templates published by the platform yet.'}
      />
    </Box>
  );
}
