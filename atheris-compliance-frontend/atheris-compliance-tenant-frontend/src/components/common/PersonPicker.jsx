import { useState, useEffect, useMemo } from 'react';
import {
  TextField, Autocomplete, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Typography, MenuItem,
} from '@mui/material';
import { PlusIcon } from 'shared';
import { api } from '../../services/api';
import { QuickAddDepartmentDialog, QuickAddTeamDialog } from '../org/QuickAddDialogs';

let ldapTenantCache = null;
async function isLdapTenant() {
  if (ldapTenantCache !== null) return ldapTenantCache;
  try { ldapTenantCache = !!(await api.ldap.users(''))?.enabled; }
  catch { ldapTenantCache = false; }
  return ldapTenantCache;
}

/**
 * One person picker for every "choose a person" surface, in three modes:
 *
 *  - `user`  — a login identity (email + full name). On an LDAP tenant it searches the directory
 *              and you must pick a real entry; on a local tenant it searches active users and also
 *              accepts a new email to invite. Used by onboarding (CCO / Analyst) and user invites.
 *  - `owner` — a compliance owner (`ownerId`); searches owners and can create a new one (no login).
 *              Controls and findings assign owners with this.
 *  - `link`  — an email to send a tokenised upload link to (returns / remediation); searches owner
 *              emails and accepts any typed address.
 *
 * `value` shapes by mode: user → { email, fullName, userId? } | null; owner → ownerId | null;
 * link → email string | ''.
 */
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
}) {
  if (mode === 'owner') {
    return <OwnerPickerBody {...{ value, onChange, label: label || 'Compliance Owner', allowCreate,
      allowClear, disabled, size, fullWidth, helperText, sx, onOwnerCreated }} />;
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
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ldapEnabled, setLdapEnabled] = useState(authType ? authType === 'ldap' : null);
  const term = useDebounced(input);

  // When the caller doesn't tell us the auth type (e.g. user invites), ask the directory endpoint.
  useEffect(() => {
    if (authType) { setLdapEnabled(authType === 'ldap'); return; }
    if (onboarding) { setLdapEnabled(false); return; }
    let cancelled = false;
    api.ldap.users('')
      .then((res) => { if (!cancelled) setLdapEnabled(!!res?.enabled); })
      .catch(() => { if (!cancelled) setLdapEnabled(false); });
    return () => { cancelled = true; };
  }, [authType, onboarding]);

  useEffect(() => {
    if (ldapEnabled == null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const request = ldapEnabled
      ? (ldapConfig
          ? api.onboarding.ldapUsers(ldapConfig, term)
          : (onboarding ? Promise.resolve([]) : api.ldap.users(term).then((r) => r.users || [])))
      : (onboarding
          ? Promise.resolve([])
          : api.users.list(term).then((list) => (list || []).map((u) => ({
              email: u.email, fullName: u.fullName, userId: u.userId, role: u.role,
            }))));
    Promise.resolve(request)
      .then((list) => { if (!cancelled) setOptions(list || []); })
      .catch((e) => { if (!cancelled) { setOptions([]); setError(e.message || 'Search failed'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ldapEnabled, term, superStable(ldapConfig), onboarding]);

  const selected = value && value.email ? value : null;
  const freeSolo = !ldapEnabled && allowCreate;

  const handleChange = (_, option) => {
    if (option == null) { onChange(null); return; }
    if (typeof option === 'string') {
      // A typed address (local tenant): keep any name already entered, else blank for the parent.
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
  helperText, sx, onOwnerCreated }) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [input, setInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const term = useDebounced(input);

  const loadOwners = () => {
    setLoading(true);
    api.org.owners()
      .then((list) => { setOwners(list || []); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadOwners(); }, []);

  useEffect(() => { isLdapTenant().then(setLdapEnabled); }, []);

  useEffect(() => {
    if (!ldapEnabled) { setDirectory([]); return; }
    let cancelled = false;
    api.ldap.users(term)
      .then((res) => { if (!cancelled) setDirectory(res?.users || []); })
      .catch(() => { if (!cancelled) setDirectory([]); });
    return () => { cancelled = true; };
  }, [ldapEnabled, term]);

  const options = useMemo(() => {
    const owned = owners.map((o) => ({
      kind: 'owner', ownerId: o.ownerId, fullName: o.fullName, email: o.email,
      departmentName: o.departmentName, teamName: o.teamName,
    }));
    if (!ldapEnabled) return owned;
    const taken = new Set(owners.flatMap((o) => [ (o.email || '').toLowerCase(), (o.fullName || '').toLowerCase() ]).filter(Boolean));
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
    setError('');
    try {
      const created = await api.org.createOwner({ fullName: o.fullName || o.email, email: o.email });
      loadOwners();
      onChange(created.ownerId);
      onOwnerCreated?.(created);
    } catch (e) { setError(e.message || 'Failed to add owner'); }
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
      {allowCreate && (
        <Button size="small" startIcon={<PlusIcon size={16} />} sx={{ mt: 0.5 }}
          onClick={() => { setError(''); setQuickOpen(true); }}>
          Add new owner
        </Button>
      )}
      <QuickAddOwnerDialog open={quickOpen} onClose={() => setQuickOpen(false)}
        onCreated={(owner) => { onChange(owner.ownerId); onOwnerCreated?.(owner); loadOwners(); setQuickOpen(false); }} />
    </Box>
  );
}

/* ─────────────── link mode ─────────────── */

function LinkPickerBody({ value, onChange, label, disabled, size, fullWidth, helperText, sx }) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.org.owners()
      .then((list) => setOwners(list || []))
      .catch(() => setOwners([]))
      .finally(() => setLoading(false));
  }, []);
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
  const [form, setForm] = useState({ fullName: '', email: '', jobTitle: '', departmentId: '', teamId: '' });
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [dirInput, setDirInput] = useState('');
  const [dirUsers, setDirUsers] = useState([]);
  const dirTerm = useDebounced(dirInput);

  useEffect(() => {
    if (open) {
      setForm({ fullName: '', email: '', jobTitle: '', departmentId: '', teamId: '' });
      setError('');
      setDirInput('');
      isLdapTenant().then(setLdapEnabled);
      api.org.departments(true).then(setDepartments).catch((e) => setError(e.message));
      api.org.teams().then(setTeams).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open || !ldapEnabled) { setDirUsers([]); return; }
    let cancelled = false;
    api.ldap.users(dirTerm)
      .then((r) => { if (!cancelled) setDirUsers(r?.users || []); })
      .catch(() => { if (!cancelled) setDirUsers([]); });
    return () => { cancelled = true; };
  }, [open, ldapEnabled, dirTerm]);

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
    api.org.departments(true).then(setDepartments).catch(() => {});
    api.org.teams().then(setTeams).catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Owner</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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

/** Stable stringify so an inline object prop doesn't refetch on every render. */
function superStable(obj) {
  return obj ? JSON.stringify(obj) : '';
}
