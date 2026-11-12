import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Box, Typography, CircularProgress, Chip, Alert,
} from '@mui/material';
import { LinkIcon, PlusIcon, RiskBadge } from 'shared';
import { api } from '../../services/api';
import { areaOptions as areaOptionsFrom } from '../../utils/areas';
import LinkObligationsPicker from './LinkObligationsPicker';
import LinkControlsPicker from './LinkControlsPicker';

const EMPTY = { name: '', description: '', riskType: '', areaOfFocus: '', inherentLikelihood: '', inherentImpact: '' };

const LIKELIHOODS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACTS = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Severe'];

function bandOf(likelihood, impact) {
  const l = LIKELIHOODS.indexOf(likelihood) + 1;
  const i = IMPACTS.indexOf(impact) + 1;
  if (!l || !i) return null;
  const s = l * i;
  if (s >= 18) return 'Critical';
  if (s >= 12) return 'High';
  if (s >= 6) return 'Moderate';
  return 'Low';
}

export default function AddRiskDialog({ open, onClose, onSaved, onError, risk = null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [obligations, setObligations] = useState([]);
  const [controls, setControls] = useState([]);
  const [saving, setSaving] = useState(false);
  const [obligationPickerOpen, setObligationPickerOpen] = useState(false);
  const [controlPickerOpen, setControlPickerOpen] = useState(false);
  const isEdit = !!risk;

  const { data: risks = [] } = useQuery({
    queryKey: ['risks', 'register'],
    queryFn: ({ signal }) => api.risks.register({}, { signal }),
    enabled: open,
  });

  const { data: controlData } = useQuery({
    queryKey: ['controls', 'picker'],
    queryFn: () => api.controls.list({}),
    enabled: open,
  });
  const allControls = Array.isArray(controlData) ? controlData : (controlData?.content || []);
  const controlById = new Map(allControls.map((c) => [c.controlId, c]));

  useEffect(() => {
    if (open) {
      setForm(risk ? {
        name: risk.name || '',
        description: risk.description || '',
        riskType: risk.riskType || '',
        areaOfFocus: risk.areaOfFocus || '',
        inherentLikelihood: risk.inherentLikelihood || '',
        inherentImpact: risk.inherentImpact || '',
      } : EMPTY);
      setObligations(risk?.obligations ? [...risk.obligations] : []);
      setControls(risk?.controls ? [...risk.controls] : []);
      setSaving(false);
      setObligationPickerOpen(false);
      setControlPickerOpen(false);
    }
  }, [open, risk]);

  const riskTypeOptions = Array.from(new Set(risks.map((r) => r.riskType).filter(Boolean))).sort();
  const areaOptions = areaOptionsFrom(risks.map((r) => r.areaOfFocus));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        riskType: form.riskType || null,
        areaOfFocus: form.areaOfFocus || null,
        inherentLikelihood: form.inherentLikelihood || null,
        inherentImpact: form.inherentImpact || null,
        obligationIds: obligations.map((o) => o.obligationId),
        controlIds: controls.map((c) => c.controlId),
      };
      if (isEdit) await api.risks.update(risk.riskId, payload);
      else await api.risks.create(payload);
      await qc.invalidateQueries({ queryKey: ['risks'] });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || `Failed to ${isEdit ? 'update' : 'create'} risk.`); }
    finally { setSaving(false); }
  }

  const controlLabel = (c) => c.controlNumber || c.name || `#${c.controlId}`;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? 'Edit Risk' : 'Add Risk'}</DialogTitle>
        <DialogContent dividers>
          {riskTypeOptions.length === 0 && areaOptions.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You can set the type and area free-form; options appear once risks and instruments exist.
            </Alert>
          )}
          <TextField size="small" fullWidth required label="Risk name" value={form.name}
            onChange={set('name')} sx={{ mb: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 2 }}>
            <TextField select size="small" label="Risk type" value={form.riskType} onChange={set('riskType')}>
              <MenuItem value=""><em>None</em></MenuItem>
              {riskTypeOptions.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Area of focus" value={form.areaOfFocus} onChange={set('areaOfFocus')}>
              <MenuItem value=""><em>None</em></MenuItem>
              {areaOptions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
          </Box>
          <TextField size="small" fullWidth multiline rows={3} label="Description"
            value={form.description} onChange={set('description')} sx={{ mb: 2.5 }} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 2, alignItems: 'center', mb: 2.5 }}>
            <TextField select size="small" label="Likelihood (inherent)" value={form.inherentLikelihood}
              onChange={set('inherentLikelihood')}>
              <MenuItem value=""><em>Unrated</em></MenuItem>
              {LIKELIHOODS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Impact (inherent)" value={form.inherentImpact}
              onChange={set('inherentImpact')}>
              <MenuItem value=""><em>Unrated</em></MenuItem>
              {IMPACTS.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </TextField>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
              <Typography variant="caption" color="text.secondary">Inherent band</Typography>
              <RiskBadge value={bandOf(form.inherentLikelihood, form.inherentImpact)} />
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            The risk is rated on its own likelihood × impact. Residual is derived live from the tests of the controls linked below.
          </Typography>

          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary">Obligations this risk covers</Typography>
              <Button size="small" variant="outlined" startIcon={<PlusIcon size={15} />}
                onClick={() => setObligationPickerOpen(true)}>Link obligations</Button>
            </Box>
            {obligations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">None linked.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {obligations.map((o) => (
                  <Chip key={o.obligationId} size="small" variant="outlined"
                    label={o.name}
                    onDelete={() => setObligations((prev) => prev.filter((x) => x.obligationId !== o.obligationId))} />
                ))}
              </Box>
            )}
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary">Controls linked to this risk</Typography>
              <Button size="small" variant="outlined" startIcon={<LinkIcon size={15} />}
                onClick={() => setControlPickerOpen(true)}>Link controls</Button>
            </Box>
            {controls.length === 0 ? (
              <Typography variant="body2" color="text.secondary">None linked.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {controls.map((c) => (
                  <Chip key={c.controlId} size="small" variant="outlined"
                    label={controlLabel(c)}
                    onDelete={() => setControls((prev) => prev.filter((x) => x.controlId !== c.controlId))} />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <CircularProgress size={18} /> : (isEdit ? 'Save changes' : 'Create risk')}
          </Button>
        </DialogActions>
      </Dialog>

      {obligationPickerOpen && (
        <LinkObligationsPicker open onClose={() => setObligationPickerOpen(false)}
          initialIds={obligations.map((o) => o.obligationId)}
          onSave={(ids, rows) => setObligations(rows || [])} />
      )}
      {controlPickerOpen && (
        <LinkControlsPicker open onClose={() => setControlPickerOpen(false)}
          initialIds={controls.map((c) => c.controlId)}
          onSave={(ids) => {
            const prevById = new Map(controls.map((c) => [c.controlId, c]));
            setControls(ids.map((id) => prevById.get(id) || controlById.get(id) || { controlId: id }));
          }} />
      )}
    </>
  );
}