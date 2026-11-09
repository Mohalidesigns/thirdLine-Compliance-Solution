import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, DataCard,
  EntityDrawer, StatusBadge, TL,
  ArrowPathIcon, ExclamationTriangleIcon, ShieldCheckIcon, LinkIcon,
} from 'shared';
import { api } from '../services/api';
import { Field, FieldGrid } from '../components/detailKit';

const BANDS = ['Critical', 'High', 'Moderate', 'Low', 'Unrated'];

function bandTone(band) {
  switch ((band || '').toLowerCase()) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'moderate': case 'medium': return 'amber';
    case 'low': return 'green';
    default: return 'gray';
  }
}

const COLUMNS = ({ onOpen }) => [
  { id: 'name', label: 'Risk', minWidth: 320, maxWidth: 400, truncate: true, render: (r) => (
    <Box sx={{ cursor: 'pointer' }} onClick={() => onOpen(r.riskId)}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', maxWidth: 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
      <Typography variant="caption" color="text.secondary">{r.riskCode} · {r.areaOfFocus || 'No area'}</Typography>
    </Box>
  ) },
  { id: 'inherentBand', label: 'Inherent Band', minWidth: 150, render: (r) => (
    <StatusBadge tone={bandTone(r.inherentBand)} dot
      label={r.inherentBand}
      title={r.inherentLikelihood && r.inherentImpact ? `${r.inherentLikelihood} × ${r.inherentImpact}` : undefined} />
  ) },
  { id: 'obligationCount', label: 'Obligations', minWidth: 130, sortable: false, render: (r) => (
    <Typography variant="body2">{r.obligationCount ?? 0}</Typography>
  ) },
  { id: 'requirementCount', label: 'Requirements', minWidth: 150, sortable: false, render: (r) => (
    <Box>
      <Typography variant="body2">{r.requirementCount ?? 0}</Typography>
      {r.uncoveredRequirementCount > 0 && (
        <Typography variant="caption" sx={{ color: 'error.main' }}>
          {r.uncoveredRequirementCount} uncovered
        </Typography>
      )}
    </Box>
  ) },
  { id: 'controlCount', label: 'Controls', minWidth: 120, sortable: false, render: (r) => (
    r.controlCount > 0
      ? <Typography variant="body2">{r.controlCount}</Typography>
      : <StatusBadge tone="gray" label="Unmanaged" title="No control linked to this risk" />
  ) },
];

export default function RisksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [band, setBand] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [drillId, setDrillId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const { data: risks = [], isLoading, error } = useQuery({
    queryKey: ['risks', 'register'],
    queryFn: ({ signal }) => api.risks.register({}, { signal }),
  });

  const { data: stats } = useQuery({
    queryKey: ['risks', 'stats'],
    queryFn: ({ signal }) => api.risks.stats({ signal }),
  });

  const { data: detail } = useQuery({
    queryKey: ['risks', 'detail', String(openId)],
    queryFn: ({ signal }) => api.risks.detail(openId, { signal }),
    enabled: !!openId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return risks.filter((r) => {
      if (band && r.inherentBand !== band) return false;
      if (!q) return true;
      return [r.name, r.riskCode, r.areaOfFocus, r.riskType].some(
        (v) => (v || '').toLowerCase().includes(q));
    });
  }, [risks, search, band]);

  const pageRows = filtered.slice(page * size, (page + 1) * size);

  const kpiItems = [
    { key: 'total', label: 'Total Risks', value: stats?.total ?? 0, tone: 'blue', icon: <ExclamationTriangleIcon /> },
    { key: 'critical', label: 'Critical / High', value: (stats?.byBand?.Critical ?? 0) + (stats?.byBand?.High ?? 0),
      tone: 'red', icon: <ExclamationTriangleIcon />,
      breakdown: BANDS.filter((b) => stats?.byBand?.[b]).map((b) => ({ label: b, value: stats.byBand[b] })) },
    { key: 'unmanaged', label: 'Unmanaged', value: stats?.unmanaged ?? 0, tone: 'orange', icon: <ShieldCheckIcon />,
      caption: 'Risk with no control' },
  ];

  const onKpiSelect = (key) => {
    if (key === 'critical') setBand('Critical');
    else if (key === 'unmanaged') setBand('');
    else setBand('');
    setPage(0);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['risks'] });

  return (
    <Box>
      <PageHeader
        title="Risk Register"
        subtitle={`${stats?.total ?? risks.length} risks — the standing risks the obligation set protects against`}
        actions={(
          <Tooltip title="Refresh">
            <IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton>
          </Tooltip>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load risks.'}</Alert>}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search risk, code or area…', minWidth: 260 }}
        filters={[
          { key: 'band', label: 'Inherent Band', minWidth: 170, value: band,
            onChange: (v) => { setBand(v); setPage(0); }, allLabel: 'All bands',
            options: BANDS.map((b) => ({ value: b, label: b })) },
        ]}
        showClear={!!search || !!band}
        onClear={() => { setSearch(''); setBand(''); setPage(0); }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <SectionTable
          columns={COLUMNS({ onOpen: setOpenId })}
          rows={pageRows}
          total={filtered.length}
          page={page}
          size={size}
          onPage={setPage}
          onSize={(s) => { setSize(s); setPage(0); }}
          rowKey={(r) => r.riskId}
          emptyMessage="No risks match the current filters."
        />
      )}

      <EntityDrawer
        open={!!openId}
        onClose={() => setOpenId(null)}
        title={detail?.name || 'Risk'}
        subtitle={detail ? `${detail.riskCode} · ${detail.areaOfFocus || 'No area'}` : null}
        width={620}
      >
        {detail && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <StatusBadge tone={bandTone(detail.inherentBand)} dot label={detail.inherentBand} />
              {detail.status && <StatusBadge tone="gray" label={detail.status} />}
            </Box>
            {detail.description && (
              <Typography variant="body2" sx={{ color: TL.gray700, mb: 2.5, lineHeight: 1.7 }}>{detail.description}</Typography>
            )}
            <FieldGrid min={150}>
              <Field label="Risk type" value={detail.riskType} />
              <Field label="Area of focus" value={detail.areaOfFocus} />
              <Field label="Likelihood" value={detail.inherentLikelihood} />
              <Field label="Impact" value={detail.inherentImpact} />
            </FieldGrid>

            <DataCard title={`Obligations (${detail.obligationCount})`} sx={{ mt: 3 }}>
              {detail.obligations?.length ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {detail.obligations.map((o) => (
                    <Box key={o.obligationId} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                      onClick={() => navigate(`/obligations/${o.obligationId}`)}>
                      <LinkIcon size={14} />
                      <Typography variant="body2" sx={{ color: 'primary.main' }}>{o.title}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : <Typography variant="body2" color="text.secondary">No obligations mapped.</Typography>}
            </DataCard>

            <DataCard title={`Controls (${detail.controlCount})`} sx={{ mt: 2 }}>
              {detail.controls?.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {detail.controls.map((c) => (
                    <Chip key={c.controlId} size="small"
                      variant={c.effective ? 'filled' : 'outlined'}
                      color={c.effective ? 'success' : undefined}
                      label={c.controlNumber} />
                  ))}
                </Box>
              ) : <Typography variant="body2" color="text.secondary">No control linked — this risk is unmanaged.</Typography>}
            </DataCard>
          </Box>
        )}
      </EntityDrawer>
    </Box>
  );
}