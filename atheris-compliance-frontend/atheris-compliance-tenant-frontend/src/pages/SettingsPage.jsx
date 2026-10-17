import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, CardHeader, TextField, Button, Alert,
  CircularProgress, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Chip, MenuItem, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
} from '@mui/material';
import {
  PageHeader, SectionTabs, DataCard, StateBadge, TL,
  PlusIcon, PencilSquareIcon, TrashIcon, BuildingLibraryIcon, UserGroupIcon, UserCircleIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { QuickAddDepartmentDialog, QuickAddTeamDialog } from '../components/org/QuickAddDialogs';
import SmtpSettingsForm from '../components/settings/SmtpSettingsForm';

const ROLE_OPTIONS = ['TENANT_ADMIN', 'CCO', 'ANALYST', 'AUDITOR', 'IT_OPS'];

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
            { key: 4, label: 'Email / SMTP' },
          ] : []),
        ]}
      />

      {tab === 0 && <GeneralTab />}
      {tab === 1 && <OrganizationTab isAdmin={isAdmin} />}
      {tab === 2 && canManageWorkspace && <FederalHolidaysTab />}
      {tab === 3 && canManageWorkspace && <SystemUsersTab isAdmin={isAdmin} />}
      {tab === 4 && canManageWorkspace && <SmtpTab />}
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

function GeneralTab() {
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
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save Interval'}
          </Button>
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

/* -------------------------------------------------------------- Organization */

function OrganizationTab({ isAdmin }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState(null);
  const [deptModal, setDeptModal] = useState(null);       // { department } or { }
  const [teamModal, setTeamModal] = useState(null);       // { team, departmentId } or { departmentId }
  const [ownerModal, setOwnerModal] = useState(null);     // { owner, teamId, departmentId } or { teamId, departmentId }

  const loadTree = useCallback(() => {
    setLoading(true);
    api.org.tree()
      .then(setTree)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const handleDelete = async (fn, label) => {
    try {
      await fn();
      setSnackbar({ severity: 'success', message: `${label} deleted` });
      loadTree();
    } catch (e) { setSnackbar({ severity: 'error', message: e.message }); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ maxWidth: 600 }}>{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>Departments &amp; Teams</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Manage your organizational hierarchy and compliance owners
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setDeptModal({})}>
            Add Department
          </Button>
        )}
      </Box>

      {snackbar && <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ mb: 2 }}>{snackbar.message}</Alert>}

      {(!tree || tree.departments.length === 0) && (
        <Card><CardContent sx={{ textAlign: 'center', py: 6, color: TL.gray500 }}>
          <BuildingLibraryIcon size={40} sx={{ mb: 1, color: TL.gray300 }} />
          <Typography sx={{ fontSize: '0.875rem' }}>No departments yet</Typography>
        </CardContent></Card>
      )}

      {tree?.departments.map(dept => (
        <Card key={dept.department.departmentId} sx={{ mb: 2 }}>
          <CardHeader
            avatar={(
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#EFF6FF', color: TL.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BuildingLibraryIcon size={16} />
              </Box>
            )}
            title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TL.gray800 }}>{dept.department.name}</Typography>
              {dept.department.isActive === false && <StateBadge value="Inactive" />}
            </Box>}
            subheader={
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                {dept.department.teamCount ?? dept.teams.length} team(s) ·
                {dept.department.ownerCount ?? dept.teams.reduce((s, t) => s + t.owners.length, 0)} owner(s)
                {dept.department.headOwnerName ? ` · Head: ${dept.department.headOwnerName}` : ''}
              </Typography>
            }
            action={isAdmin && (
              <Box>
                <Tooltip title="Edit"><IconButton size="small" onClick={() => setDeptModal(dept.department)}><PencilSquareIcon size={16} /></IconButton></Tooltip>
                <IconButton size="small" onClick={() => handleDelete(() => api.org.deleteDepartment(dept.department.departmentId), 'Department')}>
                  <TrashIcon size={16} />
                </IconButton>
              </Box>
            )}
          />
          <CardContent sx={{ pt: 0 }}>
            {dept.teams.map(team => (
              <Box key={team.team.teamId} sx={{ pl: 4, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <UserGroupIcon size={16} sx={{ color: TL.gray400 }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>{team.team.name}</Typography>
                  {team.team.isActive === false && <StateBadge value="Inactive" />}
                  <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>· {team.owners.length} owner(s)</Typography>
                  {isAdmin && (
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton size="small" onClick={() => setTeamModal({ team: team.team, departmentId: dept.department.departmentId })}>
                        <PencilSquareIcon size={16} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(() => api.org.deleteTeam(team.team.teamId), 'Team')}>
                        <TrashIcon size={16} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                {team.owners.map(owner => (
                  <Box key={owner.ownerId} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4 }}>
                    <UserCircleIcon size={16} sx={{ color: TL.gray400 }} />
                    <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{owner.fullName}</Typography>
                    {owner.jobTitle && <Typography variant="caption" color="text.secondary">· {owner.jobTitle}</Typography>}
                    {owner.email && <Typography variant="caption" color="text.secondary">· {owner.email}</Typography>}
                    {owner.isActive === false && <StateBadge value="Inactive" />}
                    {isAdmin && (
                      <Box sx={{ ml: 'auto' }}>
                        <IconButton size="small" onClick={() => setOwnerModal({ owner, teamId: team.team.teamId, departmentId: dept.department.departmentId })}>
                          <PencilSquareIcon size={16} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(() => api.org.deleteOwner(owner.ownerId), 'Owner')}>
                          <TrashIcon size={16} />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                ))}
                {team.owners.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>No owners in this team</Typography>
                )}
                {isAdmin && (
                  <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ pl: 4, mt: 0.5 }}
                    onClick={() => setOwnerModal({ teamId: team.team.teamId, departmentId: dept.department.departmentId })}>
                    Add owner
                  </Button>
                )}
              </Box>
            ))}
            {dept.teams.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>No teams in this department</Typography>
            )}
            {isAdmin && (
              <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ pl: 4 }}
                onClick={() => setTeamModal({ departmentId: dept.department.departmentId })}>
                Add team
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {deptModal && (
        <DepartmentDialog open={!!deptModal} onClose={() => setDeptModal(null)}
          initial={deptModal.departmentId ? deptModal : {}}
          onSaved={() => { setDeptModal(null); setSnackbar({ severity: 'success', message: 'Department saved' }); loadTree(); }}
          onError={e => setSnackbar({ severity: 'error', message: e.message })} isAdmin={isAdmin} />
      )}
      {teamModal && (
        <TeamDialog open={!!teamModal} onClose={() => setTeamModal(null)} initial={teamModal}
          onSaved={() => { setTeamModal(null); setSnackbar({ severity: 'success', message: 'Team saved' }); loadTree(); }}
          onError={e => setSnackbar({ severity: 'error', message: e.message })} isAdmin={isAdmin} />
      )}
      {ownerModal && (
        <OwnerDialog open={!!ownerModal} onClose={() => setOwnerModal(null)} initial={ownerModal}
          onSaved={() => { setOwnerModal(null); setSnackbar({ severity: 'success', message: 'Owner saved' }); loadTree(); }}
          onError={e => setSnackbar({ severity: 'error', message: e.message })} isAdmin={isAdmin} />
      )}
    </Box>
  );
}

