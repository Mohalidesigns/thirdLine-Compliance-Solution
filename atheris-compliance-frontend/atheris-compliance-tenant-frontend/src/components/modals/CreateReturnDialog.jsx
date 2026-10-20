import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Autocomplete, Chip,
} from '@mui/material';
import { LinkIcon } from 'shared';
import { api } from '../../services/api';
import PersonPicker from '../common/PersonPicker';
import LinkObligationsPicker from './LinkObligationsPicker';
import RegulatorFormDialog from './RegulatorFormDialog';

const EMPTY = {
  returnName: '', actId: '', filingRegulator: '', tenantRegulatorId: '', returnType: '', frequency: '',
  filingDate: '', filingDeadlineOffsetDays: '', filingChannel: '',
  returnOwnerUserId: '', returnOwnerName: '', returnOwnerEmail: '', responsibleUnit: '', responsiblePerson: '',
  linkedObligationIds: [],
};

const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'On event'];
const EVENT_DRIVEN = 'On event';
// Recurring frequencies that need a due rule; without one the return gets no periods.
const NEEDS_DUE_DATE = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial'];

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.returnName.trim()) { setError('Return name is required'); return; }
    if (!form.actId) { setError('Select the governing act'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      delete body.returnOwnerEmail;
      delete body.linkedObligationIds;
      body.actId = parseInt(form.actId, 10);
      if (body.filingDeadlineOffsetDays) body.filingDeadlineOffsetDays = parseInt(body.filingDeadlineOffsetDays, 10);
      if (body.returnOwnerUserId) body.returnOwnerUserId = parseInt(body.returnOwnerUserId, 10);
      else delete body.returnOwnerUserId;
      if (body.tenantRegulatorId) body.tenantRegulatorId = parseInt(body.tenantRegulatorId, 10);
      else delete body.tenantRegulatorId;
      if (!body.filingDate || body.frequency === EVENT_DRIVEN) delete body.filingDate;
      if (!body.responsibleUnit) delete body.responsibleUnit;
      if (!body.responsiblePerson) delete body.responsiblePerson;
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
            <TextField fullWidth size="small" value={form.returnType}
              onChange={e => set('returnType', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Filing schedule</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
          <Field label="Frequency" sx={{ mb: 0 }}>
            <TextField select fullWidth size="small" value={form.frequency}
              onChange={e => set('frequency', e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
          </Field>
          <Field label="First due date" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" type="date" value={form.frequency === EVENT_DRIVEN ? '' : form.filingDate}
              disabled={form.frequency === EVENT_DRIVEN}
              onChange={e => set('filingDate', e.target.value)}
              helperText={form.frequency === EVENT_DRIVEN
                ? 'Not used — on-event returns have no fixed cycle.'
                : 'Sets the filing cycle — e.g. Annual + 31 Mar is due every 31 March.'}
              slotProps={{ inputLabel: { shrink: true } }} />
          </Field>
          <Field label="Start preparing (days before due)" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" type="number" value={form.filingDeadlineOffsetDays}
              onChange={e => set('filingDeadlineOffsetDays', e.target.value)}
              helperText="Work opens this many days before the due date." />
          </Field>
        </Box>
        {NEEDS_DUE_DATE.includes(form.frequency) && !form.filingDate && (
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
          <Field label="Responsible Unit" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.responsibleUnit}
              onChange={e => set('responsibleUnit', e.target.value)} />
          </Field>
          <Field label="Responsible Person" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.responsiblePerson}
              onChange={e => set('responsiblePerson', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Owner</Typography>
        <Field label="Return Owner">
          <PersonPicker mode="user" label="Return owner"
            value={form.returnOwnerName ? { email: form.returnOwnerEmail || '', fullName: form.returnOwnerName, userId: form.returnOwnerUserId || null } : null}
            onChange={(u) => setForm(f => ({ ...f, returnOwnerName: u?.fullName || u?.email || '', returnOwnerUserId: u?.userId || '', returnOwnerEmail: u?.email || '' }))} />
        </Field>

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