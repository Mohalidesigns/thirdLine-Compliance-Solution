import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, CircularProgress, TextField, MenuItem, Box,
} from '@mui/material';
import { api } from '../../services/api';

const RISK_LEVELS = ['Critical', 'High', 'Moderate', 'Low'];
// The risk matrix axes (same as the heatmap and the backend's inherentBand), highest first.
const IMPACT_LEVELS = ['Severe', 'Major', 'Moderate', 'Minor', 'Insignificant'];
const LIKELIHOOD_LEVELS = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

// 1..5 for both the matrix labels and the toolkit's Very Low..Very High (mirrors common RiskBands).
const LEVEL = {
  'very low': 1, low: 2, medium: 3, moderate: 3, high: 4, 'very high': 5,
  insignificant: 1, minor: 2, major: 4, severe: 5,
  rare: 1, unlikely: 2, possible: 3, likely: 4, 'almost certain': 5,
};
function computedBand(impact, likelihood) {
  const i = LEVEL[String(impact || '').toLowerCase()];
  const l = LEVEL[String(likelihood || '').toLowerCase()];
  if (!i || !l) return null;
  const score = i * l;
  if (score >= 18) return 'Critical';
  if (score >= 12) return 'High';
  if (score >= 6) return 'Moderate';
  return 'Low';
}
// A seeded value on the toolkit scale (e.g. "High") stays selectable until it is changed.
const withCurrent = (levels, current) => (current && !levels.includes(current) ? [current, ...levels] : levels);

export default function RiskAssessmentModal({ open, onClose, obligationId, initial = {}, onSaved, onError }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        tenantRiskRating: '',
        riskJustification: initial.riskJustification || '',
        impactRating: initial.impactRating || '',
        likelihoodRating: initial.likelihoodRating || '',
        changeReason: '',
      });
    }
  }, [open, initial]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.updateRisk(obligationId, {
        tenantRiskRating: form.tenantRiskRating || null,
        riskJustification: form.riskJustification || null,
        impactRating: form.impactRating || null,
        likelihoodRating: form.likelihoodRating || null,
        changeReason: form.changeReason || 'Risk assessment updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save risk assessment.'); }
    finally { setLoading(false); }
  }

  const set = k => e => setForm({ ...form, [k]: e.target.value });
  const band = computedBand(form.impactRating, form.likelihoodRating);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Internal Risk Assessment</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          <TextField select size="small" label="Impact" value={form.impactRating || ''} onChange={set('impactRating')}>
            <MenuItem value=""><em>None</em></MenuItem>
            {withCurrent(IMPACT_LEVELS, initial.impactRating).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Likelihood" value={form.likelihoodRating || ''} onChange={set('likelihoodRating')}>
            <MenuItem value=""><em>None</em></MenuItem>
            {withCurrent(LIKELIHOOD_LEVELS, initial.likelihoodRating).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Inherent risk (computed)" value={band || '—'}
            slotProps={{ input: { readOnly: true } }} />
          <TextField select size="small" label="Override rating (optional)" value={form.tenantRiskRating || ''}
            onChange={set('tenantRiskRating')}
            helperText={initial.tenantRiskRating ? `Current rating: ${initial.tenantRiskRating}` : undefined}>
            <MenuItem value=""><em>Use computed</em></MenuItem>
            {RISK_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Inherent risk is impact × likelihood on the risk matrix. Choose an override only when the rating
          should differ — say why in the justification.
        </Typography>
        <TextField size="small" fullWidth multiline rows={3} label="Risk justification"
          value={form.riskJustification || ''} onChange={set('riskJustification')} sx={{ mt: 2 }} />
        <TextField size="small" fullWidth multiline rows={2} label="Reason for update (optional)"
          value={form.changeReason || ''} onChange={set('changeReason')} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
