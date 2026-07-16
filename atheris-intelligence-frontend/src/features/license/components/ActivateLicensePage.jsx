import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, TextField, Button, Alert,
  CircularProgress, Stepper, Step, StepLabel,
} from '@mui/material';
import { VpnKey, CheckCircle, Shield } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import api from '../../../services/api';
import { BRAND, ROUTES } from '../../../utils/constants';

export default function ActivateLicensePage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [licenseKey, setLicenseKey] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    try {
      const fp = localStorage.getItem('atheris_device_fp');
      if (fp) { setDeviceFingerprint(fp); return; }
      import('@fingerprintjs/fingerprintjs').then(FingerprintJS => {
        FingerprintJS.load().then(agent => {
          agent.get().then(result => {
            const id = result.visitorId;
            setDeviceFingerprint(id);
            localStorage.setItem('atheris_device_fp', id);
          });
        });
      }).catch(() => {
        setDeviceFingerprint('browser-' + Math.random().toString(36).substring(2, 10));
      });
    } catch { /* ignore */ }
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) { setError('Please enter your license key'); return; }
    setLoading(true);
    setError('');
    try {
      const resp = await api.license.activate({
        licenseKey: licenseKey.trim().toUpperCase(),
        deviceFingerprint: deviceFingerprint || undefined,
        deviceLabel: navigator.userAgent?.substring(0, 100),
      });
      if (resp.valid) {
        setActivated(true);
        setStep(1);
        setTimeout(() => navigate(ROUTES.DASHBOARD), 2000);
      } else {
        setError(resp.message || 'License activation failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to reach license server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#F7FAFC', p: 2,
    }}>
      <Card sx={{ maxWidth: 480, width: '100%', p: 4, borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Shield sx={{ fontSize: 48, color: theme.palette.warning.main, mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Activate Your License</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Enter the license key provided by your {BRAND.NAME} administrator
          </Typography>
        </Box>

        <Stepper activeStep={step} sx={{ mb: 3 }}>
          <Step><StepLabel>Enter Key</StepLabel></Step>
          <Step><StepLabel>Activated</StepLabel></Step>
        </Stepper>

        {step === 0 && (
          <Box>
            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}
            <TextField
              fullWidth size="small" label="License Key"
              placeholder="ATH-XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value.toUpperCase())}
              disabled={loading}
              InputProps={{ startAdornment: <VpnKey sx={{ mr: 1, fontSize: 18, color: '#CBD5E0' }} /> }}
              sx={{ mb: 2 }}
            />
            {deviceFingerprint && (
              <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }} icon={<CheckCircle sx={{ fontSize: 16 }} />}>
                Device registered: {deviceFingerprint.substring(0, 12)}...
              </Alert>
            )}
            <Button
              fullWidth variant="contained" size="large"
              onClick={handleActivate} disabled={loading}
              sx={{ py: 1.2, fontWeight: 600 }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Activate License'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
              Your device fingerprint is captured securely for license binding
            </Typography>
          </Box>
        )}

        {step === 1 && activated && (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 64, color: '#2D7D46', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D7D46' }}>License Activated</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Redirecting to dashboard...
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}
