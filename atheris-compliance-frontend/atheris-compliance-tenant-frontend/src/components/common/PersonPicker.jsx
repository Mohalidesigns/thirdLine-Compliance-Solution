import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TextField, Autocomplete, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Typography, MenuItem,
} from '@mui/material';
import { PlusIcon } from 'shared';
import { api } from '../../services/api';
import { QuickAddDepartmentDialog, QuickAddTeamDialog } from '../org/QuickAddDialogs';

function useLdapEnabled({ authType, onboarding } = {}) {
  const query = useQuery({
    queryKey: ['ldap', 'enabled'],
    queryFn: () => api.ldap.users('').then((res) => !!res?.enabled),
    staleTime: Infinity,
    enabled: !authType && !onboarding,
  });
  if (authType) return authType === 'ldap';
  if (onboarding) return false;
  return query.data ?? null;
}

export default function PersonPicker({
  mode = 'user',
  value,
  onChange,
  label,
  role,
  authType,
  ldapConfig,
  allowCreate = true,
  allowClear = true,
  disabled = false,
  size = 'small',
  fullWidth = true,
  helperText,
  sx,
  onOwnerCreated,
  onboarding = false,
  allowAddInline = true,
}) {
  if (mode === 'owner') {
    return <OwnerPickerBody {...{ value, onChange, label: label || 'Compliance Owner', allowCreate,
      allowClear, disabled, size, fullWidth, helperText, sx, onOwnerCreated, allowAddInline }} />;
  }
  if (mode === 'link') {
    return <LinkPickerBody {...{ value, onChange, label: label || 'Recipient email', disabled, size,
      fullWidth, helperText, sx }} />;
  }
  return <UserPickerBody {...{ value, onChange, label: label || (role ? `${role} user` : 'User'), role,
    authType, ldapConfig, allowCreate, allowClear, disabled, size, fullWidth, helperText, sx, onboarding }} />;
}

/* ─────────────── user mode ─────────────── */

