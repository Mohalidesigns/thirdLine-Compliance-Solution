import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, CircularProgress, Alert, IconButton, Tooltip, Button, Snackbar,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, StatusBadge,
  ArrowPathIcon, ExclamationTriangleIcon, ShieldCheckIcon, PlusIcon,
} from 'shared';
import { api } from '../services/api';
import AddRiskDialog from '../components/modals/AddRiskDialog';

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

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

const COLUMNS = [
  { id: 'name', label: 'Risk', minWidth: 300,
    render: (r) => (
      <Tooltip title={r.name || ''}>
        <Typography variant="body2" sx={{ ...ellipsis(380), color: 'primary.main', fontWeight: 500 }}>
          {r.name}
        </Typography>
      </Tooltip>
    ) },
  { id: 'areaOfFocus', label: 'Area of Focus', minWidth: 180,
    render: (r) => (r.areaOfFocus
      ? <Typography variant="body2" sx={ellipsis(200)}>{r.areaOfFocus}</Typography>
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
  { id: 'inherentBand', label: 'Inherent Band', minWidth: 150,
    render: (r) => (
      <StatusBadge tone={bandTone(r.inherentBand)} dot label={r.inherentBand}
        title={r.inherentLikelihood && r.inherentImpact ? `${r.inherentLikelihood} × ${r.inherentImpact}` : undefined} />
    ) },
  { id: 'obligationCount', label: 'Obligations', minWidth: 130,
    render: (r) => (
      <Typography variant="body2" sx={(r.obligationCount ?? 0) === 0 ? { color: 'text.secondary' } : undefined}>
        {r.obligationCount ?? 0}
      </Typography>
    ) },
  { id: 'controlCount', label: 'Controls', minWidth: 130,
    render: (r) => (r.controlCount > 0
      ? <Typography variant="body2" sx={{ color: '#2D7D46' }}>{r.controlCount}</Typography>
      : <StatusBadge tone="orange" label="No control" title="No control linked to this risk" />) },
];

export default function RisksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [band, setBand] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [addOpen, setAddOpen] = useState(false);
  const [snack, setSnack] = useState(null);

  const { data: risks = [], isLoading, error } = useQuery({
    queryKey: ['risks', 'register'],
    queryFn: ({ signal }) => api.risks.register({}, { signal }),
  });

  const { data: stats } = useQuery({
    queryKey: ['risks', 'stats'],
    queryFn: ({ signal }) => api.risks.stats({ signal }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return risks.filter((r) => {
      if (band && r.inherentBand !== band) return false;
      if (!q) return true;
      return [r.name, r.areaOfFocus, r.riskType].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [risks, search, band]);

  const pageRows = filtered.slice(page * size, (page + 1) * size);

  const kpiItems = [
    { key: 'total', label: 'Total Risks', value: stats?.total ?? 0, tone: 'blue', icon: <ExclamationTriangleIcon /> },
    { key: 'critical', label: 'Critical / High', value: (stats?.byBand?.Critical ?? 0) + (stats?.byBand?.High ?? 0),
      tone: 'red', icon: <ExclamationTriangleIcon />,
      breakdown: BANDS.filter((b) => stats?.byBand?.[b]).map((b) => ({ label: b, value: stats.byBand[b] })) },
    { key: 'unmanaged', label: 'No Control', value: stats?.unmanaged ?? 0, tone: 'orange', icon: <ShieldCheckIcon />,
      caption: 'Risk with no control' },
  ];

  const activeKpi = band === 'Critical' ? 'critical' : null;

  const onKpiSelect = (key) => {
    if (key === 'critical') setBand('Critical');
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="contained" startIcon={<PlusIcon size={18} />} onClick={() => setAddOpen(true)}>
              Add Risk
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton>
            </Tooltip>
          </Box>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load risks.'}</Alert>}

      <KpiCards items={kpiItems.map((k) => ({ ...k, active: k.key === activeKpi }))} onSelect={onKpiSelect} columns={3} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search risk or area…', minWidth: 260 }}
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
          columns={COLUMNS}
          rows={pageRows}
          total={filtered.length}
          page={page}
          size={size}
          onPage={setPage}
          onSize={(s) => { setSize(s); setPage(0); }}
          onRowClick={(r) => navigate(`/risks/${r.riskId}`)}
          rowKey={(r) => r.riskId}
          emptyMessage="No risks match the current filters."
        />
      )}

      <AddRiskDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => setSnack({ severity: 'success', message: 'Risk created' })}
        onError={(m) => setSnack({ severity: 'error', message: m })}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}