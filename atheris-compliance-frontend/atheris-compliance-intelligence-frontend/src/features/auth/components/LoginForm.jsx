import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Divider, Checkbox, FormControlLabel, Link,
} from '@mui/material';
import { VisibilityOff } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import {
  FilterField, TL, EyeIcon, ShieldCheckIcon, EnvelopeIcon, LockClosedIcon,
  GlobeAltIcon, DocumentMagnifyingGlassIcon, ScaleIcon,
} from 'shared';
import { useAuth } from '../hooks/useAuth';
import { BRAND, STRINGS, ROUTES } from '../../../utils/constants';

export default function LoginForm() {
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

  const highlights = [
    { icon: <GlobeAltIcon size={18} />, text: 'Horizon scanning across Nigerian regulators' },
    { icon: <DocumentMagnifyingGlassIcon size={18} />, text: 'AI-extracted obligations, sanctions & returns' },
    { icon: <ScaleIcon size={18} />, text: 'One regulatory universe for every tenant' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: TL.bg }}>
      {/* Brand side */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between',
        width: { md: '44%', lg: '40%' }, bgcolor: TL.primary, color: '#FFFFFF', p: 6,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: TL.accent,
          }}>
            <ShieldCheckIcon size={24} />
          </Box>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{BRAND.NAME}</Typography>
        </Box>

        <Box sx={{ maxWidth: 420 }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.25, mb: 1.5 }}>
            {BRAND.TAGLINE}
          </Typography>
          <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', mb: 4 }}>
            {BRAND.SUBTAGLINE}
          </Typography>
          {highlights.map((h) => (
            <Box key={h.text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: TL.accent, flexShrink: 0,
              }}>
                {h.icon}
              </Box>
              <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' }}>{h.text}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          {BRAND.SECURITY_NOTICE}
        </Typography>
      </Box>

      {/* Form side */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 6 }}>
        <Box sx={{
          width: 420, maxWidth: '100%', bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`,
          borderRadius: '12px', boxShadow: TL.cardShadow, p: { xs: 3, sm: 4 },
        }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 2, color: TL.primary }}>
              <ShieldCheckIcon size={24} />
              <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: TL.primary }}>{BRAND.NAME}</Typography>
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: TL.textPrimary, lineHeight: '2rem' }}>
              Sign in
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mt: 0.5 }}>
              {BRAND.NAME} {BRAND.TAGLINE}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <FilterField label="Email Address" sx={{ mb: 2 }}>
              <TextField
                fullWidth type="email" value={email} placeholder="you@company.com"
                onChange={e => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><EnvelopeIcon size={18} sx={{ color: TL.gray400 }} /></InputAdornment>,
                }}
              />
            </FilterField>
            <FilterField label="Password" sx={{ mb: 1.5 }}>
              <TextField
                fullWidth type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockClosedIcon size={18} sx={{ color: TL.gray400 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <EyeIcon size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" defaultChecked />}
                label={<Typography sx={{ fontSize: '0.8125rem', color: TL.gray600 }}>{STRINGS.REMEMBER_ME}</Typography>}
              />
              <Link href="#" underline="hover" sx={{ fontSize: '0.8125rem', fontWeight: 500, color: TL.primary }}>{STRINGS.FORGOT_PASSWORD}</Link>
            </Box>

            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : STRINGS.SIGN_IN}
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray400 }}>OR</Typography>
          </Divider>

          <Button
            fullWidth variant="outlined" size="large" disabled={loading}
            onClick={() => { login(); navigate(ROUTES.DASHBOARD); }}
          >
            {STRINGS.DEMO_LOGIN}
          </Button>

          <Typography sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mt: 2, fontSize: '0.75rem', color: TL.gray500 }}>
            {BRAND.SECURITY_NOTICE}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
