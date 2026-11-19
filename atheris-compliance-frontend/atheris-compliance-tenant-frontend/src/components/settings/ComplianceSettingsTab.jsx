import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Alert, CircularProgress, TextField, MenuItem, Grid, Switch, FormControlLabel,
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
    requireControlTestReview: initial.requireControlTestReview ?? true,
    requireFindingReview: initial.requireFindingReview ?? true,
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
      requireControlTestReview: form.requireControlTestReview,
      requireFindingReview: form.requireFindingReview,
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

      <DataCard title="Review gates" sx={{ mb: 3 }}
        subtitle="Whether a recorded control test / submitted remediation must be accepted before it takes effect.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={<Switch checked={!!form.requireControlTestReview}
                onChange={e => setForm(f => ({ ...f, requireControlTestReview: e.target.checked }))} />}
              label="Require review of control tests" />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 0.5 }}>
              On: every recorded test is Pending until accepted. Off: in-app/runbook tests are accepted on record
              (public-test-link submissions are always reviewed).
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={<Switch checked={!!form.requireFindingReview}
                onChange={e => setForm(f => ({ ...f, requireFindingReview: e.target.checked }))} />}
              label="Require review of remediation" />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 0.5 }}>
              On: submitted remediation is “Awaiting review” until accepted. Off: submitting remediation closes the finding.
            </Typography>
          </Grid>
        </Grid>
      </DataCard>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save settings'}
        </Button>
      </Box>

      <ScoreWeightsCard />
      <DashboardThresholdsCard />
      <RiskMatrixCard />
    </>
  );
}

function ScoreWeightsCard() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['settings', 'score-weights'],
    queryFn: ({ signal }) => api.dashboard.scoreWeights({ signal }),
  });
  return (
    <DataCard title="Compliance score weights" sx={{ mb: 3 }}
      subtitle="How the overall compliance score is weighted (percentages must sum to 100).">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {query.data && (
        <ScoreWeightsForm key={JSON.stringify(query.data)} initial={query.data}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['settings', 'score-weights'] }); setError(''); }}
          onError={setError} />
      )}
    </DataCard>
  );
}

