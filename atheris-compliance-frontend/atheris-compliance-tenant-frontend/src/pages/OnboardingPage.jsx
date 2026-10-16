import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { required, validateName, validateEmail, validatePhone, validatePassword } from 'shared';
import {
  Box, Typography, Card, CardContent, Stepper, Step, StepLabel, Button, TextField,
  Alert, CircularProgress, Radio, RadioGroup, Divider, Chip,
  FormControl, FormLabel, FormControlLabel, FormGroup, Checkbox, LinearProgress,
} from '@mui/material';
import {
  VpnKey, ElectricBolt, CheckCircle,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';

const STEPS = ['License', 'Institution', 'User Setup', 'Confirm'];

export default function OnboardingPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedCount, setSeedCount] = useState(0);
  const [seedTotal, setSeedTotal] = useState(0);
  const seedTimerRef = useRef(null);
  const seedTimeoutRef = useRef(null);

  const [licenseKey, setLicenseKey] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');

  const [institution, setInstitution] = useState({
    legalName: '', address: '', contactPhone: '', contactEmail: '',
  });

  const [authType, setAuthType] = useState('local');
  const [localAdmin, setLocalAdmin] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  // LDAP connection settings (Part 2). The bind password is sent only to the backend,
  // which encrypts it at rest.
  const [ldapConfig, setLdapConfig] = useState({
    url: '', bindDn: '', bindPassword: '', userSearchBase: '',
    userSearchFilterAttribute: 'mail', fullNameAttribute: 'cn',
  });
  const [ldapTest, setLdapTest] = useState({ testing: false, ok: null, message: '' });
  // The CCO and Analyst identities every tenant provisions (both auth types).
  const [ccoUser, setCcoUser] = useState({ fullName: '', email: '', password: '' });
  const [analystUser, setAnalystUser] = useState({ fullName: '', email: '', password: '' });
  // LDAP only: a local Tenant Admin who can sign in even if the directory is down.
  const [breakGlass, setBreakGlass] = useState({ fullName: '', email: '', password: '' });

  const [webhookUrl, setWebhookUrl] = useState('');
  const [availableRegulators, setAvailableRegulators] = useState([]);
  const [selectedRegulators, setSelectedRegulators] = useState([]);

  useEffect(() => {
    loadStatus();
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
  }, []);

  async function loadStatus() {
    try {
      const resp = await api.onboarding.status({ signal: AbortSignal.timeout(5000) });
      if (resp.onboardingCompleted) {
        navigate('/login', { replace: true });
        return;
      }
      setStep(resp.currentStep || 0);
      if (resp.legalName) setInstitution(prev => ({ ...prev, legalName: resp.legalName }));
      if (resp.authType) setAuthType(resp.authType);
      if (resp.availableRegulators) setAvailableRegulators(resp.availableRegulators);
      if (resp.subscribedRegulators) setSelectedRegulators(resp.subscribedRegulators);
    } catch {
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  const pollSeedStatus = useCallback(async () => {
    try {
      const status = await api.onboarding.seedStatus({ signal: AbortSignal.timeout(5000) });
      setSeedCount(status.obligationCount || 0);
      if (status.isSeeded) {
        if (seedTimerRef.current) clearInterval(seedTimerRef.current);
        if (seedTimeoutRef.current) clearTimeout(seedTimeoutRef.current);
        setSeeding(false);
        setCompleted(true);
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      }
    } catch {
      // ignore poll errors, keep polling
    }
  }, [navigate]);

  useEffect(() => {
    if (!seeding) return;
    seedTimerRef.current = setInterval(pollSeedStatus, 3000);
    pollSeedStatus();
    seedTimeoutRef.current = setTimeout(() => {
      if (seedTimerRef.current) clearInterval(seedTimerRef.current);
      setSeeding(false);
      setCompleted(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    }, 120000);
    return () => {
      if (seedTimerRef.current) clearInterval(seedTimerRef.current);
      if (seedTimeoutRef.current) clearTimeout(seedTimeoutRef.current);
    };
  }, [seeding, pollSeedStatus, navigate]);

  async function submit(path, data, nextStep) {
    setSubmitting(true);
    setError('');
    try {
      const resp = await data;
      setStep(resp.currentStep != null ? resp.currentStep : nextStep);
      if (nextStep === 6 && resp.onboardingCompleted) {
        setSeeding(true);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleActivateLicense() {
    if (!licenseKey.trim()) { setError('Enter your license key'); return; }
    submit('activateLicense',
      api.onboarding.activateLicense({
        licenseKey: licenseKey.trim().toUpperCase(),
        deviceFingerprint: deviceFingerprint || undefined,
        deviceLabel: navigator.userAgent?.substring(0, 100),
      }),
      1
    );
  }

  function handleInstitution() {
    const checks = [
      { v: validateName(institution.legalName), label: 'Legal name' },
    ];
    if (institution.address) checks.push({ v: required(institution.address, 'Address'), label: 'Address' });
    if (institution.contactEmail) checks.push({ v: validateEmail(institution.contactEmail), label: 'Contact email' });
    if (institution.contactPhone) checks.push({ v: validatePhone(institution.contactPhone), label: 'Contact phone' });
    const fail = checks.find(c => !c.v.valid);
    if (fail) { setError(fail.v.message); return; }
    submit('institution',
      api.onboarding.institution({
        legalName: institution.legalName,
        address: institution.address || undefined,
        contactPhone: institution.contactPhone || undefined,
        contactEmail: institution.contactEmail || undefined,
      }),
      2
    );
  }

  async function handleTestLdap() {
    setLdapTest({ testing: true, ok: null, message: '' });
    try {
      const res = await api.onboarding.testLdap(ldapConfig);
      setLdapTest({ testing: false, ok: !!res.ok, message: res.message || '' });
    } catch (err) {
      setLdapTest({ testing: false, ok: false, message: err.message || 'Test failed' });
    }
  }

  async function handleUserSetup() {
    const fail = (msg) => { setError(msg); return false; };
    if (authType === 'local') {
      const checks = [
        { v: validateName(localAdmin.fullName), label: 'Admin full name' },
        { v: validateEmail(localAdmin.email), label: 'Admin email' },
        { v: validatePassword(localAdmin.password), label: 'Admin password' },
      ];
      const bad = checks.find(c => !c.v.valid);
      if (bad) return fail(bad.v.message);
      if (localAdmin.password !== localAdmin.confirmPassword) return fail('Passwords do not match');
    } else {
      if (!ldapConfig.url || !ldapConfig.bindDn || !ldapConfig.bindPassword || !ldapConfig.userSearchBase)
        return fail('LDAP URL, bind DN, bind password and user search base are all required');
      if (!validateName(breakGlass.fullName).valid) return fail('Break-glass admin full name is required');
      if (!validateEmail(breakGlass.email).valid) return fail('Break-glass admin email is invalid');
      if (!validatePassword(breakGlass.password).valid) return fail(validatePassword(breakGlass.password).message);
    }
    // CCO + Analyst identities (required for both auth types).
    if (!validateName(ccoUser.fullName).valid || !validateEmail(ccoUser.email).valid)
      return fail('A valid CCO name and email are required');
    if (!validateName(analystUser.fullName).valid || !validateEmail(analystUser.email).valid)
      return fail('A valid Analyst name and email are required');
    if (authType === 'local') {
      if (!validatePassword(ccoUser.password).valid) return fail('CCO password is too weak');
      if (!validatePassword(analystUser.password).valid) return fail('Analyst password is too weak');
    }

    setSubmitting(true);
    setError('');
    try {
      const seedUsers = [
        { role: 'CCO', fullName: ccoUser.fullName, email: ccoUser.email,
          password: authType === 'local' ? ccoUser.password : undefined },
        { role: 'ANALYST', fullName: analystUser.fullName, email: analystUser.email,
          password: authType === 'local' ? analystUser.password : undefined },
      ];
      const authData = authType === 'local'
        ? { authType: 'local', localAdmin, seedUsers }
        : { authType: 'ldap', ldapConfig, breakGlassAdmin: breakGlass, seedUsers };
      await api.onboarding.userSetup(authData);
      await api.onboarding.documentTypes({ subscribedDocumentTypes: [], notificationRiskRatings: [] });
      setStep(5);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (selectedRegulators.length === 0) {
      setError('Select at least one regulator to subscribe to.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.onboarding.regulators({ subscribedRegulators: selectedRegulators });
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    submit('confirm',
      api.onboarding.confirm({ webhookUrl: webhookUrl || undefined }),
      6
    );
  }

  function toggleRegulator(id) {
    setSelectedRegulators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function getActiveStep() {
    if (step <= 2) return step;
    return 3;
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F7FAFC' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7FAFC', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: 1.5, bgcolor: theme.palette.warning.main, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                <ElectricBolt sx={{ fontSize: 30, color: theme.palette.primary.main }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Welcome to Atheris</Typography>
              <Typography variant="body2" color="text.secondary">
                Set up your compliance intelligence workspace
              </Typography>
            </Box>

            <Stepper activeStep={getActiveStep()} alternativeLabel sx={{ mb: 4 }}>
              {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>{error}</Alert>}
            {seeding && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Setting up your workspace
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Seeding obligations from the compliance toolkit...
                </Typography>
                <LinearProgress variant="determinate" value={seedCount > 0 ? 80 : 20} sx={{ mb: 1, borderRadius: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {seedCount > 0 ? `${seedCount} obligations loaded` : 'Preparing...'}
                </Typography>
              </Box>
            )}
            {completed && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Alert severity="success" sx={{ mb: 2 }}>
                  Onboarding complete! Redirecting to login...
                </Alert>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter the license key provided by your Atheris administrator
                </Typography>
                <TextField fullWidth size="small" label="License Key"
                  placeholder="ATH-XXXX-XXXX-XXXX-XXXX"
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                  disabled={submitting}
                  InputProps={{ startAdornment: <VpnKey sx={{ mr: 1, fontSize: 18, color: '#CBD5E0' }} /> }}
                  sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large"
                  onClick={handleActivateLicense} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Activate License'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 1 && (
              <Box>
                <TextField fullWidth size="small" label="Legal Name" required
                  value={institution.legalName}
                  onChange={e => setInstitution(p => ({ ...p, legalName: e.target.value }))}
                  sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Address"
                  value={institution.address}
                  onChange={e => setInstitution(p => ({ ...p, address: e.target.value }))}
                  multiline rows={2}
                  sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Contact Phone"
                  value={institution.contactPhone}
                  onChange={e => setInstitution(p => ({ ...p, contactPhone: e.target.value }))}
                  sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Contact Email" type="email"
                  value={institution.contactEmail}
                  onChange={e => setInstitution(p => ({ ...p, contactEmail: e.target.value }))}
                  sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large"
                  onClick={handleInstitution} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 2 && (
              <Box>
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Authentication Type</FormLabel>
                  <RadioGroup row value={authType} onChange={e => setAuthType(e.target.value)}>
                    <FormControlLabel value="local" control={<Radio />} label="Local Admin" />
                    <FormControlLabel value="ldap" control={<Radio />} label="LDAP" />
                  </RadioGroup>
                </FormControl>

                {authType === 'local' ? (
                  <Box>
                    <TextField fullWidth size="small" label="Full Name" required
                      value={localAdmin.fullName}
                      onChange={e => setLocalAdmin(p => ({ ...p, fullName: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Email" type="email" required
                      value={localAdmin.email}
                      onChange={e => setLocalAdmin(p => ({ ...p, email: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Password" type="password" required
                      value={localAdmin.password}
                      onChange={e => setLocalAdmin(p => ({ ...p, password: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Confirm Password" type="password" required
                      value={localAdmin.confirmPassword}
                      onChange={e => setLocalAdmin(p => ({ ...p, confirmPassword: e.target.value }))}
                      sx={{ mb: 2 }} />
                  </Box>
                ) : (
                  <Box>
                    <TextField fullWidth size="small" label="LDAP URL" required
                      placeholder="ldap://localhost:1389"
                      value={ldapConfig.url}
                      onChange={e => setLdapConfig(p => ({ ...p, url: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Bind DN" required
                      placeholder="cn=admin,dc=atheris,dc=test"
                      value={ldapConfig.bindDn}
                      onChange={e => setLdapConfig(p => ({ ...p, bindDn: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Bind Password" type="password" required
                      value={ldapConfig.bindPassword}
                      onChange={e => setLdapConfig(p => ({ ...p, bindPassword: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="User Search Base" required
                      placeholder="ou=people,dc=atheris,dc=test"
                      value={ldapConfig.userSearchBase}
                      onChange={e => setLdapConfig(p => ({ ...p, userSearchBase: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <TextField fullWidth size="small" label="Search attribute"
                        value={ldapConfig.userSearchFilterAttribute}
                        onChange={e => setLdapConfig(p => ({ ...p, userSearchFilterAttribute: e.target.value }))} />
                      <TextField fullWidth size="small" label="Full-name attribute"
                        value={ldapConfig.fullNameAttribute}
                        onChange={e => setLdapConfig(p => ({ ...p, fullNameAttribute: e.target.value }))} />
                    </Box>
                    <Button variant="outlined" size="small" onClick={handleTestLdap}
                      disabled={ldapTest.testing} sx={{ mb: 1 }}>
                      {ldapTest.testing ? 'Testing…' : 'Test connection'}
                    </Button>
                    {ldapTest.ok != null && (
                      <Alert severity={ldapTest.ok ? 'success' : 'error'} sx={{ mb: 2 }}>
                        {ldapTest.message || (ldapTest.ok ? 'Connection succeeded' : 'Connection failed')}
                      </Alert>
                    )}

                    <Divider sx={{ my: 1 }}>Break-glass local admin</Divider>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      A local Tenant Admin who can sign in if the directory is unavailable.
                    </Typography>
                    <TextField fullWidth size="small" label="Full Name" required
                      value={breakGlass.fullName}
                      onChange={e => setBreakGlass(p => ({ ...p, fullName: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Email" type="email" required
                      value={breakGlass.email}
                      onChange={e => setBreakGlass(p => ({ ...p, email: e.target.value }))}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Password" type="password" required
                      value={breakGlass.password}
                      onChange={e => setBreakGlass(p => ({ ...p, password: e.target.value }))}
                      sx={{ mb: 2 }} />
                  </Box>
                )}

                <Divider sx={{ my: 2 }}>Compliance roles</Divider>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  The {authType === 'ldap' ? 'directory must contain these emails; the directory owns the passwords' : 'CCO and Analyst sign in with these credentials'}. You can invite more users later.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField fullWidth size="small" label="CCO Full Name" required value={ccoUser.fullName}
                    onChange={e => setCcoUser(p => ({ ...p, fullName: e.target.value }))} />
                  <TextField fullWidth size="small" label="CCO Email" type="email" required value={ccoUser.email}
                    onChange={e => setCcoUser(p => ({ ...p, email: e.target.value }))} />
                </Box>
                {authType === 'local' && (
                  <TextField fullWidth size="small" label="CCO Password" type="password" required value={ccoUser.password}
                    onChange={e => setCcoUser(p => ({ ...p, password: e.target.value }))} sx={{ mb: 2 }} />
                )}
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField fullWidth size="small" label="Analyst Full Name" required value={analystUser.fullName}
                    onChange={e => setAnalystUser(p => ({ ...p, fullName: e.target.value }))} />
                  <TextField fullWidth size="small" label="Analyst Email" type="email" required value={analystUser.email}
                    onChange={e => setAnalystUser(p => ({ ...p, email: e.target.value }))} />
                </Box>
                {authType === 'local' && (
                  <TextField fullWidth size="small" label="Analyst Password" type="password" required value={analystUser.password}
                    onChange={e => setAnalystUser(p => ({ ...p, password: e.target.value }))} sx={{ mb: 2 }} />
                )}

                <Button fullWidth variant="contained" size="large"
                  onClick={handleUserSetup} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 3 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose the regulators you want to subscribe to. You'll receive their instruments
                  in your Review Inbox and, if the license enables it, their toolkit obligations.
                </Typography>

                {availableRegulators.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No regulators are available yet. Ask your platform administrator to enable regulators.
                  </Alert>
                ) : (
                  <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
                    <FormLabel component="legend" sx={{ mb: 0.5 }}>
                      Regulators ({selectedRegulators.length} selected)
                    </FormLabel>
                    <FormGroup sx={{ maxHeight: 260, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                      {availableRegulators.map(reg => (
                        <FormControlLabel
                          key={reg.regulatorId}
                          control={
                            <Checkbox size="small"
                              checked={selectedRegulators.includes(reg.regulatorId)}
                              onChange={() => toggleRegulator(reg.regulatorId)} />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{reg.name}</Typography>
                              {reg.abbreviation && (
                                <Chip size="small" label={reg.abbreviation}
                                  sx={{ height: 20, borderRadius: '4px', fontSize: '0.65rem' }} />
                              )}
                            </Box>
                          }
                        />
                      ))}
                    </FormGroup>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button size="small" onClick={() => setSelectedRegulators(availableRegulators.map(r => r.regulatorId))}>
                        Select all
                      </Button>
                      <Button size="small" onClick={() => setSelectedRegulators([])}>Clear</Button>
                    </Box>
                  </FormControl>
                )}

                <Button fullWidth variant="contained" size="large"
                  onClick={handleConfirm} disabled={submitting || selectedRegulators.length === 0}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Complete Setup'}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
