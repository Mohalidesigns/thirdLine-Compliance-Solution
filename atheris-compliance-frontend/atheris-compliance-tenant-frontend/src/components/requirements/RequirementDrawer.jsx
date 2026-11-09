import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Button } from '@mui/material';
import { EntityDrawer, StateBadge, StatusBadge, TL, ShieldCheckIcon, ExclamationTriangleIcon } from 'shared';
import { Field, FieldGrid } from '../detailKit';
import RequirementControlsModal from '../modals/RequirementControlsModal';

const STATE_LABEL = {
  COMPLIANT: 'Compliant', PARTIAL: 'Partial', NON_COMPLIANT: 'Non-compliant',
  NO_CONTROL: 'No control', NO_REQUIREMENTS: 'No requirements',
};
const STATE_TONE = { COMPLIANT: 'green', PARTIAL: 'amber', NON_COMPLIANT: 'red', NO_CONTROL: 'red', NO_REQUIREMENTS: 'gray' };
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

/**
 * Requirement detail shown inside the obligation page drawer: the duty, its derived state,
 * the risk it serves, and every control that covers it (with the latest test). Linking
 * controls happens in place — no page navigation.
 */
export default function RequirementDrawer({ open, onClose, requirement, onError, onSaved }) {
  const queryClient = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);

  if (!requirement) return null;
  const controls = requirement.controls || [];

  return (
    <>
      <EntityDrawer
        open={open}
        onClose={onClose}
        title="Requirement"
        subtitle={requirement.obligationTitle || null}
        width={560}
      >
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ color: TL.gray800, lineHeight: 1.7 }}>
            {requirement.text}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
          <StateBadge tone={STATE_TONE[requirement.state] || 'gray'}
            label={STATE_LABEL[requirement.state] || requirement.state} dot={requirement.gap} />
          {requirement.gap && <StatusBadge tone="red" dot label="Gap" title="No control covers this requirement" />}
          <Typography variant="caption" color="text.secondary">
            {STATE_HINT[requirement.state] || ''}
          </Typography>
        </Box>

        <FieldGrid min={150} sx={{ mb: 3 }}>
          <Field label="Risk" value={requirement.riskName} />
          <Field label="Risk band" value={requirement.riskBand} />
          <Field label="Source" value={requirement.source} />
          <Field label="Controls" value={String(controls.length)} />
        </FieldGrid>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Controls covering this requirement
          </Typography>
          <Button size="small" variant="outlined" onClick={() => setLinkOpen(true)}>Link controls</Button>
        </Box>

        {controls.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main', py: 1 }}>
            <ExclamationTriangleIcon size={18} />
            <Typography variant="body2">No control covers this requirement. Link a control to close the gap.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {controls.map((c) => (
              <Box key={c.controlId} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                border: `1px solid ${TL.gray100}`, borderRadius: '8px', bgcolor: '#FFFFFF',
              }}>
                <Box sx={{ color: c.effective ? 'success.main' : TL.gray300, display: 'flex' }}>
                  <ShieldCheckIcon size={20} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{c.name || 'Control'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.latestTestDate ? `Latest test ${formatDate(c.latestTestDate)}` : 'Not yet tested'}
                  </Typography>
                </Box>
                <StateBadge value={c.effective ? 'effective' : (c.latestResult || 'not tested')}
                  label={c.latestResult || 'Not tested'} />
              </Box>
            ))}
          </Box>
        )}
      </EntityDrawer>

      <RequirementControlsModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        requirementId={requirement.requirementId}
        initialIds={controls.map((c) => c.controlId)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['requirements'] });
          await queryClient.invalidateQueries({ queryKey: ['obligations'] });
          onSaved?.();
        }}
        onError={onError}
      />
    </>
  );
}