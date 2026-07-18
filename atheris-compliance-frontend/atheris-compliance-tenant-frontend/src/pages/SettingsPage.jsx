import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Alert, CircularProgress,
  Divider,
} from '@mui/material';
import { api } from '../services/api';

export default function SettingsPage() {
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
      <Typography variant="h4" sx={{ mb: 0.5 }}>Settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your compliance workspace
      </Typography>

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
            Manage your tenant account settings
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
