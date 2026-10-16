import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DataCard, EntityDrawer, FilterBar, KpiCards, PageHeader, StatusBadge, TL,
  ArrowDownTrayIcon, CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, ChartBarIcon, PlusIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import { AUTHOR_ROLES, RUNBOOK_STATUS_COLOR, humanize } from './runbookConstants';

// Coverage cell status (contract): RUNBOOK = mapped to >=1 PUBLISHED runbook,
// PARTIAL = mapped only to unpublished runbooks, NONE = uncovered.
const STATUS = {
  RUNBOOK: { label: 'Covered', tone: 'green', bg: '#DCFCE7', border: '#22C55E', fg: '#15803D' },
  PARTIAL: { label: 'Partial', tone: 'amber', bg: '#FEF3C7', border: '#F59E0B', fg: '#92400E' },
  NONE: { label: 'Uncovered', tone: 'red', bg: '#FEE2E2', border: '#EF4444', fg: '#991B1B' },
};
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }));
const NO_DOMAIN = 'General';

const pct = (covered, total) => (total > 0 ? Math.round((covered / total) * 1000) / 10 : 0);

function tally(cells) {
  const t = { total: cells.length, covered: 0, partial: 0, uncovered: 0 };
  cells.forEach((c) => {
    if (c.status === 'RUNBOOK') t.covered += 1;
    else if (c.status === 'PARTIAL') t.partial += 1;
    else t.uncovered += 1;
  });
  return t;
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(cells) {
  const header = ['Framework', 'Clause', 'Title', 'Domain', 'Status', 'Runbooks'];
  const lines = cells.map((c) => [
    c.frameworkCode, c.clauseRef, c.title, c.domain || '', STATUS[c.status]?.label || c.status,
    (c.runbooks || []).map((r) => `${r.runbookCode} (${r.status})`).join('; '),
  ].map(csvEscape).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `runbook-coverage-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CoverageBar({ fw, active, onClick }) {
  const total = fw.total || 0;
  const w = (n) => (total > 0 ? `${(n / total) * 100}%` : '0%');
  return (
    <Box
      onClick={onClick}
      sx={{
        py: 1.25, px: 1.5, borderRadius: '8px', cursor: 'pointer',
        bgcolor: active ? TL.gray50 : 'transparent', outline: active ? `1px solid ${TL.gray200}` : 'none',
        '&:hover': { bgcolor: TL.gray50 },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap title={fw.name}>
          {fw.name || fw.code}
          <Box component="span" sx={{ color: TL.gray400, fontWeight: 400, ml: 1, fontFamily: TL.mono, fontSize: '.75rem' }}>
            {fw.code}
          </Box>
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, flexShrink: 0 }}>
          {fw.coveragePct != null ? Number(fw.coveragePct).toFixed(1) : pct(fw.covered, total)}%
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: TL.gray100 }}>
        <Box sx={{ width: w(fw.covered), bgcolor: STATUS.RUNBOOK.border }} />
        <Box sx={{ width: w(fw.partial), bgcolor: STATUS.PARTIAL.border }} />
        <Box sx={{ width: w(fw.uncovered), bgcolor: STATUS.NONE.border }} />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {fw.covered} covered · {fw.partial} partial · {fw.uncovered} uncovered · {total} clauses
      </Typography>
    </Box>
  );
}

function ClauseTile({ cell, onClick }) {
  const s = STATUS[cell.status] || STATUS.NONE;
  const runbooks = cell.runbooks || [];
  const tip = (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
        {cell.frameworkCode} {cell.clauseRef} — {s.label}
      </Typography>
      {cell.title && <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>{cell.title}</Typography>}
      {runbooks.length
        ? runbooks.map((r) => (
          <Typography key={r.runbookId} variant="caption" sx={{ display: 'block' }}>
            • {r.runbookCode} {r.title} ({humanize(r.status)})
          </Typography>
        ))
        : <Typography variant="caption">No runbook mapped</Typography>}
    </Box>
  );
  return (
    <Tooltip title={tip} arrow>
      <Box
        component="button"
        type="button"
        onClick={onClick}
        sx={{
          minWidth: 72, maxWidth: 140, px: 1, py: 0.75, borderRadius: '6px', cursor: 'pointer',
          bgcolor: s.bg, color: s.fg, border: `1px solid ${s.border}`, fontFamily: TL.mono, fontSize: '.72rem',
          fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          '&:hover': { boxShadow: `0 0 0 2px ${s.border}55` },
        }}
      >
        {cell.clauseRef}
        {runbooks.length > 0 && (
          <Box component="span" sx={{ ml: 0.5, opacity: 0.7 }}>·{runbooks.length}</Box>
        )}
      </Box>
    </Tooltip>
  );
}

function Legend() {
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      {Object.entries(STATUS).map(([k, s]) => (
        <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: s.bg, border: `1px solid ${s.border}` }} />
          <Typography variant="caption" color="text.secondary">
            {s.label}
            {k === 'RUNBOOK' && ' — published runbook'}
            {k === 'PARTIAL' && ' — unpublished runbooks only'}
            {k === 'NONE' && ' — no runbook'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function CoverageMatrixPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAuthor = AUTHOR_ROLES.includes(user?.role);

  const [frameworkId, setFrameworkId] = useState('All');
  const [domain, setDomain] = useState('All');
  const [status, setStatus] = useState('All');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  const frameworksQuery = useQuery({
    queryKey: ['runbook-frameworks'],
    queryFn: ({ signal }) => api.runbooks.frameworks.list({ signal }),
  });
  // Fetched unfiltered so the per-framework bars and KPI breakdowns always span every framework;
  // framework / domain / status filtering is applied client-side.
  const coverageQuery = useQuery({
    queryKey: ['runbook-coverage'],
    queryFn: ({ signal }) => api.runbooks.coverage({}, { signal }),
  });

  const frameworkOptions = useMemo(() => {
    const list = frameworksQuery.data || coverageQuery.data?.frameworks || [];
    return list.map((f) => ({ value: String(f.frameworkId), label: f.name ? `${f.code} — ${f.name}` : f.code }));
  }, [frameworksQuery.data, coverageQuery.data]);

  const allCells = useMemo(() => coverageQuery.data?.cells || [], [coverageQuery.data]);
  const fwCells = useMemo(
    () => (frameworkId === 'All' ? allCells : allCells.filter((c) => String(c.frameworkId) === frameworkId)),
    [allCells, frameworkId],
  );
  const domainOptions = useMemo(() => {
    const set = new Set(fwCells.map((c) => c.domain || NO_DOMAIN));
    return [...set].sort().map((d) => ({ value: d, label: d }));
  }, [fwCells]);

  const scopeCells = useMemo(
    () => (domain === 'All' ? fwCells : fwCells.filter((c) => (c.domain || NO_DOMAIN) === domain)),
    [fwCells, domain],
  );
  const visibleCells = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scopeCells.filter((c) => (status === 'All' || c.status === status)
      && (!needle || [c.clauseRef, c.title, ...(c.runbooks || []).map((r) => r.runbookCode)]
        .some((v) => String(v || '').toLowerCase().includes(needle))));
  }, [scopeCells, status, q]);

  // Per-framework stats: prefer the server's aggregate, recomputed when a domain is selected.
  const frameworkStats = useMemo(() => {
    const server = coverageQuery.data?.frameworks || [];
    if (domain === 'All') return server;
    return server.map((fw) => {
      const t = tally(allCells.filter((c) => c.frameworkId === fw.frameworkId && (c.domain || NO_DOMAIN) === domain));
      return { ...fw, ...t, coveragePct: pct(t.covered, t.total) };
    }).filter((fw) => fw.total > 0);
  }, [coverageQuery.data, allCells, domain]);

  const t = tally(scopeCells);
  const byFramework = (field) => Object.fromEntries(
    frameworkStats.map((fw) => [fw.code, fw[field] ?? 0]),
  );
  const kpis = [
    { key: 'RUNBOOK', label: 'Covered', value: t.covered, tone: 'green', icon: <CheckCircleIcon size={16} />,
      caption: `of ${t.total} clauses`, breakdown: byFramework('covered'), active: status === 'RUNBOOK' },
    { key: 'PARTIAL', label: 'Partial', value: t.partial, tone: 'amber', icon: <ClockIcon size={16} />,
      caption: 'unpublished runbooks only', breakdown: byFramework('partial'), active: status === 'PARTIAL' },
    { key: 'NONE', label: 'Uncovered', value: t.uncovered, tone: 'red', icon: <ExclamationTriangleIcon size={16} />,
      caption: 'no runbook mapped', breakdown: byFramework('uncovered'), active: status === 'NONE' },
    { key: 'pct', label: 'Coverage %', value: `${pct(t.covered, t.total)}%`, tone: 'blue', icon: <ChartBarIcon size={16} />,
      caption: frameworkId === 'All' ? 'all frameworks' : 'selected framework',
      breakdown: Object.fromEntries(frameworkStats.map((fw) => [
        fw.code, `${fw.coveragePct != null ? Number(fw.coveragePct).toFixed(1) : pct(fw.covered, fw.total)}%`,
      ])) },
  ];

  const selectFrameworkByCode = (code) => {
    const fw = frameworkStats.find((f) => f.code === code);
    if (fw) { setFrameworkId(String(fw.frameworkId)); setDomain('All'); }
  };
  const onKpiSelect = (key) => setStatus(key === 'pct' ? 'All' : (status === key ? 'All' : key));
  const onKpiDrill = (key, code) => {
    selectFrameworkByCode(code);
    if (key !== 'pct') setStatus(key);
  };

  // Group visible cells: framework → domain → cells.
  const groups = useMemo(() => {
    const byFw = new Map();
    visibleCells.forEach((c) => {
      const fk = c.frameworkCode || String(c.frameworkId);
      if (!byFw.has(fk)) byFw.set(fk, new Map());
      const dk = c.domain || NO_DOMAIN;
      const dm = byFw.get(fk);
      if (!dm.has(dk)) dm.set(dk, []);
      dm.get(dk).push(c);
    });
    return [...byFw.entries()].map(([fw, dm]) => ({
      fw,
      domains: [...dm.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([d, cells]) => ({ domain: d, cells: [...cells].sort((a, b) => String(a.clauseRef).localeCompare(String(b.clauseRef), undefined, { numeric: true })) })),
    }));
  }, [visibleCells]);

  const fwName = (code) => frameworkStats.find((f) => f.code === code)?.name;
  const filtersActive = frameworkId !== 'All' || domain !== 'All' || status !== 'All' || q !== '';

  return (
    <Box>
      <PageHeader
        title="Coverage Matrix"
        subtitle="Framework clauses covered by compliance runbooks"
        actions={(
          <Button variant="outlined" startIcon={<ArrowDownTrayIcon size={16} />} disabled={!visibleCells.length}
            onClick={() => exportCsv(visibleCells)}>
            Export CSV
          </Button>
        )}
      />
      <RunbooksNav />

      {coverageQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{coverageQuery.error?.message || 'Could not load coverage.'}</Alert>
      )}

      <KpiCards items={kpis} columns={4} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: 'Search clause, title or runbook code…' }}
        filters={[
          { key: 'framework', label: 'Framework', value: frameworkId, minWidth: 220,
            onChange: (v) => { setFrameworkId(v); setDomain('All'); }, options: frameworkOptions },
          { key: 'domain', label: 'Domain', value: domain, onChange: setDomain, options: domainOptions },
          { key: 'status', label: 'Status', value: status, onChange: setStatus, options: STATUS_OPTIONS },
        ]}
        showClear={filtersActive}
        onClear={() => { setFrameworkId('All'); setDomain('All'); setStatus('All'); setQ(''); }}
      />

      {coverageQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' }, alignItems: 'start' }}>
          <DataCard title="Coverage by framework" subtitle="Click a framework to filter the grid" contentSx={{ p: 1.5 }}>
            {frameworkStats.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>No frameworks loaded.</Typography>
            ) : frameworkStats.map((fw) => (
              <CoverageBar
                key={fw.frameworkId}
                fw={fw}
                active={String(fw.frameworkId) === frameworkId}
                onClick={() => {
                  const same = String(fw.frameworkId) === frameworkId;
                  setFrameworkId(same ? 'All' : String(fw.frameworkId));
                  if (!same) setDomain('All');
                }}
              />
            ))}
          </DataCard>

          <DataCard
            title="Clause grid"
            subtitle={`${visibleCells.length} of ${allCells.length} clauses shown`}
            actions={<Legend />}
          >
            {groups.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No clauses match these filters.</Typography>
            ) : groups.map((g) => (
              <Box key={g.fw} sx={{ mb: 3, '&:last-of-type': { mb: 0 } }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: TL.gray800, mb: 1 }}>
                  {g.fw}
                  {fwName(g.fw) && (
                    <Box component="span" sx={{ fontWeight: 400, color: TL.gray500, ml: 1 }}>{fwName(g.fw)}</Box>
                  )}
                </Typography>
                {g.domains.map((d) => (
                  <Box key={d.domain} sx={{ mb: 1.5 }}>
                    <Typography sx={{
                      fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase',
                      letterSpacing: '0.05em', mb: 0.75,
                    }}>
                      {d.domain} ({d.cells.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {d.cells.map((c) => <ClauseTile key={c.clauseId} cell={c} onClick={() => setSelected(c)} />)}
                    </Box>
                  </Box>
                ))}
              </Box>
            ))}
          </DataCard>
        </Box>
      )}

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.frameworkCode} ${selected.clauseRef}` : ''}
        subtitle={selected?.title}
      >
        {selected && (
          <Box>
            <DataCard sx={{ mb: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px' }}>
                <Typography variant="caption" color="text.secondary">Framework</Typography>
                <Typography variant="body2">
                  {selected.frameworkCode}{fwName(selected.frameworkCode) ? ` — ${fwName(selected.frameworkCode)}` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">Clause</Typography>
                <Box>
                  <Chip label={selected.clauseRef} size="small" variant="outlined"
                    sx={{ height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' }} />
                </Box>
                <Typography variant="caption" color="text.secondary">Title</Typography>
                <Typography variant="body2">{selected.title || '–'}</Typography>
                <Typography variant="caption" color="text.secondary">Domain</Typography>
                <Typography variant="body2">{selected.domain || NO_DOMAIN}</Typography>
                <Typography variant="caption" color="text.secondary">Coverage</Typography>
                <Box>
                  <StatusBadge label={STATUS[selected.status]?.label || selected.status}
                    tone={STATUS[selected.status]?.tone || 'gray'} />
                </Box>
              </Box>
            </DataCard>

            <DataCard title="Mapped runbooks" subtitle={`${(selected.runbooks || []).length} runbook(s)`}>
              {(selected.runbooks || []).length === 0 ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: canAuthor ? 1.5 : 0 }}>
                    No runbook covers this clause yet.
                  </Typography>
                  {canAuthor && (
                    <Button size="small" variant="contained" startIcon={<PlusIcon size={16} />}
                      onClick={() => navigate('/runbooks/new')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                      New runbook
                    </Button>
                  )}
                </Box>
              ) : (selected.runbooks || []).map((r) => (
                <Box
                  key={r.runbookId}
                  onClick={() => navigate(`/runbooks/${r.runbookId}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, p: 1.25, mb: 1, borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${TL.gray200}`, '&:hover': { bgcolor: TL.gray50 },
                  }}
                >
                  <Chip label={r.runbookCode} size="small" variant="outlined"
                    sx={{ height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={r.title}>{r.title}</Typography>
                  <Chip label={humanize(r.status)} size="small" color={RUNBOOK_STATUS_COLOR[r.status] || 'default'}
                    sx={{ height: 22 }} />
                </Box>
              ))}
            </DataCard>
          </Box>
        )}
      </EntityDrawer>
    </Box>
  );
}