function useDebounced(value, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function UserPickerBody({ value, onChange, label, role, authType, ldapConfig, allowCreate,
  allowClear, disabled, size, fullWidth, helperText, sx, onboarding }) {
  const [input, setInput] = useState('');
  const term = useDebounced(input);
  const ldapEnabled = useLdapEnabled({ authType, onboarding });
  const cfgKey = ldapConfig ? JSON.stringify(ldapConfig) : '';

  const optionsQuery = useQuery({
    queryKey: ['person-options', ldapEnabled ? 'ldap' : 'local', onboarding, cfgKey, term],
    queryFn: () => {
      if (ldapEnabled) {
        if (ldapConfig) return api.onboarding.ldapUsers(ldapConfig, term);
        if (onboarding) return Promise.resolve([]);
        return api.ldap.users(term).then((r) => r.users || []);
      }
      if (onboarding) return Promise.resolve([]);
      return api.users.list(term).then((list) => (list || []).map((u) => ({
        email: u.email, fullName: u.fullName, userId: u.userId, role: u.role,
      })));
    },
    enabled: ldapEnabled != null,
    placeholderData: (prev) => prev,
  });
  const options = optionsQuery.data || [];
  const loading = ldapEnabled == null || optionsQuery.isFetching;
  const error = optionsQuery.isError ? (optionsQuery.error?.message || 'Search failed') : '';

  const selected = value && value.email ? value : null;
  const freeSolo = !ldapEnabled && allowCreate;

  const handleChange = (_, option) => {
    if (option == null) { onChange(null); return; }
    if (typeof option === 'string') {
      onChange({ email: option.trim(), fullName: selected?.fullName || '' });
      return;
    }
    onChange({ email: option.email, fullName: option.fullName || '', userId: option.userId ?? null });
  };

  const showNameField = !ldapEnabled && selected?.email && !selected?.fullName;

  return (
    <Box sx={sx}>
      <Autocomplete
        size={size}
        fullWidth={fullWidth}
        disabled={disabled || ldapEnabled == null}
        options={options}
        value={selected}
        onChange={handleChange}
        onInputChange={(_, v) => setInput(v)}
        getOptionLabel={(o) => (typeof o === 'string' ? o : (o.email || ''))}
        isOptionEqualToValue={(o, v) => (o.email || '').toLowerCase() === (v.email || '').toLowerCase()}
        filterOptions={(x) => x}
        freeSolo={freeSolo}
        autoSelect={false}
        loading={loading}
        noOptionsText={ldapEnabled
          ? (input ? 'No matching directory users' : 'Type to search the directory')
          : 'Type an email to invite a new user'}
        renderOption={(props, o) => (
          <li {...props} key={o.email}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>{o.fullName || o.email}</Typography>
              {o.fullName && <Typography variant="caption" color="text.secondary" noWrap>{o.email}</Typography>}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={role ? `${label}` : label}
            placeholder={ldapEnabled ? 'Search directory…' : 'Search users or type an email…'}
            helperText={error || helperText}
            error={!!error}
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(loading || ldapEnabled == null) ? <CircularProgress size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {showNameField && (
        <TextField
          fullWidth size={size} label="Full name" required sx={{ mt: 1.5 }}
          value={selected.fullName || ''}
          onChange={(e) => onChange({ ...selected, fullName: e.target.value })}
        />
      )}
    </Box>
  );
}

/* ─────────────── owner mode ─────────────── */

function OwnerPickerBody({ value, onChange, label, allowCreate, allowClear, disabled, size, fullWidth,
  helperText, sx, onOwnerCreated, allowAddInline = true }) {
  const qc = useQueryClient();
  const [quickOpen, setQuickOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [input, setInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const term = useDebounced(input);
  const ldapEnabled = useLdapEnabled();

  const ownersQuery = useQuery({ queryKey: ['org', 'owners'], queryFn: () => api.org.owners() });
  const owners = ownersQuery.data || [];
  const dirQuery = useQuery({
    queryKey: ['ldap', 'users', term],
    queryFn: () => api.ldap.users(term).then((res) => res?.users || []),
    enabled: !!ldapEnabled,
    placeholderData: (prev) => prev,
  });
  const directory = ldapEnabled ? (dirQuery.data || []) : [];
  const loading = ownersQuery.isLoading;
  const error = actionError || ownersQuery.error?.message || dirQuery.error?.message || '';

  const options = useMemo(() => {
    const owned = owners.map((o) => ({
      kind: 'owner', ownerId: o.ownerId, fullName: o.fullName, email: o.email,
      departmentName: o.departmentName, teamName: o.teamName,
    }));
    if (!ldapEnabled) return owned;
    const taken = new Set(owners.flatMap((o) => [(o.email || '').toLowerCase(), (o.fullName || '').toLowerCase()]).filter(Boolean));
    const fromDirectory = directory
      .filter((u) => u.email && !taken.has(u.email.toLowerCase()) && !taken.has((u.fullName || '').toLowerCase()))
      .map((u) => ({ kind: 'directory', fullName: u.fullName, email: u.email }));
    return [...owned, ...fromDirectory];
  }, [owners, directory, ldapEnabled]);

  const selected = value != null ? options.find((o) => o.kind === 'owner' && o.ownerId === value) || null : null;

  const handleChange = async (_, o) => {
    if (!o) { onChange(null); return; }
    if (o.kind === 'owner') { onChange(o.ownerId); return; }
    const existing = owners.find((x) => (x.email || '').toLowerCase() === (o.email || '').toLowerCase());
    if (existing) { onChange(existing.ownerId); return; }
    setResolving(true);
    setActionError('');
    try {
      const created = await api.org.createOwner({ fullName: o.fullName || o.email, email: o.email });
      qc.invalidateQueries({ queryKey: ['org', 'owners'] });
      onChange(created.ownerId);
      onOwnerCreated?.(created);
    } catch (e) { setActionError(e.message || 'Failed to add owner'); }
    finally { setResolving(false); }
  };

  return (
    <Box sx={sx}>
      <Autocomplete
        size={size}
        fullWidth={fullWidth}
        disabled={disabled}
        options={options}
        value={selected}
        onChange={handleChange}
        onInputChange={(_, v) => setInput(v)}
        getOptionLabel={(o) => o.fullName || o.email || ''}
        isOptionEqualToValue={(o, v) => o.kind === 'owner' && v.kind === 'owner'
          ? o.ownerId === v.ownerId
          : o.kind === 'directory' && v.kind === 'directory' && o.email === v.email}
        filterOptions={(list, state) => {
          const t = state.inputValue.trim().toLowerCase();
          if (!t) return list;
          return list.filter((o) => o.kind === 'directory'
            || (o.fullName || '').toLowerCase().includes(t) || (o.email || '').toLowerCase().includes(t));
        }}
        loading={loading || resolving}
        noOptionsText={ldapEnabled ? 'Search owners or your directory…' : 'No matching owners'}
        renderOption={(props, o) => (
          <li {...props} key={o.kind === 'owner' ? `o-${o.ownerId}` : `d-${o.email}`}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>{o.fullName}{o.kind === 'owner' && o.departmentName ? ` — ${o.departmentName}` : ''}</Typography>
              {o.email && <Typography variant="caption" color="text.secondary" noWrap>{o.email}{o.kind === 'directory' ? ' · directory' : ''}</Typography>}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} label={label} placeholder={ldapEnabled ? 'Search owners or directory…' : 'Search owners…'}
            helperText={error || helperText} error={!!error}
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(loading || resolving) ? <CircularProgress size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }} />
        )}
      />
      {allowCreate && allowAddInline && ldapEnabled === false && (
        <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ mt: 0.5 }}
          onClick={() => { setActionError(''); setQuickOpen(true); }}>
          Add new owner
        </Button>
      )}
      {allowCreate && allowAddInline && ldapEnabled === false && (
        <QuickAddOwnerDialog open={quickOpen} onClose={() => setQuickOpen(false)}
          onCreated={(owner) => { onChange(owner.ownerId); onOwnerCreated?.(owner); qc.invalidateQueries({ queryKey: ['org', 'owners'] }); setQuickOpen(false); }} />
      )}
    </Box>
  );
}

