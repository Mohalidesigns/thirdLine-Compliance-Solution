import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Button, Alert, CircularProgress,
  TextField, MenuItem, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Autocomplete, Menu,
} from '@mui/material';
import {
  TL, PlusIcon,
  BuildingOffice2Icon, UserGroupIcon, UserCircleIcon, EllipsisVerticalIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { QuickAddOwnerDialog } from '../common/PersonPicker';
import { QuickAddDepartmentDialog, QuickAddTeamDialog, QuickAddTitleDialog } from './QuickAddDialogs';
import StakeholdersPanel from './StakeholdersPanel';

const TREE_SX = {
  '& ul': {
    listStyle: 'none', m: 0, p: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
  },
  '& li': { position: 'relative', display: 'flex', alignItems: 'center', pl: '26px', py: '3px' },
  '& li::before': {
    content: '""', position: 'absolute', left: 0, top: 0, height: '100%',
    borderLeft: `1px solid ${TL.gray200}`,
  },
  '& li:last-child::before': { height: '50%' },
  '& li::after': {
    content: '""', position: 'absolute', left: 0, top: '50%', width: '26px',
    borderTop: `1px solid ${TL.gray200}`,
  },
  '& > ul': { justifyContent: 'flex-start' },
  '& > ul > li': { pl: 0 },
  '& > ul > li::before, & > ul > li::after': { display: 'none' },
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
  const [headModal, setHeadModal] = useState(null);

  const treeQuery = useQuery({ queryKey: ['org', 'tree'], queryFn: () => api.org.tree() });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['org', 'tree'] });
    qc.invalidateQueries({ queryKey: ['org', 'owners'] });
    qc.invalidateQueries({ queryKey: ['org', 'departments'] });
    qc.invalidateQueries({ queryKey: ['org', 'teams'] });
  };

  const headMutation = useMutation({
    mutationFn: ({ fn }) => fn(),
    onSuccess: (_d, { label }) => { setSnack({ severity: 'success', message: label }); invalidate(); },
    onError: (e) => setSnack({ severity: 'error', message: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ fn }) => fn(),
    onSuccess: (_data, { label }) => {
      setSnack({ severity: 'success', message: `${label} deleted` });
      invalidate();
    },
    onError: (e) => setSnack({ severity: 'error', message: e.message }),
  });

  const handleDelete = (fn, label) => deleteMutation.mutate({ fn, label });

  const copyReportLink = async (kind, id) => {
    try {
      const res = kind === 'department'
        ? await api.org.departmentReportLink(id) : await api.org.unitReportLink(id);
      await navigator.clipboard.writeText(window.location.origin + res.path);
      setSnack({ severity: 'success', message: 'Reporting link copied' });
    } catch (e) { setSnack({ severity: 'error', message: e.message }); }
  };

  const openReportLink = async (kind, id) => {
    try {
      const res = kind === 'department'
        ? await api.org.departmentReportLink(id) : await api.org.unitReportLink(id);
      window.open(window.location.origin + res.path, '_blank', 'noopener');
    } catch (e) { setSnack({ severity: 'error', message: e.message }); }
  };

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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: TL.gray500 }}>
          {departments.length} department{departments.length === 1 ? '' : 's'} · {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
        </Typography>
        {canAddStructure && (
          <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />} onClick={() => setDeptModal({})}>
            Add department
          </Button>
        )}
      </Box>

      <Box sx={TREE_SX}>
        <ul>
          <li>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75,
              border: `1px solid ${TL.gray300}`, borderRadius: '8px', bgcolor: '#fff', width: 220, flexShrink: 0 }}>
              <BuildingOffice2Icon size={18} sx={{ color: TL.primary }} />
              <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.95rem', color: TL.gray800 }}>
                {tree.organizationName || 'Organization'}
              </Typography>
            </Box>
            <ul>
              {departments.map((node) => (
                <li key={node.department.departmentId}>
                  <TreeRow
                    icon={<BuildingOffice2Icon size={16} sx={{ color: TL.primary }} />}
                    label={node.department.name}
                    title={node.department.headOwnerName}
                    bold
                    menu={<CardMenu items={[
                      canAddStructure && { label: 'Add unit', onClick: () => setTeamModal({ departmentId: node.department.departmentId }) },
                      canAddMember && { label: 'Add member', onClick: () => setAddMemberTo({ departmentId: node.department.departmentId }) },
                      canAddMember && { label: node.department.headOwnerName ? 'Change head' : 'Set head', onClick: () => setHeadModal({ kind: 'department', id: node.department.departmentId, name: node.department.name, currentHeadId: node.department.headOwnerId }) },
                      canAddMember && node.department.headOwnerId != null && { label: 'Clear head', onClick: () => headMutation.mutate({ label: 'Department head cleared', fn: () => api.org.clearDepartmentHead(node.department.departmentId) }) },
                      { label: 'Copy reporting link', onClick: () => copyReportLink('department', node.department.departmentId) },
                      { label: 'Open reporting page', onClick: () => openReportLink('department', node.department.departmentId) },
                      isAdmin && { label: 'Edit department', onClick: () => setDeptModal(node.department) },
                      isAdmin && { label: 'Delete department', onClick: () => handleDelete(() => api.org.deleteDepartment(node.department.departmentId), 'Department'), danger: true },
                    ]} />}
                  />
                  {(node.teams.length > 0 || node.owners.length > 0) && (
                    <ul>
                      {node.teams.map((team) => (
                        <li key={team.team.teamId}>
                          <TreeRow
                            icon={<UserGroupIcon size={15} sx={{ color: TL.gray500 }} />}
                            label={team.team.name}
                            title={team.team.headOwnerName}
                            menu={<CardMenu size={15} items={[
                              canAddMember && { label: 'Add member', onClick: () => setAddMemberTo({ departmentId: node.department.departmentId, teamId: team.team.teamId }) },
                              canAddMember && { label: team.team.headOwnerName ? 'Change head' : 'Set head', onClick: () => setHeadModal({ kind: 'team', id: team.team.teamId, name: team.team.name, currentHeadId: team.team.headOwnerId }) },
                              canAddMember && team.team.headOwnerId != null && { label: 'Clear head', onClick: () => headMutation.mutate({ label: 'Unit head cleared', fn: () => api.org.clearTeamHead(team.team.teamId) }) },
                              { label: 'Copy reporting link', onClick: () => copyReportLink('unit', team.team.teamId) },
                              { label: 'Open reporting page', onClick: () => openReportLink('unit', team.team.teamId) },
                              { label: 'Edit unit', onClick: () => setTeamModal({ team: team.team, departmentId: node.department.departmentId }) },
                              { label: 'Delete unit', onClick: () => handleDelete(() => api.org.deleteTeam(team.team.teamId), 'Unit'), danger: true },
                            ]} />}
                          />
                          {team.owners.length > 0 && (
                            <ul>
                              {team.owners.map((o) => (
                                <li key={o.ownerId}>
                                  <MemberRow member={o} editable={isAdmin}
                                    onEdit={() => setOwnerModal({ owner: o, teamId: team.team.teamId, departmentId: node.department.departmentId })}
                                    onDelete={() => handleDelete(() => api.org.deleteOwner(o.ownerId), 'Member')} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                      {node.owners.map((o) => (
                        <li key={o.ownerId}>
                          <MemberRow member={o} editable={isAdmin}
                            onEdit={() => setOwnerModal({ owner: o, departmentId: node.department.departmentId })}
                            onDelete={() => handleDelete(() => api.org.deleteOwner(o.ownerId), 'Member')} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              <li>
                <TreeRow icon={<UserCircleIcon size={16} sx={{ color: TL.primary }} />}
                  label="Platform users" title={`${users.length} user${users.length === 1 ? '' : 's'}`} bold />
                {users.length > 0 && (
                  <ul>
                    {users.map((u) => (
                      <li key={u.userId}>
                        <TreeRow icon={<UserCircleIcon size={14} sx={{ color: TL.gray500 }} />}
                          label={u.fullName} title={[u.role, u.email].filter(Boolean).join(' · ')}
                          muted={u.isActive === false} />
                      </li>
                    ))}
                  </ul>
                )}
                {unassignedOwners.length > 0 && (
                  <ul>
                    {unassignedOwners.map((o) => (
                      <li key={o.ownerId}><MemberRow member={o} editable={false} /></li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </li>
        </ul>
      </Box>

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
      {headModal && (
        <HeadDialog
          key={`${headModal.kind}-${headModal.id}`}
          open
          title={headModal.kind === 'department' ? `Head of ${headModal.name}` : `Head of ${headModal.name}`}
          currentHeadId={headModal.currentHeadId}
          onClose={() => setHeadModal(null)}
          onSave={(ownerId) => {
            const fn = headModal.kind === 'department'
              ? () => api.org.setDepartmentHead(headModal.id, ownerId)
              : () => api.org.setTeamHead(headModal.id, ownerId);
            headMutation.mutate({ label: 'Head updated', fn });
            setHeadModal(null);
          }}
        />
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function TreeRow({ icon, label, title, menu, bold, muted, onClick, width = 220 }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.75, minWidth: width, maxWidth: 320, flexShrink: 0,
      px: 1, py: 0.5, border: `1px solid ${TL.gray200}`, borderRadius: '8px', bgcolor: '#fff',
    }}>
      {icon}
      <Typography onClick={onClick}
        sx={{ flex: 1, minWidth: 0, lineHeight: 1.3, fontSize: bold ? '0.875rem' : '0.8125rem',
          fontWeight: bold ? 700 : 600, color: TL.gray800,
          cursor: onClick ? 'pointer' : 'default', opacity: muted ? 0.55 : 1 }}>
        {label || '—'}
        {title ? <Box component="span" sx={{ color: TL.gray500, fontWeight: 400 }}> · {title}</Box> : null}
      </Typography>
      {menu}
    </Box>
  );
}

function MemberRow({ member, editable, onEdit, onDelete }) {
  return (
    <TreeRow
      icon={<UserCircleIcon size={14} sx={{ color: TL.gray500 }} />}
      label={member.fullName || member.email}
      title={member.jobTitle}
      width={200}
      muted={member.isActive === false}
      onClick={editable ? onEdit : undefined}
      menu={editable ? <CardMenu size={15} items={[
        { label: 'Edit member', onClick: onEdit },
        { label: 'Remove member', onClick: onDelete, danger: true },
      ]} /> : null}
    />
  );
}

function CardMenu({ items, size = 17 }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => setAnchor(e.currentTarget)}>
        <EllipsisVerticalIcon size={size} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {items.filter(Boolean).map((it, i) => (
          <MenuItem key={i} dense onClick={() => { setAnchor(null); it.onClick?.(); }}
            sx={it.danger ? { color: 'error.main' } : undefined}>
            {it.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function HeadDialog({ open, title, currentHeadId, onClose, onSave }) {
  const query = useQuery({ queryKey: ['stakeholders', 'list', 'heads'], queryFn: () => api.stakeholders.list({}), enabled: open });
  const options = query.data || [];
  const [value, setValue] = useState(currentHeadId != null ? String(currentHeadId) : '');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Autocomplete
          size="small"
          options={options}
          getOptionLabel={(o) => (o ? `${o.fullName}${o.jobTitle ? ' · ' + o.jobTitle : ''}` : '')}
          isOptionEqualToValue={(o, v) => o?.stakeholderId === v?.stakeholderId}
          value={options.find((o) => String(o.stakeholderId) === value) || null}
          onChange={(_, o) => setValue(o ? String(o.stakeholderId) : '')}
          loading={query.isLoading}
          renderInput={(params) => <TextField {...params} label="Head" placeholder="Search people…" />}
        />
        <Typography variant="caption" sx={{ color: TL.gray500, display: 'block', mt: 1 }}>
          The head receives the unit- and department-level escalation steps by default.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(value ? Number(value) : null)}>Save</Button>
      </DialogActions>
    </Dialog>
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
  const [titleOpen, setTitleOpen] = useState(false);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
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
            </Box>
            <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap' }}
              onClick={() => setTitleOpen(true)}>
              Add title
            </Button>
          </Box>

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
      {titleOpen && (
        <QuickAddTitleDialog open onClose={() => setTitleOpen(false)} departments={departments} units={teams}
          onCreated={(t) => {
            qc.invalidateQueries({ queryKey: ['stakeholder-titles'] });
            setForm((f) => ({
              ...f,
              titleId: String(t.titleId),
              departmentId: f.departmentId || (t.defaultDepartmentId != null ? String(t.defaultDepartmentId) : ''),
              teamId: f.teamId || (t.defaultUnitId != null ? String(t.defaultUnitId) : ''),
            }));
            setTitleOpen(false);
          }} />
      )}
    </Dialog>
  );
}
