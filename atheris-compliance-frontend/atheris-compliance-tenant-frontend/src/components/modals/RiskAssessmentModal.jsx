import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, CircularProgress, TextField, MenuItem, Box,
} from '@mui/material';
import { api } from '../../services/api';

const RISK_LEVELS = ['Extreme', 'High', 'Medium', 'Low'];
const IMPACT_LEVELS = ['Critical', 'High', 'Medium', 'Low'];
const LIKELIHOOD_LEVELS = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

export default function RiskAssessmentModal({ open, onClose, obligationId, initial = {}, onSaved, onError }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        tenantRiskRating: initial.tenantRiskRating || '',
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Internal Risk Assessment</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          <TextField select size="small" label="Risk Rating" value={form.tenantRiskRating || ''} onChange={set('tenantRiskRating')}>
            <MenuItem value=""><em>None</em></MenuItem>
            {RISK_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Impact" value={form.impactRating || ''} onChange={set('impactRating')}>
            <MenuItem value=""><em>None</em></MenuItem>
            {IMPACT_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Likelihood" value={form.likelihoodRating || ''} onChange={set('likelihoodRating')}>
            <MenuItem value=""><em>None</em></MenuItem>
            {LIKELIHOOD_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Inherent risk is computed automatically from impact × likelihood.
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
