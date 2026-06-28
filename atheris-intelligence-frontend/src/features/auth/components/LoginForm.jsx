import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Divider, Checkbox, FormControlLabel, Link,
} from '@mui/material';
import { Visibility, VisibilityOff, Shield, Email, Lock } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../hooks/useAuth';
import { BRAND, STRINGS, ROUTES } from '../../../utils/constants';

export default function LoginForm() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('atheris_session_expired')) {
      sessionStorage.removeItem('atheris_session_expired');
      setError('Your session has expired. Please log in again.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(STRINGS.LOGIN_ERROR_EMPTY);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login(email, password);
      if (result?.error) {
        setError(result.payload || STRINGS.LOGIN_ERROR_FAILED);
        return;
      }
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setError(err.message || STRINGS.LOGIN_ERROR_FAILED);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1A365D 0%, #0F2340 50%, #1A365D 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05,
        backgroundImage: 'radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px), radial-gradient(circle at 75% 75%, #2D7D46 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <Card sx={{ width: 420, maxWidth: '90%', borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 60, height: 60, borderRadius: 3, bgcolor: theme.palette.primary.main, mb: 2,
            }}>
              <Shield sx={{ fontSize: 36, color: theme.palette.warning.main }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
              {BRAND.NAME}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
              {BRAND.SUBTAGLINE}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email Address" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Email sx={{ color: theme.palette.text.secondary, fontSize: 20 }} /></InputAdornment>,
              }}
            />
            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              sx={{ mb: 1.5 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock sx={{ color: theme.palette.text.secondary, fontSize: 20 }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" defaultChecked />}
                label={<Typography variant="caption">{STRINGS.REMEMBER_ME}</Typography>}
              />
              <Link href="#" variant="caption" sx={{ color: theme.palette.primary.main }}>{STRINGS.FORGOT_PASSWORD}</Link>
            </Box>

            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading}
              sx={{ py: 1.3, fontSize: '0.9rem', fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : STRINGS.SIGN_IN}
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }}>
            <Typography variant="caption" color="text.secondary">OR</Typography>
          </Divider>

          <Button
            fullWidth variant="outlined" size="large" disabled={loading}
            onClick={() => { login(); navigate(ROUTES.DASHBOARD); }}
            sx={{ py: 1, borderColor: theme.palette.secondary.main, color: theme.palette.secondary.main, '&:hover': { bgcolor: '#f0faf3', borderColor: theme.palette.secondary.main } }}
          >
            {STRINGS.DEMO_LOGIN}
          </Button>

          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: theme.palette.text.secondary }}>
            {BRAND.SECURITY_NOTICE}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