function ScoreWeightsForm({ initial, onSaved, onError }) {
  const seed = useMemo(() => ({
    controlCoverage: String(initial.controlCoverage ?? 30),
    controlTests: String(initial.controlTests ?? 25),
    returnsOnTime: String(initial.returnsOnTime ?? 30),
    findingsWithinSla: String(initial.findingsWithinSla ?? 15),
  }), [initial]);
  const [form, setForm] = useState(seed);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sum = ['controlCoverage', 'controlTests', 'returnsOnTime', 'findingsWithinSla']
    .reduce((a, k) => a + (Number(form[k]) || 0), 0);
  const save = useMutation({
    mutationFn: () => api.dashboard.saveScoreWeights({
      controlCoverage: Number(form.controlCoverage), controlTests: Number(form.controlTests),
      returnsOnTime: Number(form.returnsOnTime), findingsWithinSla: Number(form.findingsWithinSla),
    }),
    onSuccess: () => onSaved(),
    onError: (e) => onError(e.message || 'Could not save score weights.'),
  });
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Control coverage"
            value={form.controlCoverage} onChange={set('controlCoverage')} slotProps={{ htmlInput: { min: 0 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Control effectiveness"
            value={form.controlTests} onChange={set('controlTests')} slotProps={{ htmlInput: { min: 0 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Returns on time"
            value={form.returnsOnTime} onChange={set('returnsOnTime')} slotProps={{ htmlInput: { min: 0 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Findings within SLA"
            value={form.findingsWithinSla} onChange={set('findingsWithinSla')} slotProps={{ htmlInput: { min: 0 } }} />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" sx={{ color: sum === 100 ? '#2D7D46' : 'error.main', fontWeight: 600 }}>
          Sum: {sum}% {sum === 100 ? '' : '(must equal 100)'}
        </Typography>
        <Button variant="contained" size="small" onClick={() => save.mutate()}
          disabled={save.isPending || sum !== 100}>Save weights</Button>
      </Box>
    </>
  );
}

const METRIC_LABELS = {
  returns_on_time: 'Returns on time',
  control_coverage: 'Control coverage',
};

function DashboardThresholdsCard() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['settings', 'dashboard-thresholds'],
    queryFn: ({ signal }) => api.dashboard.v2.thresholds({ signal }),
  });
  return (
    <DataCard title="Dashboard colour thresholds" sx={{ mb: 3 }}
      subtitle="Green / amber cut-offs for the returns and coverage RAG colours.">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {query.data && (
        <ThresholdsForm key={JSON.stringify(query.data)} initial={query.data}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['settings', 'dashboard-thresholds'] }); setError(''); }}
          onError={setError} />
      )}
    </DataCard>
  );
}

function ThresholdsForm({ initial, onSaved, onError }) {
  const seed = useMemo(() => {
    const t = initial.thresholds || {};
    return {
      returnsGreen: String(t.returns_on_time?.green ?? 90),
      returnsAmber: String(t.returns_on_time?.amber ?? 70),
      coverageGreen: String(t.control_coverage?.green ?? 80),
      coverageAmber: String(t.control_coverage?.amber ?? 60),
    };
  }, [initial]);
  const [form, setForm] = useState(seed);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => api.dashboard.v2.saveThresholds({
      thresholds: {
        returns_on_time: { green: Number(form.returnsGreen), amber: Number(form.returnsAmber) },
        control_coverage: { green: Number(form.coverageGreen), amber: Number(form.coverageAmber) },
      },
    }),
    onSuccess: () => onSaved(),
    onError: (e) => onError(e.message || 'Could not save thresholds.'),
  });
  return (
    <>
      <Typography variant="caption" color="text.secondary">Returns on time</Typography>
      <Grid container spacing={2} sx={{ mb: 2, mt: 0.25 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Green ≥ %"
            value={form.returnsGreen} onChange={set('returnsGreen')} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Amber ≥ %"
            value={form.returnsAmber} onChange={set('returnsAmber')} />
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary">Control coverage</Typography>
      <Grid container spacing={2} sx={{ mb: 2, mt: 0.25 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Green ≥ %"
            value={form.coverageGreen} onChange={set('coverageGreen')} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Amber ≥ %"
            value={form.coverageAmber} onChange={set('coverageAmber')} />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" size="small" onClick={() => save.mutate()} disabled={save.isPending}>Save thresholds</Button>
      </Box>
    </>
  );
}

function RiskMatrixCard() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['settings', 'risk-matrix'],
    queryFn: () => api.settings.riskMatrix(),
  });
  return (
    <DataCard title="Risk matrix band thresholds" sx={{ mb: 3 }}
      subtitle="Score cut-offs (likelihood × impact, 1–5) that decide the risk band. Changing these re-bands every obligation and risk.">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {query.data && (
        <RiskMatrixForm key={JSON.stringify(query.data)} initial={query.data}
          onSaved={(msg) => {
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['obligations'] });
            qc.invalidateQueries({ queryKey: ['risks'] });
            qc.invalidateQueries({ queryKey: ['settings', 'risk-matrix'] });
            setError(''); setNotice(msg); setTimeout(() => setNotice(''), 4000);
          }}
          onError={setError} />
      )}
    </DataCard>
  );
}

function RiskMatrixForm({ initial, onSaved, onError }) {
  const seed = useMemo(() => {
    const b = initial.bandThresholds || {};
    return {
      moderate: String(b.moderate ?? 6),
      high: String(b.high ?? 12),
      critical: String(b.critical ?? 18),
    };
  }, [initial]);
  const [form, setForm] = useState(seed);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => api.settings.updateRiskMatrix({
      bandThresholds: {
        moderate: Number(form.moderate), high: Number(form.high), critical: Number(form.critical),
      },
    }),
    onSuccess: () => onSaved('Band thresholds saved — obligations and risks re-banded.'),
    onError: (e) => onError(e.message || 'Could not save band thresholds.'),
  });
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Moderate ≥ (score)" value={form.moderate}
            onChange={set('moderate')} slotProps={{ htmlInput: { min: 1 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="High ≥ (score)" value={form.high}
            onChange={set('high')} slotProps={{ htmlInput: { min: 1 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Critical ≥ (score)" value={form.critical}
            onChange={set('critical')} slotProps={{ htmlInput: { min: 1 } }} />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="contained" size="small" onClick={() => save.mutate()} disabled={save.isPending}>Save band thresholds</Button>
      </Box>
    </>
  );
}