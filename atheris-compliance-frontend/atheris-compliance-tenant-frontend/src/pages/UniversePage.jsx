import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Alert, Box, Chip, CircularProgress, Tooltip, Typography } from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, DataCard, SectionTable, EntityDrawer,
  RiskBadge, StateBadge, StatusBadge, TL,
  GlobeAltIcon, ExclamationTriangleIcon, ExclamationCircleIcon, InformationCircleIcon, CheckCircleIcon,
  ScaleIcon, DocumentTextIcon, BanknotesIcon,
} from 'shared';
import { api } from '../services/api';
import { Section, Field, FieldGrid, MonoChip } from '../components/detailKit';

/**
 * Compliance Universe — the tenant mirror of the intel /admin/universe page: risk KPIs, top
 * regulators + nature mix, clickable areas of focus that filter the table, and a filterable,
 * sortable instrument table whose rows open the instrument in a drawer.
 * All filters live in the URL so the dashboard can deep-link (e.g. ?areaOfFocus=…&riskRating=…).
 */
const FILTER_KEYS = ['q', 'regulator', 'areaOfFocus', 'riskRating', 'nature', 'status'];
const RISK_CARDS = [
  { key: 'Critical', tone: 'red', icon: <ExclamationCircleIcon /> },
  { key: 'High', tone: 'red', icon: <ExclamationTriangleIcon /> },
  { key: 'Medium', tone: 'amber', icon: <InformationCircleIcon /> },
  { key: 'Moderate', tone: 'amber', icon: <InformationCircleIcon /> },
  { key: 'Low', tone: 'green', icon: <CheckCircleIcon /> },
];
const TOP_REGULATORS = 6;
const ALL = 'All';

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const opts = (map) => Object.keys(map || {}).map((k) => ({ value: k, label: k }));

