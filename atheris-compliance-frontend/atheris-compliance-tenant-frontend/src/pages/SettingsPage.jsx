import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, CardHeader, TextField, Button, Alert,
  CircularProgress, Divider, Tabs, Tab, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, Chip, MenuItem, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tooltip,
} from '@mui/material';
import {
  Add, Edit, Delete, PersonAdd, AccountBalance, Group, Person,
} from '@mui/icons-material';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { QuickAddDepartmentDialog, QuickAddTeamDialog } from '../components/org/QuickAddDialogs';

const ROLE_OPTIONS = ['TENANT_ADMIN', 'CCO', 'ANALYST'];

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const { user } = useAuth();
  const isAdmin = user?.role === 'TENANT_ADMIN';

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your compliance workspace
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="General" />
        <Tab label="Organization" />
        {(isAdmin || user?.role === 'CCO') && <Tab label="System Users" />}
      </Tabs>

      {tab === 0 && <GeneralTab />}
      {tab === 1 && <OrganizationTab isAdmin={isAdmin} />}
      {tab === 2 && <SystemUsersTab isAdmin={isAdmin} />}
    </Box>
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

      <Card sx={{ maxWidth: 600, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Polling Configuration</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How often to check the central platform for newly classified instruments
          </Typography>
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
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage your account settings
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Contact your platform administrator for account changes, user management, and billing.
          </Typography>
        </CardContent>
      </Card>
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
          <Typography variant="h6">Departments &amp; Teams</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your organizational hierarchy and compliance owners
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setDeptModal({})}>
            Add Department
          </Button>
        )}
      </Box>

      {snackbar && <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ mb: 2 }}>{snackbar.message}</Alert>}

      {(!tree || tree.departments.length === 0) && (
        <Card><CardContent sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          <AccountBalance sx={{ fontSize: 48, mb: 1, color: 'action.disabled' }} />
          <Typography>No departments yet</Typography>
        </CardContent></Card>
      )}

      {tree?.departments.map(dept => (
        <Card key={dept.department.departmentId} sx={{ mb: 2 }}>
          <CardHeader
            avatar={<AccountBalance />}
            title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{dept.department.name}</Typography>
              {dept.department.isActive === false && <Chip size="small" label="Inactive" color="default" />}
            </Box>}
            subheader={
              <Typography variant="caption" color="text.secondary">
                {dept.department.teamCount ?? dept.teams.length} team(s) Â·
                {dept.department.ownerCount ?? dept.teams.reduce((s, t) => s + t.owners.length, 0)} owner(s)
                {dept.department.headOwnerName ? ` Â· Head: ${dept.department.headOwnerName}` : ''}
              </Typography>
            }
            action={isAdmin && (
              <Box>
                <IconButton size="small" onClick={() => setDeptModal(dept.department)}><Edit fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => handleDelete(() => api.org.deleteDepartment(dept.department.departmentId), 'Department')}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            )}
          />
          <CardContent sx={{ pt: 0 }}>
            {dept.teams.map(team => (
              <Box key={team.team.teamId} sx={{ pl: 4, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Group fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{team.team.name}</Typography>
                  {team.team.isActive === false && <Chip size="small" label="Inactive" color="default" />}
                  <Typography variant="caption" color="text.secondary">Â· {team.owners.length} owner(s)</Typography>
                  {isAdmin && (
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton size="small" onClick={() => setTeamModal({ team: team.team, departmentId: dept.department.departmentId })}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(() => api.org.deleteTeam(team.team.teamId), 'Team')}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                {team.owners.map(owner => (
                  <Box key={owner.ownerId} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4 }}>
                    <Person fontSize="small" color="action" />
                    <Typography variant="body2">{owner.fullName}</Typography>
                    {owner.jobTitle && <Typography variant="caption" color="text.secondary">Â· {owner.jobTitle}</Typography>}
                    {owner.email && <Typography variant="caption" color="text.secondary">Â· {owner.email}</Typography>}
                    {owner.isActive === false && <Chip size="small" label="Inactive" color="default" />}
                    {isAdmin && (
                      <Box sx={{ ml: 'auto' }}>
                        <IconButton size="small" onClick={() => setOwnerModal({ owner, teamId: team.team.teamId, departmentId: dept.department.departmentId })}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(() => api.org.deleteOwner(owner.ownerId), 'Owner')}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                ))}
                {team.owners.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>No owners in this team</Typography>
                )}
                {isAdmin && (
                  <Button size="small" startIcon={<Add />} sx={{ pl: 4, mt: 0.5 }}
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
              <Button size="small" startIcon={<Add />} sx={{ pl: 4 }}
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
          <Grid item xs={12}>
            <TextField label="Name" fullWidth size="small" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
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
          <Grid item xs={12}>
            <TextField select label="Department" fullWidth size="small" required value={form.departmentId}
              onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
              {departments.map(d => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
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
            <Button size="small" startIcon={<Add />} sx={{ whiteSpace: 'nowrap' }}
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
            <Button size="small" startIcon={<Add />} sx={{ whiteSpace: 'nowrap' }} disabled={!form.departmentId}
              onClick={() => setTeamOpen(true)}>
              {departmentTeams.length === 0 ? 'Add team' : 'Add new team'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
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
          <Typography variant="h6">System Users</Typography>
          <Typography variant="body2" color="text.secondary">
            Operators with access to this tenant workspace
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setInviteOpen(true)}>
            Invite User
          </Button>
        )}
      </Box>

      <Card>
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.userId} hover>
                  <TableCell>
                    {u.fullName}
                    {u.jobTitle && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{u.jobTitle}</Typography>}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
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
                    <Chip size="small" color={u.isActive ? 'success' : 'default'}
                      label={u.isActive ? (u.inviteStatus === 'pending' ? 'Pending' : 'Active') : 'Inactive'} />
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
          <Grid item xs={12}>
            <TextField label="Email" fullWidth size="small" type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Full name" fullWidth size="small" required value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Job title" fullWidth size="small" value={form.jobTitle}
              onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Department" fullWidth size="small" value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
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
