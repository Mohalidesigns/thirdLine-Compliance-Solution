import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Autocomplete, Chip,
} from '@mui/material';
import { LinkIcon } from 'shared';
import { api } from '../../services/api';
import MultiPersonPicker from '../common/MultiPersonPicker';
import LinkObligationsPicker from './LinkObligationsPicker';
import RegulatorFormDialog from './RegulatorFormDialog';

const EMPTY = {
  returnName: '', actId: '', filingRegulator: '', tenantRegulatorId: '', returnType: '', frequency: '',
  filingDate: '', deadlineKind: 'DATE', dueDaysAfterPeriodEnd: '', filingDeadlineOffsetDays: '', filingChannel: '',
  responsibleUnits: [], responsiblePersons: [],
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
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [regulators, setRegulators] = useState([]);
  const [acts, setActs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [linksOpen, setLinksOpen] = useState(false);
  const [regulatorAddOpen, setRegulatorAddOpen] = useState(false);

  const addRegulator = (created) => {
    setRegulatorAddOpen(false);
    if (!created) return;
    setRegulators(prev => [...prev, created]);
    set('filingRegulator', created.abbreviation || created.name || '');
    set('tenantRegulatorId', String(created.id ?? created.tenantRegulatorId));
  };

  useEffect(() => {
    if (open) { setForm({ ...EMPTY }); setError(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api.regulators.list().then(res => {
      const items = Array.isArray(res) ? res : (res.content || []);
      setRegulators(items);
    }).catch(() => setRegulators([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api.acts.list({ size: 1000 }).then(res => {
      const items = Array.isArray(res) ? res : (res.content || []);
      setActs(items);
    }).catch(() => setActs([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api.org.departments(true).then(res => {
      const items = Array.isArray(res) ? res : (res.content || []);
      setDepartments(items);
    }).catch(() => setDepartments([]));
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.returnName.trim()) { setError('Return name is required'); return; }
    if (!form.actId) { setError('Select the governing act'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      delete body.linkedObligationIds;
      body.actId = parseInt(form.actId, 10);
      if (body.filingDeadlineOffsetDays) body.filingDeadlineOffsetDays = parseInt(body.filingDeadlineOffsetDays, 10);
      else delete body.filingDeadlineOffsetDays;
      if (body.tenantRegulatorId) body.tenantRegulatorId = parseInt(body.tenantRegulatorId, 10);
      else delete body.tenantRegulatorId;

      body.responsibleUnits = (form.responsibleUnits || [])
        .map(u => (typeof u === 'string' ? u : (u.name || ''))).filter(Boolean);
      body.responsiblePersons = (form.responsiblePersons || [])
        .map(p => (p.fullName || p.email || '')).filter(Boolean);
      delete body.responsibleUnit;
      delete body.responsiblePerson;

      const firstPerson = (form.responsiblePersons || [])[0];
      if (firstPerson?.userId) body.returnOwnerUserId = parseInt(firstPerson.userId, 10);
      else delete body.returnOwnerUserId;
      body.returnOwnerName = firstPerson ? (firstPerson.fullName || firstPerson.email) : undefined;
      if (!body.returnOwnerName) delete body.returnOwnerName;

      if (form.deadlineKind === 'EVENT') {
        body.frequency = EVENT_DRIVEN;
        delete body.filingDate;
        delete body.dueDaysAfterPeriodEnd;
        delete body.ruleType;
      } else if (form.deadlineKind === 'OFFSET') {
        body.ruleType = 'OFFSET';
        delete body.filingDate;
        if (body.dueDaysAfterPeriodEnd) body.dueDaysAfterPeriodEnd = parseInt(body.dueDaysAfterPeriodEnd, 10);
        else delete body.dueDaysAfterPeriodEnd;
      } else {
        body.ruleType = 'DATE';
        delete body.dueDaysAfterPeriodEnd;
        if (!body.filingDate) delete body.filingDate;
      }
      delete body.deadlineKind;

      const created = await api.returns.create(body);
      if (form.linkedObligationIds?.length) {
        await api.returns.linkObligations(created, form.linkedObligationIds.map(Number));
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
        <Field label="Governing Act *">
          <Autocomplete size="small" options={acts}
            getOptionLabel={(o) => o.name || ''}
            isOptionEqualToValue={(o, v) => String(o.regulationId) === String(v.regulationId)}
            value={acts.find(a => String(a.regulationId) === String(form.actId)) || null}
            onChange={(_, val) => set('actId', val ? String(val.regulationId) : '')}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Search act or regulation" required error={!form.actId} />
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
              {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
          </Field>
          <Field label="Start preparing (days before due)" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" type="number" value={form.filingDeadlineOffsetDays}
              onChange={e => set('filingDeadlineOffsetDays', e.target.value)} />
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
        <Box sx={{ mt: 2 }}>
          <Field label="Filing Channel" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.filingChannel}
              onChange={e => set('filingChannel', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Responsible</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Responsible Units" sx={{ mb: 0 }}>
            <Autocomplete multiple size="small" freeSolo options={departments}
              getOptionLabel={(o) => (typeof o === 'string' ? o : (o.name || ''))}
              isOptionEqualToValue={(o, v) => (typeof v === 'string' ? o.name === v : o.departmentId === v?.departmentId)}
              value={form.responsibleUnits}
              onChange={(_, val) => set('responsibleUnits', val)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search or type unit / department" />
              )} />
          </Field>
          <Field label="Responsible Persons" sx={{ mb: 0 }}>
            <MultiPersonPicker label="Responsible persons" value={form.responsiblePersons}
              onChange={(list) => set('responsiblePersons', list)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Linked Obligations</Typography>
        <Field label="Obligations this return is filed to satisfy">
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.returnName || !form.actId}>
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