export default function UniversePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = (k) => searchParams.get(k) || '';

  const page = Number(searchParams.get('page') || 0);
  const size = Number(searchParams.get('size') || 20);
  const sortField = param('sortField');
  const sortDir = param('sortDir') || 'asc';
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, param(k)]));

  // Search box is debounced into the URL.
  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => { setSearchInput(param('q')); }, [searchParams.get('q')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (searchInput === filters.q) return undefined;
    const t = setTimeout(() => update({ q: searchInput }), 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Merge changes into the URL; any filter change resets to the first page. */
  function update(changes, { keepPage = false } = {}) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === ALL) next.delete(k);
      else next.set(k, String(v));
    });
    if (!keepPage && !('page' in changes)) next.delete('page');
    setSearchParams(next, { replace: true });
  }

  const [selected, setSelected] = useState(null);

  const statsQuery = useQuery({
    queryKey: ['universe', 'stats'],
    queryFn: ({ signal }) => api.instruments.universeStats({ signal }),
  });
  const listQuery = useQuery({
    queryKey: ['universe', 'list', filters, page, size, sortField, sortDir],
    queryFn: ({ signal }) => api.instruments.universe({
      ...filters, page, size, sort: sortField ? `${sortField},${sortDir}` : undefined,
    }, { signal }),
    placeholderData: keepPreviousData,
  });
  const detailQuery = useQuery({
    queryKey: ['instruments', String(selected?.instrumentId ?? '')],
    queryFn: ({ signal }) => api.instruments.get(selected.instrumentId, { signal }),
    enabled: !!selected,
    staleTime: 5 * 60 * 1000,
  });

  const stats = statsQuery.data;
  const rows = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements ?? 0;
  const byRisk = stats?.byRiskRating || {};
  const regulatorsByRisk = stats?.regulatorsByRisk || {};

  const kpis = useMemo(() => {
    const riskCards = RISK_CARDS
      .filter((r) => ['High', 'Medium', 'Low'].includes(r.key) || byRisk[r.key] > 0)
      .map((r) => ({
        key: r.key, label: `${r.key} Risk`, value: byRisk[r.key] ?? 0, tone: r.tone, icon: r.icon,
        breakdown: regulatorsByRisk[r.key], active: filters.riskRating === r.key,
      }));
    return [
      { key: 'total', label: 'Total Instruments', value: stats?.total ?? 0, tone: 'blue', icon: <GlobeAltIcon />,
        breakdown: stats?.byRegulator, active: !filters.riskRating && !filters.regulator },
      ...riskCards,
    ];
  }, [stats, byRisk, regulatorsByRisk, filters.riskRating, filters.regulator]);

  const regulators = Object.entries(stats?.byRegulator || {}).slice(0, TOP_REGULATORS);
  const maxRegulator = regulators.length ? regulators[0][1] : 0;
  const areas = Object.entries(stats?.byAreaOfFocus || {});
  const dirty = FILTER_KEYS.some((k) => filters[k]);

  const columns = [
    {
      id: 'sourceTitle', label: 'Instrument', minWidth: 320, sortable: true,
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 440, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.sourceTitle || 'Untitled instrument'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
            {[r.sourceReferenceNumber, r.nature, formatDate(r.dateIssued) && `Issued ${formatDate(r.dateIssued)}`,
              `${r.obligationCount} obligation${r.obligationCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'regulatorName', label: 'Regulator', minWidth: 170, sortable: true,
      render: (r) => (
        <Tooltip title={r.regulatorName || ''} placement="top">
          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'inherit' }}>
            {r.regulatorName || '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      id: 'areaOfFocus', label: 'Area of Focus', minWidth: 170, sortable: true,
      render: (r) => (r.areaOfFocus ? <Chip size="small" label={r.areaOfFocus} /> : '—'),
    },
    { id: 'riskRating', label: 'Risk', minWidth: 110, sortable: true, render: (r) => <RiskBadge value={r.riskRating} /> },
    { id: 'status', label: 'Status', minWidth: 110, render: (r) => <StateBadge value={r.status} emptyLabel="—" /> },
  ];

  const detail = detailQuery.data;
  const obligations = Array.isArray(detail?.obligations) ? detail.obligations : [];
  const sanctions = Array.isArray(detail?.sanctions) ? detail.sanctions : [];

  return (
    <Box>
      <PageHeader
        title="Compliance Universe"
        subtitle="The regulatory instruments in your register — by risk, regulator and area of focus."
      />

      {(statsQuery.error || listQuery.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>{(statsQuery.error || listQuery.error)?.message || 'Failed to load the compliance universe'}</Alert>
      )}

      <KpiCards
        items={kpis}
        columns={kpis.length}
        onSelect={(key) => update({ riskRating: key === 'total' ? '' : key, regulator: '' })}
        onDrill={(key, regulator) => update({ riskRating: key === 'total' ? '' : key, regulator })}
      />

      <Box sx={{ display: 'grid', gap: 3, mb: 3, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', lg: '2fr 3fr' } }}>
        <DataCard title="Top Regulators" subtitle="Click a regulator to filter the table">
          {statsQuery.isPending ? <CircularProgress size={20} /> : regulators.length === 0 ? (
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No instruments in your universe yet.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {regulators.map(([name, count]) => {
                const active = filters.regulator === name;
                return (
                  <Box
                    key={name}
                    component="button"
                    type="button"
                    onClick={() => update({ regulator: active ? '' : name })}
                    sx={{
                      all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%',
                      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34% 40px', alignItems: 'center', gap: 2,
                      px: 1, py: 0.75, mx: -1, borderRadius: '8px',
                      bgcolor: active ? 'rgba(26, 54, 93, 0.06)' : 'transparent',
                      '&:hover': { bgcolor: TL.gray50 },
                      '&:focus-visible': { outline: `2px solid ${TL.primary}`, outlineOffset: 1 },
                    }}
                  >
                    <Typography noWrap title={name} sx={{ fontSize: '0.875rem', color: active ? TL.primary : TL.gray700, fontWeight: active ? 600 : 400 }}>{name}</Typography>
                    <Box sx={{ height: 8, borderRadius: 9999, bgcolor: TL.gray200, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', borderRadius: 9999, bgcolor: TL.primary, width: `${Math.max(4, Math.round((count / maxRegulator) * 100))}%` }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, textAlign: 'right' }}>{count}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {Object.keys(stats?.byNature || {}).length > 0 && (
            <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${TL.gray100}` }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.25 }}>
                Nature Mix
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(stats.byNature).map(([nature, count]) => (
                  <Chip
                    key={nature}
                    label={`${nature}: ${count}`}
                    clickable
                    color={filters.nature === nature ? 'primary' : 'default'}
                    onClick={() => update({ nature: filters.nature === nature ? '' : nature })}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DataCard>

        <DataCard title="Areas of Focus" subtitle="Click an area to filter the table">
          {statsQuery.isPending ? <CircularProgress size={20} /> : areas.length === 0 ? (
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No areas of focus recorded yet.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {areas.map(([area, count]) => (
                <Chip
                  key={area}
                  label={`${area} (${count})`}
                  clickable
                  color={filters.areaOfFocus === area ? 'primary' : 'default'}
                  onClick={() => update({ areaOfFocus: filters.areaOfFocus === area ? '' : area })}
                />
              ))}
            </Box>
          )}
        </DataCard>
      </Box>

      <FilterBar
        search={{ value: searchInput, onChange: setSearchInput, placeholder: 'Search title or reference…' }}
        filters={[
          { key: 'regulator', label: 'Regulator', value: filters.regulator || ALL, onChange: (v) => update({ regulator: v }), options: opts(stats?.byRegulator), allLabel: 'All Regulators', minWidth: 200 },
          { key: 'areaOfFocus', label: 'Area of Focus', value: filters.areaOfFocus || ALL, onChange: (v) => update({ areaOfFocus: v }), options: opts(stats?.byAreaOfFocus), allLabel: 'All Areas', minWidth: 190 },
          { key: 'riskRating', label: 'Risk', value: filters.riskRating || ALL, onChange: (v) => update({ riskRating: v }), options: opts(stats?.byRiskRating), allLabel: 'All Ratings', minWidth: 140 },
          { key: 'nature', label: 'Nature', value: filters.nature || ALL, onChange: (v) => update({ nature: v }), options: opts(stats?.byNature), allLabel: 'All', minWidth: 150 },
          { key: 'status', label: 'Status', value: filters.status || ALL, onChange: (v) => update({ status: v }), options: opts(stats?.byStatus), allLabel: 'All', minWidth: 140 },
        ]}
        showClear={dirty}
        onClear={() => { setSearchInput(''); setSearchParams({}, { replace: true }); }}
      />

      <SectionTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        size={size}
        loading={listQuery.isPending}
        error={listQuery.error}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field) => update(sortField === field
          ? { sortField: field, sortDir: sortDir === 'asc' ? 'desc' : 'asc' }
          : { sortField: field, sortDir: 'asc' })}
        onPage={(p) => update({ page: p }, { keepPage: true })}
        onSize={(s) => update({ size: s })}
        onRowClick={(r) => setSelected(r)}
        rowKey={(r) => r.instrumentId}
        emptyMessage={dirty ? 'No instruments match your filters.' : 'No instruments in your universe yet.'}
      />

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.sourceTitle || 'Instrument'}
        subtitle={[selected?.regulatorName, selected?.sourceReferenceNumber].filter(Boolean).join(' · ')}
        onOpenFull={selected ? () => navigate(`/instruments?id=${selected.instrumentId}`) : undefined}
        fullPageLabel="Open in Instruments"
        width={640}
      >
        {selected && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <RiskBadge value={detail?.riskRating || selected.riskRating} />
              <StateBadge value={detail?.status || selected.status} emptyLabel="No status" />
              {selected.areaOfFocus && <Chip size="small" label={selected.areaOfFocus} />}
              {selected.nature && <StatusBadge label={selected.nature} tone="blue" />}
            </Box>

            <Section icon={<DocumentTextIcon size={18} />} title="Details">
              <FieldGrid>
                <Field label="Regulator" value={detail?.regulatorName || selected.regulatorName} />
                <Field label="Reference" value={selected.sourceReferenceNumber} mono />
                <Field label="Document type" value={detail?.documentType || selected.documentType} />
                <Field label="Issued" value={formatDate(detail?.publishedAt || selected.dateIssued)} />
                <Field label="Area of focus" value={selected.areaOfFocus} />
                <Field label="Obligations in register" value={String(selected.obligationCount)} />
              </FieldGrid>
            </Section>

            {detailQuery.isPending ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : detailQuery.error ? (
              <Alert severity="error">{detailQuery.error.message || 'Failed to load the instrument'}</Alert>
            ) : (
              <>
                {detail?.aiSummary && (
                  <Section icon={<InformationCircleIcon size={18} />} title="Summary">
                    <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {detail.aiSummary}
                    </Typography>
                  </Section>
                )}

                <Section icon={<ScaleIcon size={18} />} title={`Obligations (${obligations.length})`}>
                  {obligations.length === 0 ? (
                    <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No obligations extracted for this instrument.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {obligations.map((o, i) => {
                        const linkable = !!o.obligationId;
                        return (
                          <Box
                            key={o.obligationId || `${o.obligationNumber}-${i}`}
                            onClick={linkable ? () => navigate(`/obligations/${o.obligationId}`) : undefined}
                            sx={{
                              display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1.25,
                              borderTop: i === 0 ? 'none' : `1px solid ${TL.gray100}`,
                              cursor: linkable ? 'pointer' : 'default',
                              '&:hover': linkable ? { bgcolor: TL.gray50 } : undefined,
                              mx: -1, px: 1, borderRadius: '6px',
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: linkable ? TL.primary : TL.gray800 }}>
                                {o.title || o.plainEnglishStatement || 'Untitled obligation'}
                              </Typography>
                              {o.title && o.plainEnglishStatement && (
                                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, mt: 0.25 }}>{o.plainEnglishStatement}</Typography>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexShrink: 0 }}>
                              {o.sectionReference && <MonoChip label={o.sectionReference} />}
                              <RiskBadge value={o.inherentRiskRating} emptyLabel="—" />
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Section>

                {sanctions.length > 0 && (
                  <Section icon={<BanknotesIcon size={18} />} title={`Sanctions (${sanctions.length})`}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {sanctions.map((s, i) => (
                        <Box key={s.sanctionId || i} sx={{ py: 1.25, borderTop: i === 0 ? 'none' : `1px solid ${TL.gray100}` }}>
                          <Typography sx={{ fontSize: '0.875rem', color: TL.gray800 }}>{s.description || s.penaltyDetails || 'Sanction'}</Typography>
                          {s.penaltyDetails && s.description && (
                            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, mt: 0.25 }}>{s.penaltyDetails}</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Section>
                )}
              </>
            )}
          </Box>
        )}
      </EntityDrawer>
    </Box>
  );
}
