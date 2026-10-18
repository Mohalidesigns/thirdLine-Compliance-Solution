import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  required, validateName, validateEmail, validatePhone, validatePassword,
  TL, KeyIcon, CheckCircleIcon, SectionTable,
} from 'shared';
import verityLogoLight from '../Verity/verity-logo-light.png';
import {
  Box, Typography, Stepper, Step, StepLabel, Button, TextField,
  Alert, CircularProgress, Radio, RadioGroup, Divider, Chip, Checkbox,
  FormControl, FormLabel, FormControlLabel, LinearProgress,
} from '@mui/material';
import { api } from '../services/api';
import SmtpSettingsForm from '../components/settings/SmtpSettingsForm';
import PersonPicker from '../components/common/PersonPicker';

// 7 fixed steps — the backend's currentStep numbering is authoritative (0..6).
// Intelligence regulators feed the AI pipeline -> Review Inbox; Toolkit regulators
// feed the toolkit seed -> Obligations Register (only when the license enables it).
const STEPS = ['License', 'Institution', 'User Setup', 'Intelligence', 'Toolkit', 'SMTP', 'Confirm'];

const regulatorColumns = (selected, toggle, countField, countLabel) => [
  { id: 'select', label: '', minWidth: 48,
    render: (r) => (
      <Checkbox size="small" checked={selected.includes(r.regulatorId)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggle(r.regulatorId)} />
    ) },
  { id: 'name', label: 'Regulator', minWidth: 240,
    render: (r) => <Typography variant="body2">{r.name || '—'}</Typography> },
  { id: 'abbreviation', label: 'Abbrev', minWidth: 100,
    render: (r) => (r.abbreviation
      ? <Chip size="small" label={r.abbreviation} sx={{ height: 22, borderRadius: '4px' }} />
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
  { id: countField, label: countLabel, minWidth: 120,
    render: (r) => <Typography variant="body2">{r[countField] ?? 0}</Typography> },
];

export default function OnboardingPage() {
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
  // Intelligence regulators feed the AI pipeline -> Review Inbox.
  const [selectedRegulators, setSelectedRegulators] = useState([]);
  // Toolkit regulators feed the toolkit seed -> Obligations Register.
  const [selectedToolkitRegulators, setSelectedToolkitRegulators] = useState([]);
  const [autoSeedObligations, setAutoSeedObligations] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [toolkitSearch, setToolkitSearch] = useState('');

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
      if (resp.toolkitRegulators) setSelectedToolkitRegulators(resp.toolkitRegulators);
      setAutoSeedObligations(!!resp.autoSeedObligations);
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
      if (resp.onboardingCompleted) {
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
      await loadRegulators();
      setStep(3);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadRegulators() {
    try {
      const resp = await api.onboarding.status({ signal: AbortSignal.timeout(8000) });
      setAvailableRegulators(resp.availableRegulators || []);
      if (resp.subscribedRegulators?.length) setSelectedRegulators(resp.subscribedRegulators);
      if (resp.toolkitRegulators?.length) setSelectedToolkitRegulators(resp.toolkitRegulators);
      setAutoSeedObligations(!!resp.autoSeedObligations);
    } catch {
      /* regulators are only listable once the license api-key is active */
    }
  }

  function toggleRegulator(id) {
    setSelectedRegulators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleToolkitRegulator(id) {
    setSelectedToolkitRegulators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function filterRegulators(list, term) {
    const t = (term || '').trim().toLowerCase();
    if (!t) return list;
    return list.filter(r =>
      (r.name || '').toLowerCase().includes(t) ||
      (r.abbreviation || '').toLowerCase().includes(t));
  }

  async function handleSaveRegulators() {
    if (selectedRegulators.length === 0) {
      setError('Select at least one regulator to subscribe to.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.onboarding.regulators({ subscribedRegulators: selectedRegulators });
      setStep(4);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveToolkitRegulators() {
    setSubmitting(true);
    setError('');
    try {
      await api.onboarding.toolkitRegulators({ subscribedRegulators: selectedToolkitRegulators });
      setStep(5);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveSmtp(config) {
    return api.onboarding.saveSmtp(config);
  }

  async function handleContinueSmtp() {
    setSubmitting(true);
    setError('');
    try {
      await api.onboarding.documentTypes({ subscribedDocumentTypes: [], notificationRiskRatings: [] });
      setStep(6);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfirm() {
    submit('confirm',
      api.onboarding.confirm({ webhookUrl: webhookUrl || undefined }),
      7
    );
  }

  function getActiveStep() {
    return Math.min(step, 6);
  }

  const regRows = filterRegulators(availableRegulators, regSearch);
  const toolkitRows = filterRegulators(availableRegulators, toolkitSearch);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: TL.bg }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: TL.bg, p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', pt: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box component="img" src={verityLogoLight} alt="Verity Compliance" sx={{ height: 44, width: 'auto' }} />
        </Box>
        <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow, overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 3, md: 4 }, py: 3, borderBottom: `1px solid ${TL.gray100}` }}>
            <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.textPrimary }}>
              Welcome to Verity Compliance
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mt: 0.5 }}>
              Set up your compliance intelligence workspace
            </Typography>
          </Box>
          <Box sx={{ p: { xs: 3, md: 4 } }}>

            <Stepper activeStep={getActiveStep()} alternativeLabel sx={{ mb: 4 }}>
              {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>{error}</Alert>}
            {seeding && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800, mb: 1 }}>
                  Setting up your workspace
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mb: 2 }}>
                  Seeding obligations from the compliance toolkit...
                </Typography>
                <LinearProgress variant="determinate" value={seedCount > 0 ? 80 : 20} sx={{ mb: 1, height: 8, borderRadius: 9999, bgcolor: TL.gray200, '& .MuiLinearProgress-bar': { borderRadius: 9999, bgcolor: '#22C55E' } }} />
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                  {seedCount > 0 ? `${seedCount} obligations loaded` : 'Preparing...'}
                </Typography>
              </Box>
            )}
            {completed && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircleIcon size={48} sx={{ color: '#22C55E', mb: 1 }} />
                <Alert severity="success" sx={{ mb: 2 }}>
                  Onboarding complete! Redirecting to login...
                </Alert>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 0 && (
              <Box>
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mb: 2 }}>
                  Enter the license key provided by your Verity Compliance administrator
                </Typography>
                <TextField fullWidth size="small" label="License Key"
                  placeholder="ATH-XXXX-XXXX-XXXX-XXXX"
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                  disabled={submitting}
                  InputProps={{ startAdornment: <KeyIcon size={18} sx={{ mr: 1, color: TL.gray400 }} /> }}
                  sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large"
                  onClick={handleActivateLicense} disabled={submitting}>
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
                  onClick={handleInstitution} disabled={submitting}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 2 && (
              <Box>
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: TL.gray500, '&.Mui-focused': { color: TL.gray500 } }}>
                    Authentication Type
                  </FormLabel>
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
                    <Typography sx={{ display: 'block', fontSize: '0.75rem', color: TL.gray500, mb: 1 }}>
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
                <Typography sx={{ display: 'block', fontSize: '0.75rem', color: TL.gray500, mb: 1.5 }}>
                  {authType === 'ldap'
                    ? 'Pick the CCO and Analyst from your directory — the directory owns their passwords.'
                    : 'Choose an existing user or type the email to invite, then give a name. They sign in with the password you set.'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <PersonPicker mode="user" role="CCO" authType={authType} ldapConfig={ldapConfig} onboarding
                      value={ccoUser.email ? { email: ccoUser.email, fullName: ccoUser.fullName } : null}
                      onChange={(p) => setCcoUser(prev => ({ ...prev, email: p?.email || '', fullName: p?.fullName || '' }))} />
                  </Box>
                  {authType === 'local' && (
                    <TextField size="small" label="CCO Password" type="password" required value={ccoUser.password}
                      onChange={e => setCcoUser(p => ({ ...p, password: e.target.value }))} sx={{ flex: 1 }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <PersonPicker mode="user" role="Analyst" authType={authType} ldapConfig={ldapConfig} onboarding
                      value={analystUser.email ? { email: analystUser.email, fullName: analystUser.fullName } : null}
                      onChange={(p) => setAnalystUser(prev => ({ ...prev, email: p?.email || '', fullName: p?.fullName || '' }))} />
                  </Box>
                  {authType === 'local' && (
                    <TextField size="small" label="Analyst Password" type="password" required value={analystUser.password}
                      onChange={e => setAnalystUser(p => ({ ...p, password: e.target.value }))} sx={{ flex: 1 }} />
                  )}
                </Box>
                <RoleConfirmation ccoUser={ccoUser} analystUser={analystUser} />

                <Button fullWidth variant="contained" size="large"
                  onClick={handleUserSetup} disabled={submitting}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 3 && (
              <Box>
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mb: 2 }}>
                  Choose the regulators whose documents you want monitored. Their instruments arrive
                  in your Review Inbox after the AI pipeline processes them.
                </Typography>

                <SectionTable
                  columns={regulatorColumns(selectedRegulators, toggleRegulator, 'intelligenceCount', 'Documents')}
                  rows={regRows}
                  total={regRows.length}
                  page={0}
                  size={regRows.length || 1}
                  loading={false}
                  rowKey={(r) => r.regulatorId}
                  onRowClick={(r) => toggleRegulator(r.regulatorId)}
                  search={{ value: regSearch, onChange: setRegSearch, placeholder: 'Search regulator name or abbreviation...' }}
                  rowsPerPageOptions={[Math.max(regRows.length, 1)]}
                  emptyMessage={availableRegulators.length === 0 ? 'Loading regulators…' : 'No regulators match your search.'}
                />

                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
                  <Button size="small" onClick={() => setSelectedRegulators(regRows.map(r => r.regulatorId))}>
                    Select all
                  </Button>
                  <Button size="small" onClick={() => setSelectedRegulators([])}>Clear</Button>
                  <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, ml: 'auto' }}>
                    {selectedRegulators.length} selected
                  </Typography>
                </Box>

                <Button fullWidth variant="contained" size="large" sx={{ mt: 2 }}
                  onClick={handleSaveRegulators} disabled={submitting || selectedRegulators.length === 0}>
                  {submitting ? <CircularProgress size={20} /> : 'Continue'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 4 && (
              <Box>
                {autoSeedObligations ? (
                  <>
                    <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mb: 2 }}>
                      Your license includes the compliance toolkit. Choose the regulators whose toolkit
                      obligations should be loaded straight into your Obligations Register. You can skip this.
                    </Typography>

                    <SectionTable
                      columns={regulatorColumns(selectedToolkitRegulators, toggleToolkitRegulator, 'toolkitCount', 'Obligations')}
                      rows={toolkitRows}
                      total={toolkitRows.length}
                      page={0}
                      size={toolkitRows.length || 1}
                      loading={false}
                      rowKey={(r) => r.regulatorId}
                      onRowClick={(r) => toggleToolkitRegulator(r.regulatorId)}
                      search={{ value: toolkitSearch, onChange: setToolkitSearch, placeholder: 'Search regulator name or abbreviation...' }}
                      rowsPerPageOptions={[Math.max(toolkitRows.length, 1)]}
                      emptyMessage={availableRegulators.length === 0 ? 'Loading regulators…' : 'No regulators match your search.'}
                    />

                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
                      <Button size="small" onClick={() => setSelectedToolkitRegulators(toolkitRows.map(r => r.regulatorId))}>
                        Select all
                      </Button>
                      <Button size="small" onClick={() => setSelectedToolkitRegulators([])}>Clear</Button>
                      <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, ml: 'auto' }}>
                        {selectedToolkitRegulators.length} selected
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Your license does not include compliance-toolkit obligations, so there is nothing to
                    select here. Continue to set up your outgoing email.
                  </Alert>
                )}

                <Button fullWidth variant="contained" size="large" sx={{ mt: 2 }}
                  onClick={handleSaveToolkitRegulators} disabled={submitting}>
                  {submitting ? <CircularProgress size={20} /> : 'Continue'}
                </Button>
              </Box>
            )}

            {!seeding && !completed && getActiveStep() === 5 && (
              <SmtpSettingsForm
                onSave={handleSaveSmtp}
                onTest={api.onboarding.testSmtp}
                intro="Optionally connect your organisation's SMTP server so notifications and remediation emails are sent from your own domain. You can change this later in Settings."
                renderActions={({ save, saving, testing }) => (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Button variant="contained" onClick={handleContinueSmtp} disabled={submitting}>
                      Skip for now
                    </Button>
                    <Button variant="contained" onClick={save} disabled={saving || testing}>
                      {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save SMTP settings'}
                    </Button>
                    <Button variant="contained"
                      onClick={async () => { await save(); handleContinueSmtp(); }}
                      disabled={submitting}>
                      {submitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Continue'}
                    </Button>
                  </Box>
                )}
              />
            )}

            {!seeding && !completed && getActiveStep() === 6 && (
              <Box>
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mb: 3 }}>
                  You're all set! Review your selections and complete setup.
                </Typography>
                <Button fullWidth variant="contained" size="large"
                  onClick={handleConfirm} disabled={submitting}>
                  {submitting ? <CircularProgress size={20} /> : 'Complete Setup'}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** Read-only recap of the two compliance-role identities, so a CCO/Analyst swap is visible. */
function RoleConfirmation({ ccoUser, analystUser }) {
  const both = ccoUser.email && analystUser.email;
  const same = ccoUser.email && ccoUser.email.toLowerCase() === (analystUser.email || '').toLowerCase();
  const rows = [
    { role: 'CCO', hint: 'Chief Compliance Officer', user: ccoUser },
    { role: 'Analyst', hint: 'Reviews and tests controls', user: analystUser },
  ];
  return (
    <Box sx={{ p: 2, borderRadius: '10px', bgcolor: TL.gray50, border: `1px solid ${TL.gray100}`, mb: 2 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: TL.gray400,
        textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
        Confirm the roles
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {rows.map(({ role, hint, user }) => (
          <Box key={role} sx={{ flex: '1 1 220px', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: TL.gray500, display: 'block' }}>{role} — {hint}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
              {user.fullName || '—'} · {user.email || 'not set'}
            </Typography>
          </Box>
        ))}
      </Box>
      {same && both && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          The CCO and the Analyst are the same person. Assign two different people so segregation of duties holds.
        </Alert>
      )}
    </Box>
  );
}
