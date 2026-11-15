import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Alert, CircularProgress, TextField, MenuItem, Grid,
} from '@mui/material';
import { DataCard, TL } from 'shared';
import { api } from '../../services/api';

const AXES = [
  { value: 'LIKELIHOOD', label: 'Likelihood only' },
  { value: 'IMPACT', label: 'Impact only' },
  { value: 'BOTH', label: 'Both likelihood and impact' },
];
const TARGETS = [
  { value: 'Passed', label: 'Passed' },
  { value: 'PassedOrPartial', label: 'Passed or Partial' },
];

const LIKELIHOODS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACTS = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Severe'];

function lowerLevel(levels, value, drop, floor) {
  const idx = levels.indexOf(value);
  if (idx < 0) return value;
  return levels[Math.max(floor, idx + 1 - drop) - 1];
}

function bandOf(likelihood, impact) {
  const l = LIKELIHOODS.indexOf(likelihood) + 1;
  const i = IMPACTS.indexOf(impact) + 1;
  if (!l || !i) return '—';
  const s = l * i;
  if (s >= 18) return 'Critical';
  if (s >= 12) return 'High';
  if (s >= 6) return 'Moderate';
  return 'Low';
}

export default function ComplianceSettingsTab() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: ['settings', 'compliance'],
    queryFn: ({ signal }) => api.settings.compliance({ signal }),
  });

  return (
    <Box>
      {query.isLoading && <CircularProgress />}
      {query.isError && <Alert severity="error">{query.error?.message || 'Could not load compliance settings.'}</Alert>}
      {query.data && (
        <ComplianceForm
          key={JSON.stringify(query.data)}
          initial={query.data}
          onSaved={(msg) => {
            qc.invalidateQueries({ queryKey: ['settings', 'compliance'] });
            qc.invalidateQueries({ queryKey: ['risks'] });
            setError('');
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
          onError={setError}
          saved={saved}
          error={error}
        />
      )}
    </Box>
  );
}

function ComplianceForm({ initial, onSaved, onError, saved, error }) {
  const seed = useMemo(() => ({
    residualAllDrop: String(initial.residualAllDrop ?? 2),
    residualMajorityDrop: String(initial.residualMajorityDrop ?? 1),
    residualAxis: initial.residualAxis || 'LIKELIHOOD',
    residualTarget: initial.residualTarget || 'Passed',
    residualFloor: String(initial.residualFloor ?? 1),
    controlDueSoonDays: String(initial.controlDueSoonDays ?? 30),
    findingDueSoonDays: String(initial.findingDueSoonDays ?? 7),
    slaCriticalDays: String(initial.slaCriticalDays ?? 1),
    slaHighDays: String(initial.slaHighDays ?? 14),
    slaMediumDays: String(initial.slaMediumDays ?? 30),
    slaLowDays: String(initial.slaLowDays ?? 60),
  }), [initial]);
  const [form, setForm] = useState(seed);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => api.settings.saveCompliance({
      residualAllDrop: Number(form.residualAllDrop),
      residualMajorityDrop: Number(form.residualMajorityDrop),
      residualAxis: form.residualAxis,
      residualTarget: form.residualTarget,
      residualFloor: Number(form.residualFloor),
      controlDueSoonDays: Number(form.controlDueSoonDays),
      findingDueSoonDays: Number(form.findingDueSoonDays),
      slaCriticalDays: Number(form.slaCriticalDays),
      slaHighDays: Number(form.slaHighDays),
      slaMediumDays: Number(form.slaMediumDays),
      slaLowDays: Number(form.slaLowDays),
    }),
    onSuccess: () => onSaved('Compliance settings saved.'),
    onError: (e) => onError(e.message || 'Could not save compliance settings.'),
  });

  const allDrop = Number(form.residualAllDrop) || 0;
  const axis = form.residualAxis;
  const floor = Math.max(1, Number(form.residualFloor) || 1);
  const l0 = 'Likely', i0 = 'Major';
  const pvL = (axis === 'IMPACT') ? l0 : lowerLevel(LIKELIHOODS, l0, allDrop, floor);
  const pvI = (axis === 'LIKELIHOOD') ? i0 : lowerLevel(IMPACTS, i0, allDrop, floor);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Compliance settings saved.</Alert>}

      <DataCard title="Risk residual rule" sx={{ mb: 3 }}
        subtitle="How a risk's residual rating is derived from its linked controls' latest accepted tests.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Drop when all effective"
              value={form.residualAllDrop} onChange={set('residualAllDrop')}
              slotProps={{ htmlInput: { min: 0 } }}
              helperText="Levels lowered when every linked control is effective" />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Drop when majority effective"
              value={form.residualMajorityDrop} onChange={set('residualMajorityDrop')}
              slotProps={{ htmlInput: { min: 0 } }}
              helperText="Levels lowered when more than half are effective" />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField select fullWidth size="small" label="Apply drop to"
              value={form.residualAxis} onChange={set('residualAxis')}>
              {AXES.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField select fullWidth size="small" label="Counts as effective when"
              value={form.residualTarget} onChange={set('residualTarget')}>
              {TARGETS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Floor level" value={form.residualFloor}
              onChange={set('residualFloor')} slotProps={{ htmlInput: { min: 1 } }}
              helperText="Lowest level the axis may drop to (1 = Rare / Insignificant)" />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', bgcolor: TL.gray50, border: `1px solid ${TL.gray100}` }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Preview — a risk rated {l0} × {i0} with all its controls effective:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {l0} × {i0} ({bandOf(l0, i0)}) → {pvL} × {pvI} ({bandOf(pvL, pvI)})
          </Typography>
        </Box>
      </DataCard>

      <DataCard title="Timeliness horizons" sx={{ mb: 3 }}
        subtitle="How far ahead work surfaces in the Tasks centre as “due soon”.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Control tests due (days)"
              value={form.controlDueSoonDays} onChange={set('controlDueSoonDays')}
              slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Findings due (days)"
              value={form.findingDueSoonDays} onChange={set('findingDueSoonDays')}
              slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
        </Grid>
      </DataCard>

      <DataCard title="Finding remediation SLA (days)" sx={{ mb: 3 }}
        subtitle="Default remediation window for new findings, by severity.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Critical"
              value={form.slaCriticalDays} onChange={set('slaCriticalDays')} slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="High"
              value={form.slaHighDays} onChange={set('slaHighDays')} slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Medium"
              value={form.slaMediumDays} onChange={set('slaMediumDays')} slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth size="small" type="number" label="Low"
              value={form.slaLowDays} onChange={set('slaLowDays')} slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
        </Grid>
      </DataCard>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save settings'}
        </Button>
      </Box>
    </>
  );
}