/* ─────────────── link mode ─────────────── */

function LinkPickerBody({ value, onChange, label, disabled, size, fullWidth, helperText, sx }) {
  const ownersQuery = useQuery({ queryKey: ['org', 'owners'], queryFn: () => api.org.owners() });
  const owners = ownersQuery.data || [];
  const loading = ownersQuery.isLoading;
  const email = typeof value === 'string' ? value : (value?.email || '');
  return (
    <Box sx={sx}>
      <Autocomplete
        size={size}
        fullWidth={fullWidth}
        disabled={disabled}
        freeSolo
        options={owners.map((o) => ({ email: o.email, fullName: o.fullName })).filter((o) => o.email)}
        value={email || null}
        onChange={(_, o) => onChange(o == null ? '' : (typeof o === 'string' ? o : o.email))}
        getOptionLabel={(o) => (typeof o === 'string' ? o : (o.email || ''))}
        isOptionEqualToValue={(o, v) => (o.email || '').toLowerCase() === String(v).toLowerCase()}
        loading={loading}
        noOptionsText="Type an email address"
        renderOption={(props, o) => (
          <li {...props} key={o.email}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>{o.fullName || o.email}</Typography>
              {o.fullName && <Typography variant="caption" color="text.secondary" noWrap>{o.email}</Typography>}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} label={label} placeholder="Search owners or type an email…"
            helperText={helperText}
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }} />
        )}
      />
    </Box>
  );
}

/* ─────────────── owner quick-add ─────────────── */

