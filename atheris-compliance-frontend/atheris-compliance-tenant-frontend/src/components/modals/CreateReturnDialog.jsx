import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Autocomplete, Chip,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { LinkIcon, ChevronDownIcon } from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MultiPersonPicker from '../common/MultiPersonPicker';
import PersonPicker from '../common/PersonPicker';
import LinkObligationsPicker from './LinkObligationsPicker';
import RegulatorFormDialog from './RegulatorFormDialog';

const EMPTY = {
  returnName: '', actId: '', filingRegulator: '', tenantRegulatorId: '', returnType: '', frequency: '',
  filingDate: '', ruleType: 'DATE', dueDaysAfterPeriodEnd: '', filingDeadlineOffsetDays: '', filingChannel: '',
  responsibleUnits: [], responsiblePersons: [], escalationPolicyId: '',
  ownerEmail: '', ownerName: '', ownerUserId: '',
  reminderStartValue: 10, reminderStartUnit: 'DAYS', reminderRepeatValue: 2, reminderRepeatUnit: 'DAYS',
  level1Person: null, level1AfterValue: 3, level1AfterUnit: 'DAYS',
  level2Person: null, level2AfterValue: 7, level2AfterUnit: 'DAYS',
  linkedObligationIds: [],
};

const CYCLES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial'];
const OFFSET_CYCLES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const RETURN_TYPES = ['Statutory', 'Prudential', 'Statistical', 'Regulatory', 'Ad-hoc', 'Other'];
const EVENT_DRIVEN = 'On event';
// Recurring frequencies that need a due rule; without one the return gets no periods.
const NEEDS_DUE_DATE = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial'];
// Frequencies whose deadline can be expressed as "N days after the reporting period ends".
const OFFSET_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const PERIOD_NOUN = { Monthly: 'month', Quarterly: 'quarter', 'Semi-Annual': 'half-year', Annual: 'year', Biennial: 'two-year' };
const CYCLE_NOUN = { Daily: 'day', Weekly: 'week', Monthly: 'month', Quarterly: 'quarter', 'Semi-Annual': 'half-year', Annual: 'year', Biennial: 'two years' };
const offsetSupported = (freq) => OFFSET_FREQUENCIES.includes(freq);

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

