import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Button, Alert, CircularProgress, Chip,
  TextField, MenuItem, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Snackbar, Autocomplete,
} from '@mui/material';
import {
  TL, StateBadge, PlusIcon, PencilSquareIcon, TrashIcon,
  BuildingOffice2Icon, UserGroupIcon, UserCircleIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { QuickAddOwnerDialog } from '../common/PersonPicker';
import { QuickAddDepartmentDialog, QuickAddTeamDialog } from './QuickAddDialogs';
import StakeholdersPanel from './StakeholdersPanel';

const CHART_SX = {
  overflowX: 'auto',
  pb: 2,
  '& ul': {
    display: 'flex', justifyContent: 'center', position: 'relative',
    m: 0, p: 0, listStyle: 'none', pt: '20px',
  },
  '& > ul': { pt: 0 },
  '& li': { listStyle: 'none', position: 'relative', textAlign: 'center', pt: '20px', px: '8px' },
  '& li::before, & li::after': {
    content: '""', position: 'absolute', top: 0, right: '50%',
    borderTop: `2px solid ${TL.gray200}`, width: '50%', height: '20px',
  },
  '& li::after': { right: 'auto', left: '50%', borderLeft: `2px solid ${TL.gray200}` },
  '& li:only-child::before, & li:only-child::after': { display: 'none' },
  '& li:only-child': { pt: 0 },
  '& li:first-child::before, & li:last-child::after': { border: 0 },
  '& li:last-child::before': { borderRight: `2px solid ${TL.gray200}`, borderRadius: '0 6px 0 0' },
  '& li:first-child::after': { borderRadius: '6px 0 0 0' },
  '& ul ul::before': {
    content: '""', position: 'absolute', top: 0, left: '50%',
    borderLeft: `2px solid ${TL.gray200}`, width: 0, height: '20px',
  },
};

export default function OrganizationTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'TENANT_ADMIN';
  const canAddStructure = isAdmin || role === 'CCO' || role === 'ANALYST';
  const canAddMember = isAdmin || role === 'CCO' || role === 'ANALYST';

  const [snack, setSnack] = useState(null);
  const [deptModal, setDeptModal] = useState(null);
  const [teamModal, setTeamModal] = useState(null);
  const [ownerModal, setOwnerModal] = useState(null);
  const [addMemberTo, setAddMemberTo] = useState(null);

  const treeQuery = useQuery({ queryKey: ['org', 'tree'], queryFn: () => api.org.tree() });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['org', 'tree'] });
    qc.invalidateQueries({ queryKey: ['org', 'owners'] });
    qc.invalidateQueries({ queryKey: ['org', 'departments'] });
    qc.invalidateQueries({ queryKey: ['org', 'teams'] });
  };

  const deleteMutation = useMutation({
    mutationFn: ({ fn }) => fn(),
    onSuccess: (_data, { label }) => {
      setSnack({ severity: 'success', message: `${label} deleted` });
      invalidate();
    },
    onError: (e) => setSnack({ severity: 'error', message: e.message }),
  });

  const handleDelete = (fn, label) => deleteMutation.mutate({ fn, label });

  if (treeQuery.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }
  if (treeQuery.isError) {
    return <Alert severity="error" sx={{ maxWidth: 600 }}>{treeQuery.error.message}</Alert>;
  }

  const tree = treeQuery.data || {};
  const departments = tree.departments || [];
  const users = tree.users || [];
  const unassignedOwners = tree.unassignedOwners || [];
  const peopleCount = departments.reduce((sum, d) =>
    sum + (d.owners || []).length + d.teams.reduce((t, tm) => t + tm.owners.length, 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>Organization</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Your departments, units and the people in them
          </Typography>
        </Box>
      </Box>

      <Card variant="outlined" sx={{ bgcolor: TL.gray50 }}>
        <CardContent sx={{ p: { xs: 1.5, md: 3 } }}>
          <Box sx={CHART_SX}>
            <ul>
              <li>
                <Card variant="outlined" sx={{ display: 'inline-block', minWidth: 240, textAlign: 'left', borderColor: TL.gray300, borderRadius: '10px' }}>
                  <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <BuildingOffice2Icon size={18} sx={{ color: TL.primary }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: TL.gray800 }}>
                        {tree.organizationName || 'Organization'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: TL.gray500 }}>
                      {departments.length} department{departments.length === 1 ? '' : 's'} · {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                    </Typography>
                    {canAddStructure && (
                      <Box>
                        <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />}
                          sx={{ mt: 1 }} onClick={() => setDeptModal({})}>
                          Add department
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                <ul>
                  {departments.map((node) => (
                    <li key={node.department.departmentId}>
                      <DepartmentCard
                        node={node}
                        isAdmin={isAdmin}
                        canAddStructure={canAddStructure}
                        canAddMember={canAddMember}
                        onEdit={() => setDeptModal(node.department)}
                        onDelete={() => handleDelete(() => api.org.deleteDepartment(node.department.departmentId), 'Department')}
                        onAddUnit={() => setTeamModal({ departmentId: node.department.departmentId })}
                        onAddMember={() => setAddMemberTo({ departmentId: node.department.departmentId })}
                        onEditMember={(owner) => setOwnerModal({ owner, departmentId: node.department.departmentId })}
                        onDeleteMember={(owner) => handleDelete(() => api.org.deleteOwner(owner.ownerId), 'Member')}
                      />
                      {(node.teams.length > 0) && (
                        <ul>
                          {node.teams.map((team) => (
                            <li key={team.team.teamId}>
                              <UnitCard
                                team={team}
                                canAddMember={canAddMember}
                                onEdit={() => setTeamModal({ team: team.team, departmentId: node.department.departmentId })}
                                onDelete={() => handleDelete(() => api.org.deleteTeam(team.team.teamId), 'Unit')}
                                onAddMember={() => setAddMemberTo({ departmentId: node.department.departmentId, teamId: team.team.teamId })}
                                onEditMember={(owner) => setOwnerModal({ owner, teamId: team.team.teamId, departmentId: node.department.departmentId })}
                                onDeleteMember={(owner) => handleDelete(() => api.org.deleteOwner(owner.ownerId), 'Member')}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}

                  <li>
                    <PeopleCard users={users} unassignedOwners={unassignedOwners} />
                  </li>
                </ul>
              </li>
            </ul>
          </Box>
        </CardContent>
      </Card>

      <StakeholdersPanel />

      {deptModal && (
        <DepartmentDialog open onClose={() => setDeptModal(null)} initial={deptModal}
          onSaved={() => { setDeptModal(null); setSnack({ severity: 'success', message: 'Department saved' }); invalidate(); }}
          onError={(e) => setSnack({ severity: 'error', message: e })} isAdmin={isAdmin} />
      )}
      {teamModal && (
        <TeamDialog open onClose={() => setTeamModal(null)} initial={teamModal}
          onSaved={() => { setTeamModal(null); setSnack({ severity: 'success', message: 'Unit saved' }); invalidate(); }}
          onError={(e) => setSnack({ severity: 'error', message: e })} />
      )}
      {ownerModal && (
        <OwnerDialog open onClose={() => setOwnerModal(null)} initial={ownerModal}
          onSaved={() => { setOwnerModal(null); setSnack({ severity: 'success', message: 'Member saved' }); invalidate(); }}
          onError={(e) => setSnack({ severity: 'error', message: e })} />
      )}
      {addMemberTo && (
        <QuickAddOwnerDialog open title="Add member" onClose={() => setAddMemberTo(null)}
          initialDepartmentId={addMemberTo.departmentId} initialTeamId={addMemberTo.teamId}
          onCreated={() => { setAddMemberTo(null); setSnack({ severity: 'success', message: 'Member added' }); invalidate(); }} />
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function CardHead({ icon, title, actions }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        {icon}
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: TL.gray800, lineHeight: 1.3 }}>{title}</Typography>
      </Box>
      {actions && <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}

function MemberList({ members, editable, onEdit, onDelete, emptyLabel }) {
  if (!members.length) {
    return <Typography variant="caption" sx={{ color: TL.gray400, display: 'block', mt: 0.5 }}>{emptyLabel}</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
      {members.map((member) => (
        <Tooltip key={member.ownerId} title={member.isActive === false ? 'Inactive' : ''}>
          <Chip
            size="small"
            variant="outlined"
            icon={<UserCircleIcon size={14} />}
            label={member.jobTitle ? `${member.fullName} · ${member.jobTitle}` : member.fullName}
            onClick={editable ? () => onEdit(member) : undefined}
            onDelete={editable ? () => onDelete(member) : undefined}
            sx={{
              maxWidth: 240, opacity: member.isActive === false ? 0.55 : 1,
              borderStyle: member.isActive === false ? 'dashed' : 'solid',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

function DepartmentCard({
  node, isAdmin, canAddStructure, canAddMember,
  onEdit, onDelete, onAddUnit, onAddMember, onEditMember, onDeleteMember,
}) {
  const { department, teams, owners } = node;

  return (
    <Card variant="outlined" sx={{ display: 'inline-block', minWidth: 220, maxWidth: 280, textAlign: 'left', borderColor: TL.gray300, borderRadius: '10px' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <CardHead
          icon={<BuildingOffice2Icon size={16} sx={{ color: TL.primary }} />}
          title={department.name}
          actions={isAdmin && (
            <>
              <IconButton size="small" onClick={onEdit}><PencilSquareIcon size={15} /></IconButton>
              <IconButton size="small" onClick={onDelete}><TrashIcon size={15} /></IconButton>
            </>
          )}
        />
        {department.headOwnerName && (
          <Typography variant="caption" sx={{ color: TL.gray500, display: 'block', mt: 0.25 }}>
            Head: {department.headOwnerName}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: TL.gray400, display: 'block' }}>
          {teams.length} unit{teams.length === 1 ? '' : 's'}
        </Typography>
        <MemberList members={owners} editable={isAdmin} onEdit={onEditMember} onDelete={onDeleteMember}
          emptyLabel="No direct members" />
        {(canAddStructure || canAddMember) && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {canAddStructure && (
              <Button size="small" startIcon={<PlusIcon size={14} />} onClick={onAddUnit}>Add unit</Button>
            )}
            {canAddMember && (
              <Button size="small" startIcon={<PlusIcon size={14} />} onClick={onAddMember}>Add member</Button>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function UnitCard({ team, canAddMember, onEdit, onDelete, onAddMember, onEditMember, onDeleteMember }) {
  return (
    <Card variant="outlined" sx={{ display: 'inline-block', minWidth: 190, maxWidth: 250, textAlign: 'left', borderRadius: '10px' }}>
      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
        <CardHead
          icon={<UserGroupIcon size={15} sx={{ color: TL.gray500 }} />}
          title={team.team.name}
          actions={
            <>
              <IconButton size="small" onClick={onEdit}><PencilSquareIcon size={14} /></IconButton>
              <IconButton size="small" onClick={onDelete}><TrashIcon size={14} /></IconButton>
            </>
          }
        />
        <MemberList members={team.owners} editable onEdit={onEditMember} onDelete={onDeleteMember} emptyLabel="No members" />
        {canAddMember && (
          <Box>
            <Button size="small" startIcon={<PlusIcon size={14} />} sx={{ mt: 0.5 }} onClick={onAddMember}>Add member</Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function PeopleCard({ users, unassignedOwners }) {
  return (
    <Card variant="outlined" sx={{ display: 'inline-block', minWidth: 230, maxWidth: 280, textAlign: 'left', borderColor: TL.gray300, borderStyle: 'dashed', borderRadius: '10px' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <CardHead icon={<UserCircleIcon size={16} sx={{ color: TL.primary }} />} title="Platform users" />
        <Typography variant="caption" sx={{ color: TL.gray400, display: 'block' }}>
          {users.length} user{users.length === 1 ? '' : 's'}
        </Typography>
        <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {users.map((u) => (
            <Box key={u.userId}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TL.gray800, lineHeight: 1.3 }}>
                {u.fullName}
              </Typography>
              <Typography variant="caption" sx={{ color: TL.gray500 }}>
                {[u.role, u.email].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          ))}
          {users.length === 0 && <Typography variant="caption" sx={{ color: TL.gray400 }}>No users</Typography>}
        </Box>
        {unassignedOwners.length > 0 && (
          <>
            <Box sx={{ borderTop: `1px solid ${TL.gray200}`, mt: 1, pt: 0.75 }} />
            <Typography variant="caption" sx={{ color: TL.gray500, fontWeight: 600 }}>Unassigned owners</Typography>
            <MemberList members={unassignedOwners} editable={false} emptyLabel="" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DepartmentDialog({ open, onClose, initial, onSaved, onError, isAdmin }) {
  const [form, setForm] = useState(() => ({
    name: initial.name || '',
    headOwnerId: initial.headOwnerId != null ? String(initial.headOwnerId) : '',
  }));
  const [saving, setSaving] = useState(false);
  const ownersQuery = useQuery({ queryKey: ['org', 'owners'], queryFn: () => api.org.owners(), enabled: open });
  const owners = ownersQuery.data || [];

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Name" fullWidth size="small" required value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField select label="Department head (owner)" fullWidth size="small" value={form.headOwnerId}
            onChange={(e) => setForm((f) => ({ ...f, headOwnerId: e.target.value }))}>
            <MenuItem value="">None</MenuItem>
            {owners.map((o) => <MenuItem key={o.ownerId} value={String(o.ownerId)}>{o.fullName}</MenuItem>)}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !isAdmin}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TeamDialog({ open, onClose, initial, onSaved, onError }) {
  const [form, setForm] = useState(() => ({
    name: initial.team?.name || '',
    departmentId: initial.departmentId != null ? String(initial.departmentId) : '',
  }));
  const [saving, setSaving] = useState(false);
  const departmentsQuery = useQuery({ queryKey: ['org', 'departments', false], queryFn: () => api.org.departments(false), enabled: open });
  const departments = departmentsQuery.data || [];

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
      <DialogTitle>{initial.team?.teamId ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField select label="Department" fullWidth size="small" required value={form.departmentId}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
            {departments.map((d) => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
          </TextField>
          <TextField label="Unit name" fullWidth size="small" required value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.departmentId}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OwnerDialog({ open, onClose, initial, onSaved, onError }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    fullName: initial.owner?.fullName || '',
    email: initial.owner?.email || '',
    titleId: initial.owner?.titleId != null ? String(initial.owner.titleId) : '',
    teamId: initial.owner?.teamId != null ? String(initial.owner.teamId) : (initial.teamId != null ? String(initial.teamId) : ''),
    departmentId: initial.owner?.departmentId != null ? String(initial.owner.departmentId) : (initial.departmentId != null ? String(initial.departmentId) : ''),
  }));
  const [saving, setSaving] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const departmentsQuery = useQuery({ queryKey: ['org', 'departments', false], queryFn: () => api.org.departments(false), enabled: open });
  const teamsQuery = useQuery({ queryKey: ['org', 'teams'], queryFn: () => api.org.teams(), enabled: open });
  const titlesQuery = useQuery({ queryKey: ['stakeholder-titles'], queryFn: () => api.stakeholderTitles.list(), enabled: open });
  const departments = departmentsQuery.data || [];
  const teams = teamsQuery.data || [];
  const titles = titlesQuery.data || [];

  const departmentTeams = form.departmentId
    ? teams.filter((t) => t.departmentId === Number(form.departmentId))
    : teams;

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['org', 'departments'] });
    qc.invalidateQueries({ queryKey: ['org', 'teams'] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!form.email.trim()) { onError('Email is required'); return; }
      if (!form.departmentId) { onError('A department is required'); return; }
      const body = { fullName: form.fullName.trim(), email: form.email.trim() };
      if (form.titleId) body.titleId = Number(form.titleId);
      body.departmentId = Number(form.departmentId);
      body.teamId = form.teamId ? Number(form.teamId) : null;
      if (initial.owner?.ownerId) await api.org.updateOwner(initial.owner.ownerId, body);
      else await api.org.createOwner(body);
      onSaved();
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial.owner?.ownerId ? 'Edit Member' : 'Add Member'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Full name" fullWidth size="small" required value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <TextField label="Email" fullWidth size="small" type="email" required value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Autocomplete
            size="small"
            options={titles}
            getOptionLabel={(o) => (typeof o === 'string' ? o : (o.name || ''))}
            isOptionEqualToValue={(o, v) => o.titleId === v.titleId}
            value={titles.find((t) => String(t.titleId) === String(form.titleId)) || null}
            onChange={(_, o) => {
              if (!o) { setForm((f) => ({ ...f, titleId: '' })); return; }
              setForm((f) => ({
                ...f,
                titleId: String(o.titleId),
                departmentId: f.departmentId || (o.defaultDepartmentId != null ? String(o.defaultDepartmentId) : ''),
                teamId: f.teamId || (o.defaultUnitId != null ? String(o.defaultUnitId) : ''),
              }));
            }}
            renderInput={(params) => <TextField {...params} label="Title" placeholder="e.g. Branch Manager" />}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Department" fullWidth size="small" value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, teamId: '' }))}>
                <MenuItem value="">None</MenuItem>
                {departments.map((d) => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
              </TextField>
            </Box>
            <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap' }}
              onClick={() => setDeptOpen(true)}>
              Add department
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Unit" fullWidth size="small" value={form.teamId}
                onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}>
                <MenuItem value="">None</MenuItem>
                {departmentTeams.map((t) => <MenuItem key={t.teamId} value={String(t.teamId)}>{t.name}</MenuItem>)}
                {departmentTeams.length === 0 && (
                  <MenuItem value="" disabled>
                    {form.departmentId ? 'No units in this department' : 'Select a department first'}
                  </MenuItem>
                )}
              </TextField>
            </Box>
            <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap' }} disabled={!form.departmentId}
              onClick={() => setTeamOpen(true)}>
              Add unit
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.fullName.trim()}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>

      {deptOpen && (
        <QuickAddDepartmentDialog open onClose={() => setDeptOpen(false)}
          onCreated={(d) => { reload(); setForm((f) => ({ ...f, departmentId: String(d.departmentId), teamId: '' })); setDeptOpen(false); }} />
      )}
      {teamOpen && (
        <QuickAddTeamDialog open onClose={() => setTeamOpen(false)} departmentId={form.departmentId}
          onCreated={(t) => { reload(); setForm((f) => ({ ...f, teamId: String(t.teamId) })); setTeamOpen(false); }} />
      )}
    </Dialog>
  );
}
