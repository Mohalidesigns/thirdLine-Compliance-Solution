import {
  Box, Button, Chip, FormControlLabel, Grid, IconButton, MenuItem, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import { DataCard, PlusIcon, TrashIcon, TL } from 'shared';
import { PREREQ_TYPES, humanize, label as labelOf, CATEGORIES } from '../../../pages/runbooks/runbookConstants';
import { PREREQ_SUGGESTIONS, emptyPrereq } from './builderModel';

/** Step 2 — prerequisites repeater (M4) with category-based suggestions. */
export default function PrerequisitesStep({ items, onChange, category, readOnly }) {
  const update = (i, patch) => onChange(items.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const have = new Set(items.map((p) => p.label.trim().toLowerCase()));
  const suggestions = (PREREQ_SUGGESTIONS[category] || []).filter((s) => !have.has(s.label.toLowerCase()));

  return (
    <DataCard
      title="Prerequisites"
      subtitle="Access, tools, data, approvals and windows the operator must have before starting (acknowledged at pre-flight)."
      actions={!readOnly && (
        <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />}
          onClick={() => onChange([...items, emptyPrereq()])}>
          Add prerequisite
        </Button>
      )}
    >
      {!readOnly && suggestions.length > 0 && (
        <Box sx={{ mb: 2.5, p: 1.5, bgcolor: TL.gray50, borderRadius: '8px', border: `1px dashed ${TL.gray200}` }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: TL.gray600, mb: 1 }}>
            Suggested for {labelOf(CATEGORIES, category)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {suggestions.map((s) => (
              <Chip key={s.label} size="small" variant="outlined" icon={<PlusIcon size={12} />}
                label={`${humanize(s.prereqType)}: ${s.label}`}
                onClick={() => onChange([...items, emptyPrereq({ ...s })])} />
            ))}
          </Box>
        </Box>
      )}

      {items.length === 0 && (
        <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No prerequisites defined.</Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {items.map((p, i) => (
          <Box key={p._key} sx={{ p: 2, border: `1px solid ${TL.gray100}`, borderRadius: '8px' }}>
            <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField fullWidth select size="small" label="Type" value={p.prereqType} disabled={readOnly}
                  onChange={(e) => update(i, { prereqType: e.target.value })}>
                  {PREREQ_TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth size="small" label="Label" required value={p.label} disabled={readOnly}
                  error={!readOnly && !p.label.trim()}
                  onChange={(e) => update(i, { label: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth size="small" label="Detail" value={p.detail} disabled={readOnly}
                  onChange={(e) => update(i, { detail: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 9, md: 1.5 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={!!p.mandatory} disabled={readOnly}
                    onChange={(e) => update(i, { mandatory: e.target.checked })} />}
                  label={<Typography sx={{ fontSize: '0.8125rem' }}>Mandatory</Typography>} />
              </Grid>
              <Grid size={{ xs: 3, md: 0.5 }} sx={{ textAlign: 'right' }}>
                {!readOnly && (
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => remove(i)}><TrashIcon size={16} /></IconButton>
                  </Tooltip>
                )}
              </Grid>
            </Grid>
          </Box>
        ))}
      </Box>
    </DataCard>
  );
}
