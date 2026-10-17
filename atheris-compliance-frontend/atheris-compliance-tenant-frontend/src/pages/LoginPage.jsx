import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Divider, Checkbox, FormControlLabel, Link, CircularProgress,
} from '@mui/material';
import { VisibilityOff } from '@mui/icons-material';
import {
  TL, EyeIcon, EnvelopeIcon, LockClosedIcon, ScaleIcon, ClipboardDocumentCheckIcon, ChartBarIcon,
} from 'shared';
import verityLogoDark from '../Verity/verity-logo-dark.png';
import verityLogoLight from '../Verity/verity-logo-light.png';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('atheris_tenant_session_expired')) {
      sessionStorage.removeItem('atheris_tenant_session_expired');
      setError('Your session has expired. Please log in again.');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Please enter both email and password'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: TL.bg }}>
      {/* brand panel (Thirdline navy) */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between',
        width: '44%', maxWidth: 560, bgcolor: TL.primary, color: '#FFFFFF', p: 6,
      }}>
        <Box component="img" src={verityLogoDark} alt="Verity Compliance"
          sx={{ height: 52, width: 'auto', alignSelf: 'flex-start' }} />

        <Box>
          <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.25, mb: 2 }}>
            Regulatory compliance, organised.
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.72)', mb: 4, maxWidth: 400 }}>
            Track obligations, controls, returns and sanctions in one register — with the evidence to prove it.
          </Typography>
          {[
            { icon: ScaleIcon, text: 'Obligations register mapped to every act' },
            { icon: ClipboardDocumentCheckIcon, text: 'Controls, tests and remediation tracking' },
            { icon: ChartBarIcon, text: 'Returns calendar and risk dashboards' },
          ].map(({ icon: Icon, text }) => (
            <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.08)', color: TL.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={16} />
              </Box>
              <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' }}>{text}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          © {new Date().getFullYear()} Atheris Limited
        </Typography>
      </Box>

      {/* sign-in form */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
        <Box sx={{ width: 420, maxWidth: '100%' }}>
          <Box component="img" src={verityLogoLight} alt="Verity Compliance"
            sx={{ display: { xs: 'block', md: 'none' }, height: 40, width: 'auto', mb: 3 }} />

          <Box sx={{
            bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px',
            boxShadow: TL.cardShadow, p: { xs: 3, sm: 4 },
          }}>
            <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, color: TL.textPrimary, lineHeight: '2rem' }}>
              Sign in
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mt: 0.5, mb: 3 }}>
              Welcome back. Enter your credentials to access your workspace.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth label="Email Address" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><EnvelopeIcon size={18} sx={{ color: TL.gray400 }} /></InputAdornment>,
                }}
              />
              <TextField
                fullWidth label="Password" type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                sx={{ mb: 1.5 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockClosedIcon size={18} sx={{ color: TL.gray400 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <EyeIcon size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <FormControlLabel
                  control={<Checkbox size="small" defaultChecked />}
                  label={<Typography sx={{ fontSize: '0.8125rem', color: TL.gray600 }}>Remember me</Typography>}
                />
                <Link href="#" underline="hover" sx={{ fontSize: '0.8125rem', fontWeight: 500, color: TL.primary }}>Forgot password?</Link>
              </Box>

              <Button
                type="submit" fullWidth variant="contained" size="large"
                disabled={loading}
              >
                {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Sign In'}
              </Button>
            </form>

            <Divider sx={{ my: 2.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray400 }}>OR</Typography>
            </Divider>

            <Button
              fullWidth variant="outlined" size="large"
              onClick={() => navigate('/onboarding')}
            >
              Get Started — Register Your Institution
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
