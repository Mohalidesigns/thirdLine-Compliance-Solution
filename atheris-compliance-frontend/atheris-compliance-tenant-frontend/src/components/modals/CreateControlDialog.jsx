import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { ChevronDownIcon } from 'shared';
import { api } from '../../services/api';
import OwnerPicker from '../org/OwnerPicker';
import PersonPicker from '../common/PersonPicker';

const EMPTY = {
  name: '', description: '', controlType: '', inherentRisk: '',
  whatItDoes: '', howTested: '', controlOwnerId: null, testerOwnerId: null, testFrequency: '',
  firstDueDate: '',
  reminderStartValue: '', reminderStartUnit: 'DAYS', reminderRepeatValue: '', reminderRepeatUnit: 'DAYS',
  level1Person: null, level1AfterValue: '', level1AfterUnit: 'DAYS',
  level2Person: null, level2AfterValue: '', level2AfterUnit: 'DAYS',
};

const scopeForFrequency = (f) => (f ? f.toUpperCase().replace(/-/g, '_') : null);
const FREQ_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, 'Semi-Annual': 182, Annual: 365 };
const scopeDays = (f) => FREQ_DAYS[f] ?? 30;

const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Directive'];
const RISKS = ['Critical', 'High', 'Moderate', 'Low'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

function Field({ label, children, sx }) {
  return (
    <Box sx={{ mb: 2, ...sx }}>
      <Typography variant="caption" sx={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default function CreateControlDialog({ open, onClose, onSaved, onSnackbar, obligationId = null }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [level2Shown, setLevel2Shown] = useState(false);
  const [remindersTouched, setRemindersTouched] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['escalation', 'policies', 'CONTROL', 'templates'],
    queryFn: ({ signal }) => api.escalation.policies('CONTROL', { defaultsOnly: true }, { signal }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY });
    setLevel2Shown(false);
    setRemindersTouched(false);
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const scope = scopeForFrequency(form.testFrequency);
  const templates = templatesQuery.data || [];
  useEffect(() => {
    if (!open || remindersTouched) return;
    const match = templates.find(p => (p.frequencyScope || null) === scope)
      || templates.find(p => !p.frequencyScope);
    if (!match) return;
    setForm(f => ({
      ...f,
      reminderStartValue: match.reminderStartValue ?? '',
      reminderStartUnit: match.reminderStartUnit || 'DAYS',
      reminderRepeatValue: match.reminderRepeatValue ?? '',
      reminderRepeatUnit: match.reminderRepeatUnit || 'DAYS',
    }));
  }, [open, scope, templates, remindersTouched]);

  const levelRows = (level2Shown ? [1, 2] : [1])
    .map(n => ({ n, person: form[`level${n}Person`], after: form[`level${n}AfterValue`], unit: form[`level${n}AfterUnit`] }))
    .filter(r => r.person || String(r.after).trim() !== '')
    .map(r => {
      const afterValue = String(r.after).trim() === '' ? 0 : Number(r.after);
      if (r.person && (r.person.email || r.person.userId)) {
        return { afterValue, afterUnit: r.unit, targetType: 'PERSON',
          targetUserId: r.person.userId ? Number(r.person.userId) : null,
          targetName: r.person.fullName || null, targetEmail: r.person.email || null };
      }
      return { afterValue, afterUnit: r.unit, targetType: r.n === 1 ? 'MANAGER' : 'CCO' };
    });
  const ladderTouched = !!(form.level1Person
    || (level2Shown && (form.level2Person || String(form.level2AfterValue).trim() !== '')));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Control name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      ['reminderStartValue', 'reminderStartUnit', 'reminderRepeatValue', 'reminderRepeatUnit',
        'level1Person', 'level1AfterValue', 'level1AfterUnit',
        'level2Person', 'level2AfterValue', 'level2AfterUnit'].forEach(k => delete body[k]);
      if (!body.controlOwnerId) body.controlOwnerId = null;
      if (!body.testerOwnerId) body.testerOwnerId = null;
      const created = await api.controls.create(body);
      if (created?.controlId && (remindersTouched || ladderTouched)) {
        await api.controls.updateEscalation(created.controlId, {
          reminderStartValue: form.reminderStartValue === '' ? null : Number(form.reminderStartValue),
          reminderStartUnit: form.reminderStartUnit,
          reminderRepeatValue: form.reminderRepeatValue === '' ? null : Number(form.reminderRepeatValue),
          reminderRepeatUnit: form.reminderRepeatUnit,
          levels: ladderTouched ? levelRows : [],
        });
      }
      if (obligationId && created?.controlId) {
        await api.obligations.linkControls(obligationId, {
          linkedControlIds: [created.controlId], changeReason: 'Control created from gap finding',
        });
      }
      onSaved?.(created);
    } catch (e) { const msg = e.message || 'Failed to create control.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>New Control</DialogTitle>
        <DialogContent sx={{ '&&': { pt: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Basic details</Typography>
          <Field label="Control name *">
            <TextField fullWidth size="small" placeholder="e.g. Segregation of duties" required value={form.name}
              onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Description">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="What this control covers"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Classification</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Field label="Control type" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.controlType} onChange={e => set('controlType', e.target.value)}>
                <MenuItem value=""><em>Select type</em></MenuItem>
                {CONTROL_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Inherent risk" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.inherentRisk} onChange={e => set('inherentRisk', e.target.value)}>
                <MenuItem value=""><em>Select risk</em></MenuItem>
                {RISKS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Field>
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Execution</Typography>
          <Field label="What it does">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="How this control is executed"
              value={form.whatItDoes} onChange={e => set('whatItDoes', e.target.value)} />
          </Field>
          <Field label="How it's tested">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="How testing is performed"
              value={form.howTested} onChange={e => set('howTested', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Ownership & schedule</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Field label="Control owner" sx={{ mb: 0 }}>
              <OwnerPicker value={form.controlOwnerId} onChange={id => set('controlOwnerId', id)} label="Control owner" />
            </Field>
            <Field label="Tester" sx={{ mb: 0 }}>
              <OwnerPicker value={form.testerOwnerId} onChange={id => set('testerOwnerId', id)} label="Who performs the test" />
            </Field>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Field label="Test frequency" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.testFrequency} onChange={e => set('testFrequency', e.target.value)}>
                <MenuItem value=""><em>Select frequency</em></MenuItem>
                {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="First test due date" sx={{ mb: 0 }}>
              <TextField fullWidth size="small" type="date" value={form.firstDueDate}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={e => set('firstDueDate', e.target.value)} />
            </Field>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Leave the due date blank to schedule the first test automatically from the frequency
            {form.testFrequency ? ` (${form.testFrequency} — ${scopeDays(form.testFrequency)} days)` : ''}.
          </Typography>

          <Accordion disableGutters elevation={0}
            sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Reminders &amp; escalation</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Defaults follow the test frequency. Change the lead here to give this control its own reminder rule.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Field label="Remind before" sx={{ mb: 0 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                    <TextField fullWidth size="small" type="number" value={form.reminderStartValue}
                      slotProps={{ htmlInput: { min: 0 } }}
                      onChange={e => { setRemindersTouched(true); set('reminderStartValue', e.target.value); }} />
                    <TextField select fullWidth size="small" value={form.reminderStartUnit}
                      onChange={e => { setRemindersTouched(true); set('reminderStartUnit', e.target.value); }}>
                      <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
                    </TextField>
                  </Box>
                  {String(form.reminderStartValue).trim() !== '' && Number(form.reminderStartValue) === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      No advance reminder is sent.
                    </Typography>
                  )}
                </Field>
                <Field label="Remind after every" sx={{ mb: 0 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
                    <TextField fullWidth size="small" type="number" value={form.reminderRepeatValue}
                      slotProps={{ htmlInput: { min: 0 } }}
                      onChange={e => { setRemindersTouched(true); set('reminderRepeatValue', e.target.value); }} />
                    <TextField select fullWidth size="small" value={form.reminderRepeatUnit}
                      onChange={e => { setRemindersTouched(true); set('reminderRepeatUnit', e.target.value); }}>
                      <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
                    </TextField>
                  </Box>
                </Field>
              </Box>
              {(level2Shown ? [1, 2] : [1]).map((n) => (
                <Box key={n} sx={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr', gap: 1, mt: 1.5 }}>
                  <Field label="Escalate to" sx={{ mb: 0 }}>
                    <PersonPicker mode="user" label={`Level ${n} escalate to`} value={form[`level${n}Person`]}
                      onChange={p => set(`level${n}Person`, p)} />
                  </Field>
                  <Field label={`Level ${n}`} sx={{ mb: 0 }}>
                    <TextField fullWidth size="small" type="number" value={form[`level${n}AfterValue`]}
                      slotProps={{ htmlInput: { min: 0 } }} placeholder="0"
                      onChange={e => set(`level${n}AfterValue`, e.target.value)} />
                  </Field>
                  <Field label="Unit" sx={{ mb: 0 }}>
                    <TextField select fullWidth size="small" value={form[`level${n}AfterUnit`]}
                      onChange={e => set(`level${n}AfterUnit`, e.target.value)}>
                      <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
                    </TextField>
                  </Field>
                </Box>
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                {level2Shown ? (
                  <Button size="small" variant="text" onClick={() => {
                    setLevel2Shown(false);
                    setForm(f => ({ ...f, level2AfterValue: '', level2Person: null }));
                  }}>Remove level 2</Button>
                ) : (
                  <Button size="small" variant="text" onClick={() => setLevel2Shown(true)}>+ Add another level</Button>
                )}
                <Typography variant="caption" color="text.secondary">After the due date.</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Leave the ladder blank to keep the default: responsible person +0 days, manager +2 days, CCO +5 days.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}