export function QuickAddOwnerDialog({ open, onClose, onCreated }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: '', email: '', jobTitle: '', departmentId: '', teamId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [dirInput, setDirInput] = useState('');
  const dirTerm = useDebounced(dirInput);
  const ldapEnabled = useLdapEnabled();

  const departmentsQuery = useQuery({
    queryKey: ['org', 'departments', true],
    queryFn: () => api.org.departments(true),
    enabled: open,
  });
  const teamsQuery = useQuery({ queryKey: ['org', 'teams'], queryFn: () => api.org.teams(), enabled: open });
  const dirQuery = useQuery({
    queryKey: ['ldap', 'users', dirTerm],
    queryFn: () => api.ldap.users(dirTerm).then((r) => r?.users || []),
    enabled: open && !!ldapEnabled,
  });
  const departments = departmentsQuery.data || [];
  const teams = teamsQuery.data || [];
  const dirUsers = ldapEnabled ? (dirQuery.data || []) : [];
  const shownError = error || departmentsQuery.error?.message || '';

  useEffect(() => {
    if (open) {
      setForm({ fullName: '', email: '', jobTitle: '', departmentId: '', teamId: '' });
      setError('');
      setDirInput('');
    }
  }, [open]);

  const departmentTeams = form.departmentId
    ? teams.filter((t) => t.departmentId === Number(form.departmentId))
    : teams;

  const handleSave = async () => {
    if (!form.fullName.trim()) { setError('Owner full name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { fullName: form.fullName.trim() };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.jobTitle.trim()) body.jobTitle = form.jobTitle.trim();
      if (form.departmentId) body.departmentId = Number(form.departmentId);
      if (form.teamId) body.teamId = Number(form.teamId);
      const created = await api.org.createOwner(body);
      onCreated(created);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['org', 'departments', true] });
    qc.invalidateQueries({ queryKey: ['org', 'teams'] });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Owner</DialogTitle>
      <DialogContent dividers>
        {shownError && <Alert severity="error" sx={{ mb: 2 }}>{shownError}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ldapEnabled && (
            <Autocomplete
              size="small"
              options={dirUsers}
              getOptionLabel={(o) => (typeof o === 'string' ? o : (o.fullName || o.email || ''))}
              isOptionEqualToValue={(o, v) => o.email === v.email}
              onInputChange={(_, v) => setDirInput(v)}
              onChange={(_, o) => {
                if (o && typeof o !== 'string') setForm((f) => ({ ...f, fullName: o.fullName || f.fullName, email: o.email || f.email }));
              }}
              renderInput={(params) => (
                <TextField {...params} label="Search directory" placeholder="Search LDAP users…"
                  helperText="Pick a directory user to prefill their name and email" />
              )}
            />
          )}
          <TextField label="Full name" fullWidth size="small" required value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <TextField label="Email" fullWidth size="small" type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <TextField label="Job title" fullWidth size="small" value={form.jobTitle}
            onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Department" fullWidth size="small" value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, teamId: '' }))}>
                {form.departmentId !== '' && <MenuItem value="">None</MenuItem>}
                {departments.map((d) => (
                  <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>
                ))}
                {departments.length === 0 && <MenuItem value="" disabled>No departments yet</MenuItem>}
              </TextField>
            </Box>
            <Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} sx={{ width: 170, whiteSpace: 'nowrap' }}
              onClick={() => { setError(''); setDeptOpen(true); }}>
              {departments.length === 0 ? 'Add department' : 'Add new department'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Team" fullWidth size="small" value={form.teamId}
                onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}>
                {form.teamId !== '' && <MenuItem value="">None</MenuItem>}
                {departmentTeams.map((t) => (
                  <MenuItem key={t.teamId} value={String(t.teamId)}>{t.name}</MenuItem>
                ))}
                {departmentTeams.length === 0 && (
                  <MenuItem value="" disabled>
                    {form.departmentId ? 'No teams in this department' : 'Select a department first'}
                  </MenuItem>
                )}
              </TextField>
            </Box>
            <Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} sx={{ width: 170, whiteSpace: 'nowrap' }} disabled={!form.departmentId}
              onClick={() => { setError(''); setTeamOpen(true); }}>
              {departmentTeams.length === 0 ? 'Add team' : 'Add new team'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Owner'}
        </Button>
      </DialogActions>

      <QuickAddDepartmentDialog open={deptOpen} onClose={() => setDeptOpen(false)}
        onCreated={(d) => { reload(); setForm((f) => ({ ...f, departmentId: String(d.departmentId), teamId: '' })); setDeptOpen(false); }} />
      <QuickAddTeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} departmentId={form.departmentId}
        onCreated={(t) => { reload(); setForm((f) => ({ ...f, teamId: String(t.teamId) })); setTeamOpen(false); }} />
    </Dialog>
  );
}
