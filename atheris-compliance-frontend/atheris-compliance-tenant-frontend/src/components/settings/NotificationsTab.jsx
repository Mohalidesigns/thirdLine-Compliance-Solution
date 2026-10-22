import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Alert, CircularProgress, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Chip, MenuItem, TextField, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Checkbox, FormControlLabel, Tooltip,
} from '@mui/material';
import { DataCard, StateBadge, PlusIcon, PencilSquareIcon, TrashIcon } from 'shared';
import { api } from '../../services/api';

const SUBJECT_TYPES = [
  { value: 'RETURN', label: 'Returns' },
  { value: 'CONTROL', label: 'Controls' },
];
const UNITS = [
  { value: 'DAYS', label: 'Days' },
  { value: 'HOURS', label: 'Hours' },
];
const TARGETS = [
  { value: 'ASSIGNEE', label: 'Responsible person' },
  { value: 'MANAGER', label: "Person's manager" },
  { value: 'MANAGER_OF_MANAGER', label: "Manager's manager" },
  { value: 'PERSON', label: 'A specific person' },
  { value: 'ROLE', label: 'Everyone in a role' },
];
const ROLES = ['TENANT_ADMIN', 'CCO', 'ANALYST', 'AUDITOR', 'IT_OPS'];

function defaultLevels() {
  return [
    { levelNo: 1, afterValue: 0, afterUnit: 'DAYS', targetType: 'ASSIGNEE' },
    { levelNo: 2, afterValue: 3, afterUnit: 'DAYS', targetType: 'MANAGER' },
    { levelNo: 3, afterValue: 7, afterUnit: 'DAYS', targetType: 'MANAGER_OF_MANAGER' },
  ];
}

function emptyPolicy() {
  return {
    name: '', subjectType: 'RETURN', isDefault: false, isActive: true, sendLink: true,
    notifyOnStart: false,
    reminderStartValue: 10, reminderStartUnit: 'DAYS',
    reminderRepeatValue: 2, reminderRepeatUnit: 'DAYS',
    levels: defaultLevels(),
  };
}

