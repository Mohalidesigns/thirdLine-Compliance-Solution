import { useState, useEffect } from 'react';
import { TextField, Autocomplete, Box, CircularProgress, Typography, Chip } from '@mui/material';
import { api } from '../../services/api';

function useDebounced(value, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function MultiPersonPicker({ value = [], onChange, label = 'People', disabled = false, size = 'small', helperText }) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ldapEnabled, setLdapEnabled] = useState(null);
  const term = useDebounced(input);

  useEffect(() => {
    let cancelled = false;
    api.ldap.users('')
      .then((res) => { if (!cancelled) setLdapEnabled(!!res?.enabled); })
      .catch(() => { if (!cancelled) setLdapEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ldapEnabled == null) return;
    let cancelled = false;
    setLoading(true);
    const request = ldapEnabled
      ? api.ldap.users(term).then((r) => r.users || [])
      : api.users.list(term).then((list) => (list || []).map((u) => ({ email: u.email, fullName: u.fullName, userId: u.userId })));
    Promise.resolve(request)
      .then((list) => { if (!cancelled) setOptions(list || []); })
      .catch(() => { if (!cancelled) setOptions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ldapEnabled, term]);

  return (
    <Autocomplete
      multiple
      size={size}
      fullWidth
      disabled={disabled || ldapEnabled == null}
      options={options}
      value={value}
      onChange={(_, val) => onChange((val || []).map((v) => (typeof v === 'string' ? { email: v.trim(), fullName: '' } : v)))}
      onInputChange={(_, v) => setInput(v)}
      getOptionLabel={(o) => (typeof o === 'string' ? o : (o.fullName || o.email || ''))}
      isOptionEqualToValue={(o, v) => (o.email || '').toLowerCase() === (v.email || '').toLowerCase()}
      filterOptions={(x) => x}
      freeSolo={!ldapEnabled}
      loading={loading}
      noOptionsText={ldapEnabled
        ? (input ? 'No matching directory users' : 'Type to search the directory')
        : 'Type an email to add a person'}
      renderOption={(props, o) => (
        <li {...props} key={o.email}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>{o.fullName || o.email}</Typography>
            {o.fullName && <Typography variant="caption" color="text.secondary" noWrap>{o.email}</Typography>}
          </Box>
        </li>
      )}
      renderTags={(selected, getTagProps) => selected.map((o, i) => (
        <Chip size="small" label={o.fullName || o.email} {...getTagProps({ index: i })} />
      ))}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={ldapEnabled ? 'Search directory…' : 'Search users or type an email…'}
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
          }}
        />
      )}
    />
  );
}
