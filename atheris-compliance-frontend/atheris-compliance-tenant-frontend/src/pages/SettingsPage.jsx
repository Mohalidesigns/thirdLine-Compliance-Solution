import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, TextField, Button, Alert,
  CircularProgress, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Chip, MenuItem, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
} from '@mui/material';
import {
  PageHeader, SectionTabs, DataCard, StateBadge, TL,
  PlusIcon, PencilSquareIcon, TrashIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import OrganizationTab from '../components/org/OrganizationTab';
import PersonPicker from '../components/common/PersonPicker';
import SmtpSettingsForm from '../components/settings/SmtpSettingsForm';
import NotificationsTab from '../components/settings/NotificationsTab';
import TemplatesTab from '../components/settings/TemplatesTab';
import ThemesTab from '../components/settings/ThemesTab';
import ComplianceSettingsTab from '../components/settings/ComplianceSettingsTab';

const ROLE_OPTIONS = ['TENANT_ADMIN', 'CCO', 'ANALYST', 'AUDITOR', 'IT_OPS',
  'CONTROL_TEST_REVIEWER', 'FINDINGS_REVIEW', 'RETURNS_REVIEWER', 'RUNBOOK_APPROVER'];

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const { user } = useAuth();
  const isAdmin = user?.role === 'TENANT_ADMIN';
  const canManageWorkspace = isAdmin || user?.role === 'CCO';

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Configure your compliance workspace" />

      <SectionTabs
        value={tab}
        onChange={setTab}
        sx={{ mb: 3 }}
        tabs={[
          { key: 0, label: 'General' },
          { key: 1, label: 'Organization' },
          ...(canManageWorkspace ? [
            { key: 2, label: 'Federal Public Holidays' },
            { key: 3, label: 'System Users' },
          ] : []),
          { key: 4, label: 'Email / SMTP' },
          { key: 5, label: 'Notifications' },
          { key: 6, label: 'Email Templates' },
          { key: 7, label: 'Themes' },
          { key: 8, label: 'Compliance' },
        ]}
      />

      {tab === 0 && <GeneralTab canEdit={isAdmin || user?.role === 'CCO'} />}
      {tab === 1 && <OrganizationTab />}
      {tab === 2 && canManageWorkspace && <FederalHolidaysTab />}
      {tab === 3 && canManageWorkspace && <SystemUsersTab isAdmin={isAdmin} />}
      {tab === 4 && <SmtpTab />}
      {tab === 5 && <NotificationsTab />}
      {tab === 6 && <TemplatesTab />}
      {tab === 7 && <ThemesTab />}
      {tab === 8 && <ComplianceSettingsTab />}
    </Box>
  );
}

/* ------------------------------------------------------------------ Email / SMTP */