export default function NotificationsTab() {
  const qc = useQueryClient();
  const [policyEdit, setPolicyEdit] = useState(null);
  const [templateEdit, setTemplateEdit] = useState(null);
  const [error, setError] = useState('');

  const policiesQuery = useQuery({
    queryKey: ['escalation', 'policies'],
    queryFn: ({ signal }) => api.escalation.policies(null),
  });
  const templatesQuery = useQuery({
    queryKey: ['settings', 'notification-templates'],
    queryFn: ({ signal }) => api.settings.notificationTemplates({ signal }),
  });

  const savePolicy = useMutation({
    mutationFn: (p) => (p.policyId ? api.escalation.updatePolicy(p.policyId, p) : api.escalation.createPolicy(p)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalation', 'policies'] }); setPolicyEdit(null); },
    onError: (e) => setError(e.message),
  });
  const deletePolicy = useMutation({
    mutationFn: (id) => api.escalation.deletePolicy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation', 'policies'] }),
    onError: (e) => setError(e.message),
  });
  const saveTemplate = useMutation({
    mutationFn: ({ key, data }) => api.settings.updateNotificationTemplate(key, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'notification-templates'] }); setTemplateEdit(null); },
    onError: (e) => setError(e.message),
  });

  const policies = policiesQuery.data || [];
  const templates = templatesQuery.data || [];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <DataCard title="Escalation policies"
        actions={(
          <Button size="small" variant="contained" startIcon={<PlusIcon size={16} />}
            onClick={() => setPolicyEdit(emptyPolicy())}>New policy</Button>
        )}>
        {policiesQuery.isPending ? <CircularProgress size={22} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Applies to</TableCell>
                  <TableCell>Reminders</TableCell>
                  <TableCell>Levels</TableCell>
                  <TableCell sx={{ width: 96 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.policyId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.name}</Typography>
                      {p.isDefault && <Chip size="small" label="Default" sx={{ mt: 0.5 }} color="primary" variant="outlined" />}
                    </TableCell>
                    <TableCell>{SUBJECT_TYPES.find(s => s.value === p.subjectType)?.label || p.subjectType}</TableCell>
                    <TableCell>
                      {p.reminderStartValue != null
                        ? `${p.reminderStartValue} ${p.reminderStartUnit?.toLowerCase() || ''} before, repeat every ${p.reminderRepeatValue} ${p.reminderRepeatUnit?.toLowerCase() || ''}`
                        : '—'}
                    </TableCell>
                    <TableCell>{(p.levels || []).length}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setPolicyEdit({ ...p, levels: p.levels?.length ? p.levels : defaultLevels() })}>
                        <PencilSquareIcon size={16} />
                      </IconButton></Tooltip>
                      <Tooltip title="Delete"><span>
                        <IconButton size="small" disabled={p.isDefault} onClick={() => deletePolicy.mutate(p.policyId)}>
                          <TrashIcon size={16} />
                        </IconButton>
                      </span></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {policies.length === 0 && (
                  <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">No policies yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataCard>

      <DataCard title="Email templates" sx={{ mt: 3 }}>
        {templatesQuery.isPending ? <CircularProgress size={22} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell sx={{ width: 120 }}>Owner CC</TableCell>
                  <TableCell sx={{ width: 64 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.templateKey} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>{t.templateKey}</Typography>
                      {!t.isActive && <StateBadge value="Inactive" />}
                    </TableCell>
                    <TableCell>{t.subject}</TableCell>
                    <TableCell>{t.ccOwner ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setTemplateEdit({ ...t })}>
                        <PencilSquareIcon size={16} />
                      </IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataCard>

      {policyEdit && (
        <PolicyDialog value={policyEdit} saving={savePolicy.isPending}
          onClose={() => setPolicyEdit(null)} onSave={(p) => savePolicy.mutate(p)} />
      )}
      {templateEdit && (
        <TemplateDialog value={templateEdit} saving={saveTemplate.isPending}
          onClose={() => setTemplateEdit(null)}
          onSave={(data) => saveTemplate.mutate({ key: templateEdit.templateKey, data })} />
      )}
    </Box>
  );
}

function PolicyDialog({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState(value);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLevel = (i, k, v) => setForm(f => {
    const levels = [...f.levels];
    levels[i] = { ...levels[i], [k]: v };
    return { ...f, levels };
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{form.policyId ? 'Edit policy' : 'New policy'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.25 }}>
          <Grid size={{ xs: 8 }}>
            <TextField label="Name" fullWidth size="small" value={form.name}
              onChange={e => set('name', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField select label="Applies to" fullWidth size="small" value={form.subjectType}
              onChange={e => set('subjectType', e.target.value)}>
              {SUBJECT_TYPES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 6 }}>
            <TextField label="Start reminding before due" type="number" fullWidth size="small"
              value={form.reminderStartValue ?? ''} onChange={e => set('reminderStartValue', e.target.value === '' ? null : Number(e.target.value))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Unit" fullWidth size="small" value={form.reminderStartUnit || 'DAYS'}
              onChange={e => set('reminderStartUnit', e.target.value)}>
              {UNITS.map(u => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Repeat every" type="number" fullWidth size="small"
              value={form.reminderRepeatValue ?? ''} onChange={e => set('reminderRepeatValue', e.target.value === '' ? null : Number(e.target.value))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Repeat unit" fullWidth size="small" value={form.reminderRepeatUnit || 'DAYS'}
              onChange={e => set('reminderRepeatUnit', e.target.value)}>
              {UNITS.map(u => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Typography variant="overline" color="text.secondary">Escalation levels (after the due date)</Typography>
          </Grid>
          {(form.levels || []).map((l, i) => (
            <Grid size={{ xs: 12 }} key={i}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 1 }}>
                  <TextField label="Lvl" size="small" fullWidth value={l.levelNo} disabled />
                </Grid>
                <Grid size={{ xs: 2 }}>
                  <TextField label="After" type="number" size="small" fullWidth value={l.afterValue ?? 0}
                    onChange={e => setLevel(i, 'afterValue', e.target.value === '' ? 0 : Number(e.target.value))} />
                </Grid>
                <Grid size={{ xs: 2 }}>
                  <TextField select label="Unit" size="small" fullWidth value={l.afterUnit || 'DAYS'}
                    onChange={e => setLevel(i, 'afterUnit', e.target.value)}>
                    {UNITS.map(u => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <TextField select label="Notify" size="small" fullWidth value={l.targetType || 'ASSIGNEE'}
                    onChange={e => setLevel(i, 'targetType', e.target.value)}>
                    {TARGETS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </TextField>
                </Grid>
                {l.targetType === 'ROLE' && (
                  <Grid size={{ xs: 4 }}>
                    <TextField select label="Role" size="small" fullWidth value={l.targetRole || ''}
                      onChange={e => setLevel(i, 'targetRole', e.target.value)}>
                      {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </TextField>
                  </Grid>
                )}
                {l.targetType === 'PERSON' && (
                  <>
                    <Grid size={{ xs: 2 }}>
                      <TextField label="Name" size="small" fullWidth value={l.targetName || ''}
                        onChange={e => setLevel(i, 'targetName', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 2 }}>
                      <TextField label="Email" size="small" fullWidth value={l.targetEmail || ''}
                        onChange={e => setLevel(i, 'targetEmail', e.target.value)} />
                    </Grid>
                  </>
                )}
              </Grid>
            </Grid>
          ))}

          <Grid size={{ xs: 12 }}>
            <FormControlLabel control={<Checkbox checked={!!form.isDefault} onChange={e => set('isDefault', e.target.checked)} />}
              label="Default policy for this type" />
            <FormControlLabel control={<Checkbox checked={!!form.sendLink} onChange={e => set('sendLink', e.target.checked)} />}
              label="Include a filing link in reminders" />
            <FormControlLabel control={<Checkbox checked={!!form.notifyOnStart} onChange={e => set('notifyOnStart', e.target.checked)} />}
              label="Email the responsible person when the filing starts (data gathering)" />
            <FormControlLabel control={<Checkbox checked={form.isActive !== false} onChange={e => set('isActive', e.target.checked)} />}
              label="Active" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !form.name} onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TemplateDialog({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    subject: value.subject || '', body: value.body || '',
    ccOwner: value.ccOwner !== false, isActive: value.isActive !== false,
  });
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit template — {value.templateKey}</DialogTitle>
      <DialogContent>
        <TextField label="Subject" fullWidth size="small" sx={{ mt: 1, mb: 2 }}
          value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
        <TextField label="Body" fullWidth multiline minRows={8}
          value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Placeholders: {'{{returnName}} {{period}} {{dueDate}} {{daysLeft}} {{daysLate}} {{level}} {{regulator}} {{actName}} {{controlName}} {{recipientName}} {{link}}'}
        </Typography>
        <FormControlLabel sx={{ mt: 1 }}
          control={<Checkbox checked={form.ccOwner} onChange={e => setForm(f => ({ ...f, ccOwner: e.target.checked }))} />}
          label="CC the owner / analyst" />
        <FormControlLabel
          control={<Checkbox checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />}
          label="Active" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving} onClick={() => onSave(form)}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}
