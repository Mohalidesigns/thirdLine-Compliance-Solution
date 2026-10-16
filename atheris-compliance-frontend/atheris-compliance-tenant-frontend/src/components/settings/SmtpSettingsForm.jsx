import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Alert, Divider,
  FormControlLabel, Checkbox, Grid, CircularProgress,
} from '@mui/material';

const EMPTY = {
  host: '', port: 587, username: '', password: '', from: '', auth: true, starttls: true,
};

/**
 * SMTP configuration form, reused by the onboarding wizard and Settings.
 *
 * Props:
 *  - load(): Promise<config>  initial values (settings mode); omit for onboarding (blank).
 *  - onSave(config): Promise  persist; returns updated config or void.
 *  - onTest(config): Promise<{ok,message}>
 *  - passwordSet: whether a password is already stored (settings mode) — shows a hint.
 */
export default function SmtpSettingsForm({
  load, onSave, onTest, passwordSet = false, intro,
}) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!!load);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!load) return;
    let alive = true;
    load()
      .then(cfg => { if (alive && cfg) setForm({ ...EMPTY, ...cfg, password: '' }); })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const payload = () => ({
    host: form.host, port: Number(form.port) || 587, username: form.username,
    password: form.password, from: form.from, auth: form.auth, starttls: form.starttls,
  });

  async function handleTest() {
    if (!form.host) { setError('Host is required'); return; }
    setTesting(true); setError(''); setSuccess(''); setTestResult(null);
    try {
      setTestResult(await onTest(payload()));
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!form.host) { setError('Host is required'); return; }
    setSaving(true); setError(''); setSuccess(''); setTestResult(null);
    try {
      await onSave(payload());
      setSuccess('SMTP settings saved');
      setForm(f => ({ ...f, password: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {intro && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{intro}</Typography>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {testResult && (
        <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setTestResult(null)}>
          {testResult.message}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField fullWidth size="small" label="SMTP Host" value={form.host}
            onChange={e => set('host', e.target.value)} placeholder="smtp.example.com" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField fullWidth size="small" type="number" label="Port" value={form.port}
            onChange={e => set('port', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth size="small" label="Username" value={form.username}
            onChange={e => set('username', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth size="small" type="password" label="Password" value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder={passwordSet ? 'Leave blank to keep current' : ''}
            helperText={passwordSet ? 'A password is already stored — leave blank to keep it' : ''} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth size="small" label="From Address" value={form.from}
            onChange={e => set('from', e.target.value)} placeholder="noreply@yourorg.com" />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
        <FormControlLabel control={
          <Checkbox size="small" checked={form.auth} onChange={e => set('auth', e.target.checked)} />
        } label={<Typography variant="body2">Use authentication</Typography>} />
        <FormControlLabel control={
          <Checkbox size="small" checked={form.starttls} onChange={e => set('starttls', e.target.checked)} />
        } label={<Typography variant="body2">STARTTLS</Typography>} />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" onClick={handleTest} disabled={testing || saving}>
          {testing ? <CircularProgress size={18} /> : 'Test connection'}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || testing}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save SMTP settings'}
        </Button>
      </Box>
    </Box>
  );
}