export default function CreateReturnDialog({ open, onClose, onSaved, onSnackbar }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extraRegulators, setExtraRegulators] = useState([]);
  const [level2Shown, setLevel2Shown] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [regulatorAddOpen, setRegulatorAddOpen] = useState(false);

  const regulatorsQuery = useQuery({
    queryKey: ['regulators', 'list'],
    queryFn: ({ signal }) => api.regulators.list({}, { signal }),
    enabled: open,
  });
  const actsQuery = useQuery({
    queryKey: ['acts', 'list', 1000],
    queryFn: ({ signal }) => api.acts.list({ size: 1000 }, { signal }),
    enabled: open,
  });
  const departmentsQuery = useQuery({
    queryKey: ['org', 'departments', true],
    queryFn: () => api.org.departments(true),
    enabled: open,
  });
  const asList = (d) => (Array.isArray(d) ? d : (d?.content || []));
  const regulators = useMemo(() => [...asList(regulatorsQuery.data), ...extraRegulators], [regulatorsQuery.data, extraRegulators]);
  const acts = asList(actsQuery.data);
  const departments = asList(departmentsQuery.data);

  const addRegulator = (created) => {
    setRegulatorAddOpen(false);
    if (!created) return;
    setExtraRegulators(prev => [...prev, created]);
    set('filingRegulator', created.abbreviation || created.name || '');
    set('tenantRegulatorId', String(created.id ?? created.tenantRegulatorId));
  };

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ownerEmail: user?.email || '', ownerName: user?.fullName || '', ownerUserId: user?.userId ?? '' });
      setError(''); setExtraRegulators([]); setLevel2Shown(false);
    }
  }, [open, user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const ownerValue = form.ownerEmail ? { email: form.ownerEmail, fullName: form.ownerName, userId: form.ownerUserId || null } : null;

  const handleSave = async () => {
    if (!form.returnName.trim()) { setError('Return name is required'); return; }
    if (!form.actId && !(form.linkedObligationIds || []).length) {
      setError('Ground this return to an Act, or link at least one obligation');
      return;
    }
    if (!(form.responsiblePersons || []).length) { setError('Select at least one responsible person — they submit the filing data'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      delete body.linkedObligationIds;
      ['ownerEmail', 'ownerName', 'ownerUserId',
        'level1Person', 'level1AfterValue', 'level1AfterUnit',
        'level2Person', 'level2AfterValue', 'level2AfterUnit',
        'reminderStartValue', 'reminderStartUnit', 'reminderRepeatValue', 'reminderRepeatUnit'].forEach(k => delete body[k]);
      body.actId = parseInt(form.actId, 10);
      delete body.filingDeadlineOffsetDays;
      if (body.tenantRegulatorId) body.tenantRegulatorId = parseInt(body.tenantRegulatorId, 10);
      else delete body.tenantRegulatorId;
      if (form.escalationPolicyId) body.escalationPolicyId = parseInt(form.escalationPolicyId, 10);
      else delete body.escalationPolicyId;

      body.responsibleUnits = (form.responsibleUnits || [])
        .map(u => (typeof u === 'string' ? u : (u.name || ''))).filter(Boolean);
      body.responsiblePersons = (form.responsiblePersons || [])
        .map(p => (p.fullName || p.email || '')).filter(Boolean);
      delete body.responsibleUnit;
      delete body.responsiblePerson;

      if (form.ownerUserId) body.returnOwnerUserId = parseInt(form.ownerUserId, 10);
      body.returnOwnerName = form.ownerName || form.ownerEmail || undefined;
      if (!body.returnOwnerName) delete body.returnOwnerName;

      if (form.frequency === EVENT_DRIVEN) {
        delete body.filingDate;
        delete body.dueDaysAfterPeriodEnd;
        delete body.ruleType;
      } else if (form.ruleType === 'OFFSET') {
        delete body.filingDate;
        if (body.dueDaysAfterPeriodEnd) body.dueDaysAfterPeriodEnd = parseInt(body.dueDaysAfterPeriodEnd, 10);
        else delete body.dueDaysAfterPeriodEnd;
      } else {
        delete body.dueDaysAfterPeriodEnd;
        if (!body.filingDate) delete body.filingDate;
      }
      delete body.deadlineKind;

      const created = await api.returns.create(body);
      if (form.linkedObligationIds?.length) {
        await api.returns.linkObligations(created, form.linkedObligationIds.map(Number));
      }
      const remindersChanged = String(form.reminderStartValue) !== '10' || form.reminderStartUnit !== 'DAYS'
        || String(form.reminderRepeatValue) !== '2' || form.reminderRepeatUnit !== 'DAYS';
      // A blank "Level N" means that level is not wanted; levels are sent in order, so they stay contiguous.
      // No person picked → level 1 goes to the responsible person's manager, level 2 to the CCO.
      const levels = (level2Shown ? [1, 2] : [1])
        .filter(n => String(form[`level${n}AfterValue`]).trim() !== '')
        .map(n => {
          const row = { afterValue: Number(form[`level${n}AfterValue`]), afterUnit: form[`level${n}AfterUnit`] };
          const p = form[`level${n}Person`];
          if (p && (p.email || p.userId)) {
            return { ...row, targetType: 'PERSON', targetUserId: p.userId ? Number(p.userId) : null,
              targetName: p.fullName || null, targetEmail: p.email || null };
          }
          return { ...row, targetType: n === 1 ? 'MANAGER' : 'CCO' };
        });
      const levelsChanged = JSON.stringify(levels) !== JSON.stringify([
        { targetType: 'MANAGER', afterValue: 3, afterUnit: 'DAYS' },
      ]);
      if (remindersChanged || levelsChanged) {
        await api.returns.updateEscalation(created, {
          reminderStartValue: form.reminderStartValue === '' ? null : Number(form.reminderStartValue),
          reminderStartUnit: form.reminderStartUnit,
          reminderRepeatValue: form.reminderRepeatValue === '' ? null : Number(form.reminderRepeatValue),
          reminderRepeatUnit: form.reminderRepeatUnit,
          levels,
        });
      }
      onSaved?.(created);
      onClose();
    } catch (e) { const msg = e.message || 'Failed to create return.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Return</DialogTitle>
      <DialogContent sx={{ '&&': { pt: 2.5 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Basic details</Typography>
        <Field label="Return Name *">
          <TextField fullWidth size="small" required value={form.returnName}
            onChange={e => set('returnName', e.target.value)} />
        </Field>
        <Field label="Grounding — link obligations, or pick an act below">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" startIcon={<LinkIcon size={16} />}
              onClick={() => setLinksOpen(true)}>
              {form.linkedObligationIds.length > 0
                ? `Linked obligations (${form.linkedObligationIds.length})`
                : 'Link obligations'}
            </Button>
            {form.linkedObligationIds.map(id => (
              <Chip key={id} size="small" label={`Obligation #${id}`} onDelete={() => set('linkedObligationIds', form.linkedObligationIds.filter(x => x !== id))} />
            ))}
          </Box>
        </Field>
        <Field label="Act">
          <Autocomplete size="small" options={acts}
            getOptionLabel={(o) => o.name || ''}
            isOptionEqualToValue={(o, v) => String(o.regulationId) === String(v.regulationId)}
            value={acts.find(a => String(a.regulationId) === String(form.actId)) || null}
            onChange={(_, val) => set('actId', val ? String(val.regulationId) : '')}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Search act"
                error={!form.actId && !(form.linkedObligationIds || []).length} />
            )} />
        </Field>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Regulator" sx={{ mb: 0 }}>
            <Autocomplete size="small" freeSolo clearOnEscape
              options={regulators}
              getOptionLabel={(o) => (typeof o === 'string' ? o : (o.abbreviation || o.name))}
              value={regulators.find(r => r.id === form.tenantRegulatorId) || form.filingRegulator || null}
              onChange={(_, val) => {
                if (typeof val === 'string') {
                  set('filingRegulator', val);
                  set('tenantRegulatorId', '');
                } else if (val) {
                  set('filingRegulator', val.abbreviation || val.name);
                  set('tenantRegulatorId', String(val.id));
                } else {
                  set('filingRegulator', '');
                  set('tenantRegulatorId', '');
                }
              }}
              renderInput={(params) => (
                <TextField {...params} fullWidth size="small" placeholder="Search or type regulator name"
                  onChange={e => set('filingRegulator', e.target.value)} />
              )}
            />
            <Button size="small" sx={{ mt: 0.5, textTransform: 'none' }} onClick={() => setRegulatorAddOpen(true)}>
              + Add regulator
            </Button>
          </Field>
          <Field label="Return Type" sx={{ mb: 0 }}>
            <TextField select fullWidth size="small" value={form.returnType}
              onChange={e => set('returnType', e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {RETURN_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Filing schedule</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Frequency *" sx={{ mb: 0 }}>
            <TextField select fullWidth size="small" value={form.frequency}
              onChange={e => set('frequency', e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {[...CYCLES, EVENT_DRIVEN].map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
          </Field>
          <Field label="Filing Channel" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.filingChannel}
              onChange={e => set('filingChannel', e.target.value)} />
          </Field>
        </Box>

        {form.frequency && form.frequency !== EVENT_DRIVEN && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Field label="When is it due? *" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.ruleType}
                onChange={e => set('ruleType', e.target.value)}
                helperText={form.ruleType === 'OFFSET'
                  ? `Anchored to the period end — due N days after each ${PERIOD_NOUN[form.frequency] || 'period'} closes.`
                  : `A fixed calendar date, repeated every ${CYCLE_NOUN[form.frequency] || 'cycle'} (e.g. 31 Mar).`}>
                <MenuItem value="DATE">On a fixed calendar date each cycle</MenuItem>
                <MenuItem value="OFFSET">A number of days after the reporting period ends</MenuItem>
              </TextField>
            </Field>
            <Box sx={{ mt: 2 }}>
              {form.ruleType === 'OFFSET' ? (
                <Field label={`Days after the ${PERIOD_NOUN[form.frequency] || 'period'} ends *`} sx={{ mb: 0 }}>
                  <TextField fullWidth size="small" type="number" value={form.dueDaysAfterPeriodEnd}
                    onChange={e => set('dueDaysAfterPeriodEnd', e.target.value)}
                    helperText="e.g. 10 → due the 10th day of the following month." />
                </Field>
              ) : (
                <Field label="First due date *" sx={{ mb: 0 }}>
                  <TextField fullWidth size="small" type="date" value={form.filingDate}
                    onChange={e => set('filingDate', e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }} />
                </Field>
              )}
            </Box>
            {form.ruleType === 'OFFSET' && !offsetSupported(form.frequency) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                A period-end offset needs a cycle of Monthly or longer (up to Annual). Use a fixed date for this frequency.
              </Alert>
            )}
          </Box>
        )}
        {form.frequency === EVENT_DRIVEN && (
          <Alert severity="info" sx={{ mt: 2 }}>
            The deadline is anchored to the event, not a period. Configure the trigger (offset from the event, or a
            manual date) on the return after creating it.
          </Alert>
        )}
        {NEEDS_DUE_DATE.includes(form.frequency) && form.ruleType === 'OFFSET' && !form.dueDaysAfterPeriodEnd && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Enter the number of days after period end, or this return will show as 'Due date needed'.
          </Alert>
        )}
        {NEEDS_DUE_DATE.includes(form.frequency) && form.ruleType !== 'OFFSET' && !form.filingDate && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Without a due date this return will show as 'Due date needed'.
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
          <Field label="Remind before" sx={{ mb: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>
              <TextField fullWidth size="small" type="number" value={form.reminderStartValue}
                slotProps={{ htmlInput: { min: 0 } }}
                onChange={e => set('reminderStartValue', e.target.value)} />
              <TextField select fullWidth size="small" value={form.reminderStartUnit}
                onChange={e => set('reminderStartUnit', e.target.value)}>
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
                onChange={e => set('reminderRepeatValue', e.target.value)} />
              <TextField select fullWidth size="small" value={form.reminderRepeatUnit}
                onChange={e => set('reminderRepeatUnit', e.target.value)}>
                <MenuItem value="DAYS">Days</MenuItem><MenuItem value="HOURS">Hours</MenuItem>
              </TextField>
            </Box>
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Responsible person" sx={{ mb: 0 }}>
            <MultiPersonPicker label="Responsible person" value={form.responsiblePersons}
              onChange={(list) => set('responsiblePersons', list)} />
          </Field>
          <Field label="Owner" sx={{ mb: 0 }}>
            <PersonPicker mode="user" label="Owner" value={ownerValue}
              onChange={(p) => setForm(f => ({ ...f, ownerEmail: p?.email || '', ownerName: p?.fullName || '', ownerUserId: p?.userId ?? '' }))} />
          </Field>
        </Box>
        <Field label="Responsible team" sx={{ mt: 2 }}>
          <Autocomplete multiple size="small" freeSolo options={departments}
            getOptionLabel={(o) => (typeof o === 'string' ? o : (o.name || ''))}
            isOptionEqualToValue={(o, v) => (typeof v === 'string' ? o.name === v : o.departmentId === v?.departmentId)}
            value={form.responsibleUnits}
            onChange={(_, val) => set('responsibleUnits', val)}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Search or type unit / department" />
            )} />
        </Field>

        <Accordion disableGutters elevation={0}
          sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Escalation</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {(level2Shown ? [1, 2] : [1]).map((n) => (
              <Box key={n} sx={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr', gap: 1, mb: 1.5 }}>
                <Field label="Escalate to" sx={{ mb: 0 }}>
                  <PersonPicker mode="user" label={`Level ${n} escalate to`} value={form[`level${n}Person`]}
                    onChange={p => set(`level${n}Person`, p)} />
                </Field>
                <Field label={`Level ${n}`} sx={{ mb: 0 }}>
                  <TextField fullWidth size="small" type="number" value={form[`level${n}AfterValue`]}
                    slotProps={{ htmlInput: { min: 0 } }}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {level2Shown ? (
                <Button size="small" variant="text" onClick={() => {
                  setLevel2Shown(false);
                  setForm(f => ({ ...f, level2AfterValue: '', level2Person: null }));
                }}>Remove level 2</Button>
              ) : (
                <Button size="small" variant="text" onClick={() => {
                  setLevel2Shown(true);
                  setForm(f => ({ ...f, level2AfterValue: EMPTY.level2AfterValue, level2Person: null }));
                }}>+ Add another level</Button>
              )}
              <Typography variant="caption" color="text.secondary">After the due date.</Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={saving || !form.returnName || (!form.actId && !(form.linkedObligationIds || []).length)}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create Return'}
        </Button>
      </DialogActions>

      {linksOpen && <LinkObligationsPicker open onClose={() => setLinksOpen(false)}
        initialIds={form.linkedObligationIds}
        onSave={(ids, selectedRows) => setForm(f => {
          const next = { ...f, linkedObligationIds: ids };
          // Derive the governing act from a linked obligation when it isn't chosen yet.
          if (!next.actId && selectedRows?.length) {
            const withAct = selectedRows.find(ob => ob.regulationId != null);
            if (withAct) next.actId = String(withAct.regulationId);
          }
          return next;
        })} />}
      {regulatorAddOpen && <RegulatorFormDialog open onClose={() => setRegulatorAddOpen(false)} onSaved={addRegulator} />}
    </Dialog>
  );
}