function DepartmentDialog({ open, onClose, initial, onSaved, onError, isAdmin }) {
  const [form, setForm] = useState({ name: '', headOwnerId: '' });
  const [owners, setOwners] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial.name || '',
        headOwnerId: initial.headOwnerId?.toString() || '',
      });
      api.org.owners().then(setOwners).catch(() => {});
    }
  }, [open, initial]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { name: form.name.trim() };
      if (form.headOwnerId) body.headOwnerId = Number(form.headOwnerId);
      if (initial.departmentId) await api.org.updateDepartment(initial.departmentId, body);
      else await api.org.createDepartment(body);
      onSaved();
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial.departmentId ? 'Edit Department' : 'Add Department'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField label="Name" fullWidth size="small" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField select label="Department head (owner)" fullWidth size="small" value={form.headOwnerId}
              onChange={e => setForm(f => ({ ...f, headOwnerId: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              {owners.map(o => <MenuItem key={o.ownerId} value={String(o.ownerId)}>{o.fullName}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !isAdmin}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TeamDialog({ open, onClose, initial, onSaved, onError, isAdmin }) {
  const [form, setForm] = useState({ name: '', departmentId: '' });
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: initial.team?.name || '', departmentId: initial.departmentId?.toString() || '' });
      api.org.departments(false).then(setDepartments).catch(() => {});
    }
  }, [open, initial]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { name: form.name.trim(), departmentId: Number(form.departmentId) };
      if (initial.team?.teamId) await api.org.updateTeam(initial.team.teamId, body);
      else await api.org.createTeam(body);
      onSaved();
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial.team?.teamId ? 'Edit Team' : 'Add Team'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField select label="Department" fullWidth size="small" required value={form.departmentId}
              onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
              {departments.map(d => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Team name" fullWidth size="small" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.departmentId || !isAdmin}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OwnerDialog({ open, onClose, initial, onSaved, onError, isAdmin }) {
  const [form, setForm] = useState({ fullName: '', email: '', jobTitle: '', teamId: '', departmentId: '' });
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        fullName: initial.owner?.fullName || '', email: initial.owner?.email || '',
        jobTitle: initial.owner?.jobTitle || '', teamId: initial.owner?.teamId?.toString() || initial.teamId?.toString() || '',
        departmentId: initial.owner?.departmentId?.toString() || initial.departmentId?.toString() || '',
      });
      api.org.departments(false).then(setDepartments).catch(() => {});
      api.org.teams().then(setTeams).catch(() => {});
    }
  }, [open, initial]);

  const departmentTeams = form.departmentId
    ? teams.filter(t => t.departmentId === Number(form.departmentId))
    : teams;

  const reload = () => {
    api.org.departments(false).then(setDepartments).catch(() => {});
    api.org.teams().then(setTeams).catch(() => {});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { fullName: form.fullName.trim() };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.jobTitle.trim()) body.jobTitle = form.jobTitle.trim();
      if (form.departmentId) body.departmentId = Number(form.departmentId);
      if (form.teamId) body.teamId = Number(form.teamId);
      if (initial.owner?.ownerId) await api.org.updateOwner(initial.owner.ownerId, body);
      else await api.org.createOwner(body);
      onSaved();
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial.owner?.ownerId ? 'Edit Owner' : 'Add Owner'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Full name" fullWidth size="small" required value={form.fullName}
            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          <TextField label="Email" fullWidth size="small" type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <TextField label="Job title" fullWidth size="small" value={form.jobTitle}
            onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Department" fullWidth size="small" value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, teamId: '' }))}>
                {form.departmentId !== '' && <MenuItem value="">None</MenuItem>}
                {departments.map(d => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
                {departments.length === 0 && <MenuItem value="" disabled>No departments yet</MenuItem>}
              </TextField>
            </Box>
            <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap' }}
              onClick={() => setDeptOpen(true)}>
              {departments.length === 0 ? 'Add department' : 'Add new department'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Team" fullWidth size="small" value={form.teamId}
                onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                {form.teamId !== '' && <MenuItem value="">None</MenuItem>}
                {departmentTeams.map(t => <MenuItem key={t.teamId} value={String(t.teamId)}>{t.name}</MenuItem>)}
                {departmentTeams.length === 0 && (
                  <MenuItem value="" disabled>
                    {form.departmentId ? 'No teams in this department' : 'Select a department first'}
                  </MenuItem>
                )}
              </TextField>
            </Box>
            <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap' }} disabled={!form.departmentId}
              onClick={() => setTeamOpen(true)}>
              {departmentTeams.length === 0 ? 'Add team' : 'Add new team'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.fullName.trim() || !isAdmin}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>

      <QuickAddDepartmentDialog open={deptOpen} onClose={() => setDeptOpen(false)}
        onCreated={(d) => { reload(); setForm(f => ({ ...f, departmentId: String(d.departmentId), teamId: '' })); setDeptOpen(false); }} />
      <QuickAddTeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} departmentId={form.departmentId}
        onCreated={(t) => { reload(); setForm(f => ({ ...f, teamId: String(t.teamId) })); setTeamOpen(false); }} />
    </Dialog>
  );
}

/* ------------------------------------------------------------- System Users */

function SystemUsersTab({ isAdmin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.users.list()
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
                    {isAdmin && (
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
  const [form, setForm] = useState({ email: '', fullName: '', jobTitle: '', department: '', role: 'ANALYST' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ email: '', fullName: '', jobTitle: '', department: '', role: 'ANALYST' });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { email: form.email.trim(), fullName: form.fullName.trim(), role: form.role };
      if (form.jobTitle.trim()) body.jobTitle = form.jobTitle.trim();
      if (form.department.trim()) body.department = form.department.trim();
      await api.users.invite(body);
      onSaved();
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField label="Email" fullWidth size="small" type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Full name" fullWidth size="small" required value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
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
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.email.trim() || !form.fullName.trim()}>
          {saving ? 'Inviting...' : 'Send Invite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
