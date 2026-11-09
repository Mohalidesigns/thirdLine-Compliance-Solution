import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Button, Tooltip } from '@mui/material';
import {
  DetailHeader, DataCard, StateBadge, StatusBadge, SectionTabs, SectionTable, TL,
  ShieldCheckIcon, ArrowLeftIcon, ExclamationTriangleIcon, LinkIcon, ListBulletIcon, PencilSquareIcon,
} from 'shared';
import { api } from '../services/api';
import { Field, FieldGrid } from '../components/detailKit';
import AddRiskDialog from '../components/modals/AddRiskDialog';

function bandTone(band) {
  switch ((band || '').toLowerCase()) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'moderate': case 'medium': return 'amber';
    case 'low': return 'green';
    default: return 'gray';
  }
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

const OBLIGATION_COLUMNS = [
  { id: 'title', label: 'Obligation', minWidth: 380,
    render: (o) => (
      <Tooltip title={o.title || ''}>
        <Typography variant="body2" sx={{ ...ellipsis(480), color: 'primary.main', fontWeight: 500 }}>{o.title}</Typography>
      </Tooltip>
    ) },
  { id: 'actName', label: 'Act / Regulation', minWidth: 240,
    render: (o) => (o.actName
      ? <Typography variant="body2" sx={ellipsis(280)}>{o.actName}</Typography>
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
];

const CONTROL_COLUMNS = [
  { id: 'name', label: 'Control', minWidth: 320,
    render: (c) => (
      <Tooltip title={c.name || ''}>
        <Typography variant="body2" sx={{ ...ellipsis(380), color: 'primary.main', fontWeight: 500 }}>
          {c.name || 'Control'}
        </Typography>
      </Tooltip>
    ) },
  { id: 'lastTest', label: 'Last Tested', minWidth: 170,
    render: (c) => (c.latestTestDate
      ? <Typography variant="body2">{formatDate(c.latestTestDate)}</Typography>
      : <Typography variant="body2" color="text.secondary">Never</Typography>) },
  { id: 'effective', label: 'Result', minWidth: 150,
    render: (c) => (
      <Tooltip title={c.effective ? 'Latest test passed' : 'Not proven effective'}>
        <span>
          <StateBadge tone={c.effective ? 'green' : (c.latestResult ? 'orange' : 'gray')}
            label={c.latestResult || 'Not tested'} />
        </span>
      </Tooltip>
    ) },
];

export default function RiskDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const riskId = Number(id);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: risk, isLoading, error } = useQuery({
    queryKey: ['risks', 'detail', String(id)],
    queryFn: ({ signal }) => api.risks.detail(riskId, { signal }),
    enabled: !!riskId,
  });

  const obligations = useMemo(() => risk?.obligations || [], [risk]);
  const controls = useMemo(() => risk?.controls || [], [risk]);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error || !risk) {
    return (
      <Box>
        <Button variant="outlined" startIcon={<ArrowLeftIcon size={16} />} onClick={() => navigate('/risks')} sx={{ mb: 2 }}>
          Back to Risks
        </Button>
        <Alert severity="error">{error?.message || 'Failed to load risk.'}</Alert>
      </Box>
    );
  }

  const TABS = [
    { key: 'overview', label: 'Overview', icon: <ExclamationTriangleIcon size={15} /> },
    { key: 'obligations', label: 'Obligations', count: obligations.length, icon: <ListBulletIcon size={15} /> },
    { key: 'controls', label: 'Controls', count: controls.length, icon: <ShieldCheckIcon size={15} /> },
  ];

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/risks')}
        backLabel="Back to Risks"
        title={risk.name}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <StatusBadge tone={bandTone(risk.inherentBand)} dot label={`Inherent ${risk.inherentBand}`} />
            {risk.areaOfFocus && (
              <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                {risk.areaOfFocus}
              </Typography>
            )}
            {risk.riskType && <StatusBadge tone="gray" label={risk.riskType} />}
          </Box>
        )}
        description={risk.description}
        right={(
          <Button variant="contained" startIcon={<PencilSquareIcon size={16} />} onClick={() => setEditOpen(true)}>
            Edit risk
          </Button>
        )}
      />

      <SectionTabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        sx={{ mb: 3 }}
      />

      {tab === 'overview' && (
        <DataCard title="Assessment">
          <FieldGrid>
            <Field label="Inherent band" value={risk.inherentBand} />
            <Field label="Likelihood" value={risk.inherentLikelihood} />
            <Field label="Impact" value={risk.inherentImpact} />
            <Field label="Status" value={risk.status} />
            <Field label="Obligations covered" value={String(risk.obligationCount ?? 0)} />
            <Field label="Controls linked" value={String(risk.controlCount ?? 0)} />
          </FieldGrid>
          {risk.uncoveredRequirementCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5, color: 'error.main' }}>
              <ExclamationTriangleIcon size={18} />
              <Typography variant="body2">
                {risk.uncoveredRequirementCount} requirement{risk.uncoveredRequirementCount === 1 ? '' : 's'} across these obligations have no control.
              </Typography>
            </Box>
          )}
        </DataCard>
      )}

      {tab === 'obligations' && (
        <DataCard title={`Obligations this risk covers (${obligations.length})`}
          subtitle="The obligations whose duties this risk stands behind">
          <SectionTable
            columns={OBLIGATION_COLUMNS}
            rows={obligations}
            rowKey={(o) => o.obligationId}
            onRowClick={(o) => navigate(`/obligations/${o.obligationId}`)}
            total={obligations.length}
            emptyMessage="No obligations mapped to this risk."
          />
        </DataCard>
      )}

      {tab === 'controls' && (
        <DataCard title={`Controls linked to this risk (${controls.length})`}
          subtitle="A control is effective when its latest test passed">
          {controls.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
              <ExclamationTriangleIcon size={18} />
              <Typography variant="body2">No control is linked — this risk is unmanaged.</Typography>
            </Box>
          ) : (
            <SectionTable
              columns={CONTROL_COLUMNS}
              rows={controls}
              rowKey={(c) => c.controlId}
              total={controls.length}
            />
          )}
        </DataCard>
      )}

      <AddRiskDialog
        open={editOpen}
        risk={risk}
        onClose={() => setEditOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['risks'] })}
      />
    </Box>
  );
}