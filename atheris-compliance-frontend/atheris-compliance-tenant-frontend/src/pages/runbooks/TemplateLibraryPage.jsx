import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DataCard, EntityDrawer, FilterBar, KpiCards, PageHeader, RiskBadge, SectionTable, StatusBadge, TL,
  BookOpenIcon, CheckCircleIcon, ArrowPathIcon, ExclamationTriangleIcon, PlusIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import AdoptTemplateDialog from '../../components/runbooks/AdoptTemplateDialog';
import {
  APPROVER_ROLES, CATEGORIES, CRITICALITIES, FREQUENCIES, SECTION_TYPES, formatMinutes, humanize, label,
} from './runbookConstants';

const codeChipSx = { height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' };
const sectionLabelSx = {
  fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase',
  letterSpacing: '0.05em', mb: 1,
};
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

/* ------------------------------------------------------------- Drawer preview */

function TemplatePreview({ summary, canAdopt, onAdopt }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['runbook-template', String(summary.templateCode)],
    queryFn: ({ signal }) => api.runbooks.templates.get(summary.templateCode, { signal }),
  });
  const t = data || summary;
  const content = data?.content || {};
  const sections = content.sections || [];
  const prereqs = content.prerequisites || [];
  const escalations = content.escalations || [];
  const rollback = content.rollback || [];
  const clauseRefs = t.clauseRefs?.length
    ? t.clauseRefs
    : (content.clauses || []).map((c) => `${c.framework} ${c.clauseRef}`);

  return (
    <Box>
      {t.adopted && t.updateAvailable && (
        <Alert
          severity="warning" sx={{ mb: 2 }}
          action={t.adoptedRunbookId != null && (
            <Button color="inherit" size="small" onClick={() => navigate(`/runbooks/${t.adoptedRunbookId}`)}>
              Review update
            </Button>
          )}
        >
          Template updated to v{t.templateVersion} — your runbook was adopted from v{t.adoptedTemplateVersion ?? '?'}.
          Open the runbook to review the changes and create a revision.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {t.adopted && t.adoptedRunbookId != null && (
          <Button variant="contained" onClick={() => navigate(`/runbooks/${t.adoptedRunbookId}`)}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Open runbook
          </Button>
        )}
        {!t.adopted && canAdopt && (
          <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => onAdopt(t)}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Adopt template
          </Button>
        )}
        {!t.adopted && !canAdopt && (
          <Typography variant="caption" color="text.secondary">Only a CCO or Tenant Admin can adopt templates.</Typography>
        )}
      </Box>

      <DataCard sx={{ mb: 2 }}>
        {t.objective && <Typography variant="body2" sx={{ mb: 1.5 }}>{t.objective}</Typography>}
        <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '6px 16px' }}>
          <Typography variant="caption" color="text.secondary">Category</Typography>
          <Typography variant="body2">{label(CATEGORIES, t.category)}</Typography>
          <Typography variant="caption" color="text.secondary">Criticality</Typography>
          <Box><RiskBadge value={humanize(t.criticality)} /></Box>
          <Typography variant="caption" color="text.secondary">Frequency</Typography>
          <Typography variant="body2">{label(FREQUENCIES, t.frequency)}</Typography>
          <Typography variant="caption" color="text.secondary">SLA</Typography>
          <Typography variant="body2">{formatMinutes(t.slaMinutes)}</Typography>
          <Typography variant="caption" color="text.secondary">Template version</Typography>
          <Typography variant="body2">v{t.templateVersion}</Typography>
          <Typography variant="caption" color="text.secondary">Adoption</Typography>
          <Box><AdoptionBadge t={t} /></Box>
          {(content.scopeSystems || []).length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">Systems</Typography>
              <Typography variant="body2">{content.scopeSystems.join(', ')}</Typography>
            </>
          )}
        </Box>
      </DataCard>

      <Typography sx={sectionLabelSx}>Clauses ({clauseRefs.length})</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
        {clauseRefs.length
          ? clauseRefs.map((c) => <Chip key={c} label={c} size="small" sx={{ height: 22, fontSize: '.7rem' }} />)
          : <Typography variant="body2" color="text.secondary">None mapped.</Typography>}
      </Box>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
      {isError && <Alert severity="warning" sx={{ mb: 2 }}>Could not load template content: {error?.message}</Alert>}

      {data && (
        <>
          {prereqs.length > 0 && (
            <>
              <Typography sx={sectionLabelSx}>Prerequisites ({prereqs.length})</Typography>
              <DataCard sx={{ mb: 2 }} contentSx={{ p: 2 }}>
                {prereqs.map((p, i) => (
                  <Box key={`${p.label}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.5 }}>
                    <StatusBadge label={humanize(p.prereqType)} tone="blue" />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2">
                        {p.label}
                        {p.mandatory && <Box component="span" sx={{ color: TL.error, ml: 0.5 }}>*</Box>}
                      </Typography>
                      {p.detail && <Typography variant="caption" color="text.secondary">{p.detail}</Typography>}
                    </Box>
                  </Box>
                ))}
              </DataCard>
            </>
          )}

          <Typography sx={sectionLabelSx}>Steps ({t.stepCount ?? sections.reduce((n, s) => n + (s.steps || []).length, 0)})</Typography>
          <DataCard sx={{ mb: 2 }} contentSx={{ p: 2 }}>
            {sections.length === 0 && <Typography variant="body2" color="text.secondary">No steps.</Typography>}
            {sections.map((s, si) => (
              <Box key={`${s.title}-${si}`} sx={{ mb: 1.5, '&:last-of-type': { mb: 0 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <StatusBadge label={label(SECTION_TYPES, s.sectionType)} tone="purple" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.title}</Typography>
                </Box>
                {(s.steps || []).map((st, i) => (
                  <Box key={`${st.stepCode}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: 1, py: 0.25 }}>
                    <Chip label={st.stepCode || i + 1} size="small" variant="outlined" sx={codeChipSx} />
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={st.title}>{st.title}</Typography>
                    {st.assignedRole && <Typography variant="caption" color="text.secondary">{humanize(st.assignedRole)}</Typography>}
                  </Box>
                ))}
              </Box>
            ))}
          </DataCard>

          {escalations.length > 0 && (
            <>
              <Typography sx={sectionLabelSx}>Escalation ({escalations.length})</Typography>
              <DataCard sx={{ mb: 2 }} contentSx={{ p: 2 }}>
                {escalations.map((e, i) => (
                  <Box key={`${e.level}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.5 }}>
                    <StatusBadge label={`L${e.level}`} tone={e.level >= 3 ? 'red' : e.level === 2 ? 'orange' : 'amber'} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2">
                        {humanize(e.triggerType)} → {humanize(e.notifyRole)} via {humanize(e.notifyChannel)}
                        {e.waitMinutes ? ` after ${formatMinutes(e.waitMinutes)}` : ''}
                      </Typography>
                      {e.instructions && <Typography variant="caption" color="text.secondary">{e.instructions}</Typography>}
                    </Box>
                  </Box>
                ))}
              </DataCard>
            </>
          )}

          {rollback.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Includes {rollback.length} rollback step{rollback.length === 1 ? '' : 's'}.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------- Page */

export default function TemplateLibraryPage() {
  const { user } = useAuth();
  const canAdopt = APPROVER_ROLES.includes(user?.role);

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [criticality, setCriticality] = useState('All');
  const [adoption, setAdoption] = useState('All');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [adoptTarget, setAdoptTarget] = useState(null);

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

  const columns = [
    { id: 'template', label: 'Template', minWidth: 320, render: (t) => (
      <Box sx={{ minWidth: 0, maxWidth: 520 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={t.templateCode} size="small" variant="outlined" sx={codeChipSx} />
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={t.title}>{t.title}</Typography>
        </Box>
        {t.objective && (
          <Typography variant="caption" color="text.secondary" sx={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {t.objective}
          </Typography>
        )}
      </Box>
    ) },
    { id: 'category', label: 'Category', render: (t) => (
      <Box>
        <Typography variant="body2">{label(CATEGORIES, t.category)}</Typography>
        <Typography variant="caption" color="text.secondary">{label(FREQUENCIES, t.frequency)}</Typography>
      </Box>
    ) },
    { id: 'criticality', label: 'Criticality', render: (t) => <RiskBadge value={humanize(t.criticality)} /> },
    { id: 'steps', label: 'Steps', render: (t) => (
      <Box>
        <Typography variant="body2">{t.stepCount ?? 0}</Typography>
        <Typography variant="caption" color="text.secondary">{(t.clauseRefs || []).length} clauses</Typography>
      </Box>
    ) },
    { id: 'status', label: 'Status', render: (t) => <AdoptionBadge t={t} /> },
  ];

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
        columns={columns}
        rows={pageRows}
        total={filtered.length}
        page={page}
        size={size}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        loading={isLoading}
        error={error}
        rowKey={(t) => t.templateCode}
        onRowClick={setSelected}
        emptyMessage={templates.length ? 'No templates match these filters.' : 'No templates published by the platform yet.'}
      />

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={620}
        title={selected ? `${selected.templateCode} · ${selected.title}` : ''}
        subtitle={selected ? `${label(CATEGORIES, selected.category)} · v${selected.templateVersion}` : ''}
      >
        {selected && (
          <TemplatePreview
            summary={selected}
            canAdopt={canAdopt}
            onAdopt={(t) => setAdoptTarget(t)}
          />
        )}
      </EntityDrawer>

      <AdoptTemplateDialog
        open={!!adoptTarget}
        template={adoptTarget}
        onClose={() => setAdoptTarget(null)}
      />
    </Box>
  );
}
