import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, Snackbar, Tooltip,
} from '@mui/material';
import {
  DetailHeader, DataCard, StateBadge, StatusBadge, TL,
  ShieldCheckIcon, ArrowLeftIcon, ExclamationTriangleIcon, LinkIcon,
} from 'shared';
import { api } from '../services/api';
import { Field, FieldGrid } from '../components/detailKit';
import RequirementControlsModal from '../components/modals/RequirementControlsModal';

const STATE_LABEL = {
  COMPLIANT: 'Compliant',
  PARTIAL: 'Partial',
  NON_COMPLIANT: 'Non-compliant',
  NO_CONTROL: 'No control',
  NO_REQUIREMENTS: 'No requirements',
};

const STATE_HINT = {
  COMPLIANT: 'Every linked control passed its latest test.',
  PARTIAL: 'At least one linked control has not been proven effective yet.',
  NON_COMPLIANT: 'A linked control failed its latest test and none are effective.',
  NO_CONTROL: 'No control covers this requirement — this is a gap.',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RequirementDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const requirementId = Number(id);
  const queryClient = useQueryClient();

  const [snack, setSnack] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const { data: req, isLoading, error } = useQuery({
    queryKey: ['requirements', 'detail', String(id)],
    queryFn: ({ signal }) => api.requirements.detail(requirementId, { signal }),
    enabled: !!requirementId,
  });

  const override = useMutation({
    mutationFn: (body) => api.requirements.setState(requirementId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
      setSnack({ severity: 'success', message: 'State override updated' });
    },
    onError: (e) => setSnack({ severity: 'error', message: e.message || 'Failed to update state' }),
  });

  const clearOverride = () => override.mutate({ state: '', reason: '' });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error || !req) {
    return (
      <Box>
        <Button variant="outlined" startIcon={<ArrowLeftIcon size={16} />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error?.message || 'Failed to load requirement.'}</Alert>
      </Box>
    );
  }

  const controls = req.controls || [];
  const stateLabel = STATE_LABEL[req.state] || req.state;

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(-1)}
        backLabel="Back"
        title={req.obligationTitle || 'Requirement'}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {req.actName && (
              <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <LinkIcon size={14} />
                {req.actName}
              </Typography>
            )}
            {req.obligationId && (
              <Chip size="small" variant="outlined" label="Open obligation"
                onClick={() => navigate(`/obligations/${req.obligationId}`)} sx={{ cursor: 'pointer' }} />
            )}
          </Box>
        )}
        description={req.text}
        right={(
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip title={STATE_HINT[req.state] || ''}>
              <span><StateBadge value={req.state} label={stateLabel} /></span>
            </Tooltip>
            {req.gap && (
              <StatusBadge tone="red" dot label="Gap" title="No control covers this requirement" />
            )}
          </Box>
        )}
      />

      <DataCard title="Requirement" sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ color: TL.gray800, lineHeight: 1.7 }}>{req.text}</Typography>
      </DataCard>

      <DataCard title="Assessment" sx={{ mb: 3 }}>
        <FieldGrid>
          <Field label="Derived state" value={stateLabel} />
          <Field label="Risk" value={req.riskName} />
          <Field label="Risk band" value={req.riskBand} />
          <Field label="Source" value={req.source} />
          <Field label="Controls" value={String(controls.length)} />
        </FieldGrid>

        {req.stateOverride ? (
          <Box sx={{ mt: 2.5, p: 2, bgcolor: TL.gray50, borderRadius: '8px', border: `1px solid ${TL.gray100}` }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: TL.gray500, mb: 0.5 }}>
              Manual override
            </Typography>
            <Typography variant="body2" sx={{ color: TL.gray700 }}>
              {STATE_LABEL[req.stateOverride] || req.stateOverride}
              {req.overrideReason ? ` — ${req.overrideReason}` : ''}
            </Typography>
            <Button size="small" variant="text" onClick={clearOverride} sx={{ mt: 1 }} disabled={override.isPending}>
              Clear override
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
            The state is derived from the controls below. An analyst can override it if needed.
          </Typography>
        )}
      </DataCard>

      <DataCard
        title="Controls covering this requirement"
        subtitle="A control is effective when its latest test passed"
        actions={<Button size="small" variant="outlined" onClick={() => setLinkOpen(true)}>Link controls</Button>}
      >
        {controls.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <ExclamationTriangleIcon size={18} />
            <Typography variant="body2">No control covers this requirement. Link a control to close the gap.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {controls.map((c) => (
              <Box key={c.controlId} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                border: `1px solid ${TL.gray100}`, borderRadius: '8px',
              }}>
                <Box sx={{ color: c.effective ? 'success.main' : TL.gray400, display: 'flex' }}>
                  <ShieldCheckIcon size={20} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{c.name || c.controlNumber}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.controlNumber}
                    {c.latestTestDate ? ` · latest test ${formatDate(c.latestTestDate)}` : ' · not yet tested'}
                  </Typography>
                </Box>
                <StateBadge
                  value={c.effective ? 'effective' : (c.latestResult || 'not tested')}
                  label={c.latestResult || 'Not tested'}
                />
              </Box>
            ))}
          </Box>
        )}
      </DataCard>

      <RequirementControlsModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        requirementId={requirementId}
        initialIds={controls.map((c) => c.controlId)}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ['requirements'] }); setSnack({ severity: 'success', message: 'Controls updated' }); }}
        onError={(m) => setSnack({ severity: 'error', message: m })}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}