function SmtpTab() {
  const query = useQuery({
    queryKey: ['settings', 'smtp'],
    queryFn: ({ signal }) => api.settings.smtp({ signal }),
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => api.settings.saveSmtp(data),
  });

  if (query.isPending) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (query.isError) return <Alert severity="error">{query.error.message}</Alert>;

  return (
    <Card sx={{ maxWidth: 720 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>Email / SMTP</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Outbound email for notifications and remediation links, sent from your own domain.
        </Typography>
        <SmtpSettingsForm
          load={() => query.data}
          passwordSet={!!query.data?.passwordSet}
          onSave={saveMutation.mutateAsync}
          onTest={api.settings.testSmtp}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ General */

function GeneralTab({ canEdit }) {
  const [interval, setInterval] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.settings.polling()
      .then(data => setInterval(data.pollingIntervalMinutes || 5))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (interval < 1) { setError('Interval must be at least 1 minute'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.settings.updatePolling({ pollingIntervalMinutes: Number(interval) });
      setSuccess('Polling interval updated');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DataCard
        title="Polling Configuration"
        subtitle="How often to check the central platform for newly classified instruments"
        sx={{ maxWidth: 600, mb: 3 }}
      >
          <TextField
            fullWidth size="small" type="number"
            label="Polling Interval (minutes)"
            value={interval}
            onChange={e => setInterval(e.target.value)}
            inputProps={{ min: 1, max: 1440 }}
            sx={{ mb: 2 }}
            helperText="Minimum: 1 minute, Maximum: 1440 minutes (24 hours)"
          />
          {canEdit && (
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save Interval'}
            </Button>
          )}
      </DataCard>

      <DataCard title="Account" subtitle="Manage your account settings" sx={{ maxWidth: 600 }}>
        <Typography sx={{ fontSize: '0.875rem', color: TL.gray600 }}>
          Contact your platform administrator for account changes, user management, and billing.
        </Typography>
      </DataCard>
    </Box>
  );
}

function FederalHolidaysTab() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState('All');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ holidayDate: '', observedDate: '', name: '' });
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['federal-public-holidays', year],
    queryFn: ({ signal }) => api.federalPublicHolidays.list(year, { signal }),
  });
  const saveMutation = useMutation({
    mutationFn: () => dialog?.holidayId
      ? api.federalPublicHolidays.update(dialog.holidayId, form)
      : api.federalPublicHolidays.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['federal-public-holidays'] });
      setDialog(null);
    },
    onError: (e) => setError(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.federalPublicHolidays.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['federal-public-holidays'] }),
    onError: (e) => setError(e.message),
  });

  function openHoliday(holiday = null) {
    setError('');
    setForm({
      holidayDate: holiday?.holidayDate || '',
      observedDate: holiday?.observedDate || '',
      name: holiday?.name || '',
    });
    setDialog(holiday || {});
  }

  function save() {
    setError('');
    if (!form.holidayDate || !form.name.trim()) {
      setError('Holiday date and name are required.');
      return;
    }
    if (form.observedDate && form.observedDate < form.holidayDate) {
      setError('Observed date must be on or after the official holiday date.');
      return;
    }
    if (form.observedDate && form.observedDate === form.holidayDate) {
      setError('Leave the observed date blank when the holiday is observed on its official date.');
      return;
    }
    saveMutation.mutate();
  }

  const holidays = query.data || [];
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>Federal Public Holidays</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Maintain officially announced Nigerian federal holidays. Dates are used for working-day deadline calculations.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField select size="small" label="Year" value={year} onChange={e => setYear(e.target.value)} sx={{ width: 130 }}>
          <MenuItem value="All">All years</MenuItem>
          {Array.from({ length: 9 }, (_, i) => currentYear - 2 + i).map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
          </TextField>
          <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => openHoliday()}>Add Holiday</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {query.isError && <Alert severity="error" sx={{ mb: 2 }}>{query.error.message || 'Failed to load holidays.'}</Alert>}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Holiday</TableCell>
                <TableCell>Official date</TableCell>
                <TableCell>Observed date</TableCell>
                <TableCell>Jurisdiction</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.isPending ? (
                <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} sx={{ my: 2 }} /></TableCell></TableRow>
              ) : holidays.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No holidays recorded {year === 'All' ? '' : `for ${year}`}.</TableCell></TableRow>
              ) : holidays.map(h => (
                <TableRow key={h.holidayId} hover>
                  <TableCell>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{h.name}</Typography>
                  </TableCell>
                  <TableCell>{h.holidayDate}</TableCell>
                  <TableCell>{h.observedDate || '—'}</TableCell>
                  <TableCell><StateBadge value="Federal" label="Federal" /></TableCell>
                  <TableCell align="right">
                    <IconButton aria-label={`Edit ${h.name}`} size="small" onClick={() => openHoliday(h)}><PencilSquareIcon size={16} /></IconButton>
                    <IconButton aria-label={`Delete ${h.name}`} size="small" color="error"
                      onClick={() => { if (window.confirm(`Delete ${h.name} (${h.holidayDate})?`)) deleteMutation.mutate(h.holidayId); }}>
                      <TrashIcon size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialog != null} onClose={() => !saveMutation.isPending && setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.holidayId ? 'Edit Federal Public Holiday' : 'Add Federal Public Holiday'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Holiday name" required size="small" fullWidth value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} inputProps={{ maxLength: 200 }} />
            <TextField label="Official holiday date" required type="date" size="small" fullWidth
              value={form.holidayDate} onChange={e => setForm(f => ({ ...f, holidayDate: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
            <TextField label="Observed date (if officially announced)" type="date" size="small" fullWidth
              value={form.observedDate} onChange={e => setForm(f => ({ ...f, observedDate: e.target.value }))}
              InputLabelProps={{ shrink: true }} helperText="Leave blank if the holiday is observed on its official date." />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={saveMutation.isPending}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <CircularProgress size={18} /> : 'Save holiday'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ------------------------------------------------------------- System Users */

function SystemUsersTab({ isAdmin }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    // deactivated users and pending invites are listed too, so an admin can see and reactivate them
    api.users.list(undefined, { includeInactive: true })
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRole = async (u, role) => {
    try { await api.users.updateRole(u.userId, role); load(); }
    catch (e) { setError(e.message); }
  };

  const handleManager = async (u, managerUserId) => {
    try { await api.users.updateManager(u.userId, managerUserId || null); load(); }
    catch (e) { setError(e.message); }
  };

  const handleToggleActive = async (u) => {
    try {
      if (u.isActive) await api.users.deactivate(u.userId);
      else await api.users.reactivate(u.userId);
      load();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" onClose={() => setError('')} sx={{ maxWidth: 600 }}>{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>System Users</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Operators with access to this tenant workspace
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setInviteOpen(true)}>
            Invite User
          </Button>
        )}
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Manager</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.userId} hover>
                  <TableCell>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{u.fullName}</Typography>
                    <Typography sx={{ display: 'block', fontSize: '0.75rem', color: TL.gray500 }}>
                      {[u.email, u.jobTitle].filter(Boolean).join(' · ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <TextField select size="small" value={u.role}
                        onChange={e => handleRole(u, e.target.value)}
                        sx={{ minWidth: 140 }}>
                        {ROLE_OPTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                      </TextField>
                    ) : <Chip size="small" label={u.role} />}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <TextField select size="small" value={u.managerUserId ?? ''}
                        onChange={e => handleManager(u, e.target.value)}
                        sx={{ minWidth: 160 }}>
                        <MenuItem value="">— None —</MenuItem>
                        {users.filter(m => m.userId !== u.userId).map(m => (
                          <MenuItem key={m.userId} value={m.userId}>{m.fullName}</MenuItem>
                        ))}
                      </TextField>
                    ) : (u.managerName || '—')}
                  </TableCell>
                  <TableCell>
                    <StateBadge value={u.isActive ? (u.inviteStatus === 'pending' ? 'Pending' : 'Active') : 'Inactive'} />
                  </TableCell>
                  <TableCell align="right">
                    {isAdmin && u.userId !== me?.userId && (
                      <Tooltip title={u.isActive ? 'Deactivate' : 'Reactivate'}>
                        <Button size="small" color={u.isActive ? 'error' : 'primary'} onClick={() => handleToggleActive(u)}>
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)}
        onSaved={() => { setInviteOpen(false); load(); }} onError={setError} />
    </Box>
  );
}

function InviteUserDialog({ open, onClose, onSaved, onError }) {
  const [person, setPerson] = useState(null);
  const [form, setForm] = useState({ jobTitle: '', department: '', role: 'ANALYST' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setPerson(null); setForm({ jobTitle: '', department: '', role: 'ANALYST' }); setError(''); }
  }, [open]);

  const email = person?.email || '';
  const fullName = person?.fullName || '';
  const canSave = !!email.trim() && !!fullName.trim();

  const handleSave = async () => {
    if (!canSave) { setError('Pick a directory user or enter an email and name.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { email: email.trim(), fullName: fullName.trim(), role: form.role };
      if (form.jobTitle.trim()) body.jobTitle = form.jobTitle.trim();
      if (form.department.trim()) body.department = form.department.trim();
      await api.users.invite(body);
      onSaved();
    } catch (e) { setError(e.message); onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <PersonPicker mode="user" label="User" value={person} onChange={setPerson} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Job title" fullWidth size="small" value={form.jobTitle}
              onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Department" fullWidth size="small" value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField select label="Role" fullWidth size="small" required value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLE_OPTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          </Grid>
          {error && <Grid size={{ xs: 12 }}><Alert severity="error">{error}</Alert></Grid>}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? 'Inviting...' : 'Send Invite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
