import { Box, Chip, Typography } from '@mui/material';
import { StatusBadge, TL } from 'shared';

/**
 * Reusable renderer for a VersionDiffDto (M10):
 *   { fromVersionNumber, toVersionNumber, added: [StepDiffDto], removed: [StepDiffDto],
 *     changed: [StepDiffDto], metadata: [FieldChange] }
 *   StepDiffDto { stepCode, title, changes: [FieldChange] } ; FieldChange { field, before, after }
 *
 * Purely presentational — the caller fetches the diff (api.runbooks.versions.diff).
 */

const KIND = {
  added: { label: 'Added', tone: 'green', border: '#22C55E', bg: '#F0FDF4' },
  removed: { label: 'Removed', tone: 'red', border: '#EF4444', bg: '#FEF2F2' },
  changed: { label: 'Changed', tone: 'amber', border: '#F59E0B', bg: '#FFFBEB' },
};

const humanField = (f) => (f ? String(f)
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^\w/, (c) => c.toUpperCase()) : '–');

function show(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function FieldChangeRow({ change }) {
  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr 1fr' }, gap: 1,
      py: 0.75, borderTop: `1px solid ${TL.gray100}`, '&:first-of-type': { borderTop: 0 },
    }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: TL.gray600 }}>{humanField(change.field)}</Typography>
      <Typography variant="caption" sx={{
        color: '#991B1B', bgcolor: '#FEF2F2', px: 0.75, py: 0.25, borderRadius: '4px',
        textDecoration: 'line-through', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {show(change.before)}
      </Typography>
      <Typography variant="caption" sx={{
        color: '#15803D', bgcolor: '#F0FDF4', px: 0.75, py: 0.25, borderRadius: '4px',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {show(change.after)}
      </Typography>
    </Box>
  );
}

function StepBlock({ step, kind }) {
  const k = KIND[kind];
  const changes = step.changes || [];
  return (
    <Box sx={{
      border: `1px solid ${TL.gray200}`, borderLeft: `3px solid ${k.border}`, borderRadius: '8px',
      bgcolor: '#FFFFFF', p: 1.5, mb: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {step.stepCode && (
          <Chip label={step.stepCode} size="small" variant="outlined"
            sx={{ height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' }} />
        )}
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{step.title || 'Untitled step'}</Typography>
        <StatusBadge label={k.label} tone={k.tone} />
      </Box>
      {changes.length > 0 && (
        <Box sx={{ mt: 1, bgcolor: k.bg, borderRadius: '6px', px: 1, py: 0.5 }}>
          {changes.map((c, i) => <FieldChangeRow key={`${c.field}-${i}`} change={c} />)}
        </Box>
      )}
    </Box>
  );
}

function Group({ title, items, kind }) {
  if (!items || items.length === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{
        fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase',
        letterSpacing: '0.05em', mb: 1,
      }}>
        {title} ({items.length})
      </Typography>
      {items.map((s, i) => <StepBlock key={`${kind}-${s.stepCode || i}`} step={s} kind={kind} />)}
    </Box>
  );
}

export default function VersionDiffView({ diff, emptyMessage = 'No differences between these versions.' }) {
  if (!diff) return null;
  const added = diff.added || [];
  const removed = diff.removed || [];
  const changed = diff.changed || [];
  const metadata = diff.metadata || [];
  const nothing = !added.length && !removed.length && !changed.length && !metadata.length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          v{diff.fromVersionNumber ?? '?'} → v{diff.toVersionNumber ?? '?'}
        </Typography>
        <StatusBadge label={`+${added.length} added`} tone="green" />
        <StatusBadge label={`−${removed.length} removed`} tone="red" />
        <StatusBadge label={`${changed.length} changed`} tone="amber" />
        {metadata.length > 0 && <StatusBadge label={`${metadata.length} metadata`} tone="blue" />}
      </Box>

      {nothing && <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>}

      {metadata.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{
            fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase',
            letterSpacing: '0.05em', mb: 1,
          }}>
            Runbook fields ({metadata.length})
          </Typography>
          <Box sx={{ border: `1px solid ${TL.gray200}`, borderRadius: '8px', bgcolor: '#FFFFFF', px: 1.5, py: 0.5 }}>
            {metadata.map((c, i) => <FieldChangeRow key={`${c.field}-${i}`} change={c} />)}
          </Box>
        </Box>
      )}

      <Group title="Added steps" items={added} kind="added" />
      <Group title="Removed steps" items={removed} kind="removed" />
      <Group title="Changed steps" items={changed} kind="changed" />
    </Box>
  );
}
