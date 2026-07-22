import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { required, validateName, validateEmail, validatePhone, validatePassword } from 'shared';
import {
  Box, Typography, Card, CardContent, Stepper, Step, StepLabel, Button, TextField,
  Alert, CircularProgress, Radio, RadioGroup,
  FormControl, FormLabel, FormControlLabel, Select, MenuItem, Chip, OutlinedInput, InputLabel,
  Checkbox, ListItemText, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, InputAdornment,
} from '@mui/material';
import {
  VpnKey, CheckCircle, Shield, Business, PeopleAlt,
  AccountBalance, Description, HowToReg,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';

const DOCUMENT_TYPES = ['circulars', 'guidelines', 'directives', 'regulations', 'standards', 'frameworks'];
const RISK_RATINGS = ['high', 'medium', 'low'];
const NOTIFICATION_FREQUENCIES = ['immediate', 'daily', 'weekly'];

const STEPS = ['License', 'Institution', 'User Setup', 'Regulators', 'Doc Types', 'Confirm'];

export default function OnboardingPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableRegulators, setAvailableRegulators] = useState([]);
  const [completed, setCompleted] = useState(false);

  const [licenseKey, setLicenseKey] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');

  const [institution, setInstitution] = useState({
    legalName: '', address: '', contactPhone: '', contactEmail: '', ccoEmail: '',
  });

  const [authType, setAuthType] = useState('local');
  const [localAdmin, setLocalAdmin] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [ldapUrl, setLdapUrl] = useState('');

  const [selectedRegulators, setSelectedRegulators] = useState([]);
  const [regulatorSearch, setRegulatorSearch] = useState('');
  const [notificationFrequency, setNotificationFrequency] = useState('immediate');
  const [selectedDocTypes, setSelectedDocTypes] = useState([]);
  const [selectedRiskRatings, setSelectedRiskRatings] = useState(['high', 'medium']);
  const [webhookUrl, setWebhookUrl] = useState('');

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
        navigate('/dashboard', { replace: true });
        return;
      }
      setStep(resp.currentStep || 0);
      if (resp.legalName) setInstitution(prev => ({ ...prev, legalName: resp.legalName }));
      if (resp.authType) setAuthType(resp.authType);
      if (resp.subscribedRegulators) setSelectedRegulators(resp.subscribedRegulators);
      if (resp.subscribedDocumentTypes) setSelectedDocTypes(resp.subscribedDocumentTypes);
      if (resp.availableRegulators) setAvailableRegulators(resp.availableRegulators);
    } catch {
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  async function submit(path, data, nextStep) {
    setSubmitting(true);
    setError('');
    try {
      const resp = await data;
      setStep(resp.currentStep != null ? resp.currentStep : nextStep);
      if (resp.availableRegulators) setAvailableRegulators(resp.availableRegulators);
      if (nextStep === 6 && resp.onboardingCompleted) {
        setCompleted(true);
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
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
      { v: validateEmail(institution.ccoEmail), label: 'CCO email' },
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
        ccoEmail: institution.ccoEmail || undefined,
      }),
      2
    );
  }

  function handleUserSetup() {
    if (authType === 'local') {
      const checks = [
        { v: validateName(localAdmin.fullName), label: 'Full name' },
        { v: validateEmail(localAdmin.email), label: 'Email' },
        { v: validatePassword(localAdmin.password), label: 'Password' },
      ];
      const fail = checks.find(c => !c.v.valid);
      if (fail) { setError(fail.v.message); return; }
      if (localAdmin.password !== localAdmin.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }
    submit('userSetup',
      api.onboarding.userSetup(
        authType === 'local'
          ? { authType: 'local', localAdmin }
          : { authType: 'ldap', ldapConfig: { url: ldapUrl } }
      ),
      3
    );
  }

  function handleRegulators() {
    submit('regulators',
      api.onboarding.regulators({
        subscribedRegulators: selectedRegulators,
        notificationFrequency,
      }),
      4
    );
  }

  function handleDocumentTypes() {
    submit('documentTypes',
      api.onboarding.documentTypes({
        subscribedDocumentTypes: selectedDocTypes,
        notificationRiskRatings: selectedRiskRatings,
      }),
      5
    );
  }

  function handleConfirm() {
    submit('confirm',
      api.onboarding.confirm({ webhookUrl: webhookUrl || undefined }),
      6
    );
  }

  function getActiveStep() {
    if (step === 0) return 0;
    if (step === 1) return 1;
    if (step === 2) return 2;
    if (step === 3) return 3;
    if (step === 4) return 4;
    return 5;
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
              <Shield sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Welcome to Atheris</Typography>
              <Typography variant="body2" color="text.secondary">
                Set up your compliance intelligence workspace
              </Typography>
            </Box>

            <Stepper activeStep={getActiveStep()} alternativeLabel sx={{ mb: 4 }}>
              {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>{error}</Alert>}
            {completed && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Onboarding complete! Redirecting to dashboard...
              </Alert>
            )}

            {getActiveStep() === 0 && (
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

            {getActiveStep() === 1 && (
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
                <TextField fullWidth size="small" label="CCO Email" type="email"
                  value={institution.ccoEmail}
                  onChange={e => setInstitution(p => ({ ...p, ccoEmail: e.target.value }))}
                  sx={{ mb: 2 }} />
                <Button fullWidth variant="contained" size="large"
                  onClick={handleInstitution} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {getActiveStep() === 2 && (
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
                  <TextField fullWidth size="small" label="LDAP URL"
                    placeholder="ldap://dc01.example.com"
                    value={ldapUrl}
                    onChange={e => setLdapUrl(e.target.value)}
                    sx={{ mb: 2 }} />
                )}

                <Button fullWidth variant="contained" size="large"
                  onClick={handleUserSetup} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {getActiveStep() === 3 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select the regulators you want to monitor
                </Typography>
                <TextField fullWidth size="small" placeholder="Search by name or abbreviation..."
                  value={regulatorSearch}
                  onChange={e => setRegulatorSearch(e.target.value)}
                  sx={{ mb: 1.5 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">🔍</InputAdornment>,
                  }} />
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: 260 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Regulator</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Abbreviation</TableCell>
                        <TableCell padding="checkbox" sx={{ fontWeight: 600, textAlign: 'right' }}>Select</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableRegulators.filter(r =>
                        !regulatorSearch ||
                        r.name.toLowerCase().includes(regulatorSearch.toLowerCase()) ||
                        (r.abbreviation || '').toLowerCase().includes(regulatorSearch.toLowerCase())
                      ).map(r => (
                        <TableRow
                          key={r.regulatorId}
                          hover
                          selected={selectedRegulators.includes(r.regulatorId)}
                          onClick={() => {
                            setSelectedRegulators(prev =>
                              prev.includes(r.regulatorId)
                                ? prev.filter(id => id !== r.regulatorId)
                                : [...prev, r.regulatorId]
                            );
                          }}
                          sx={{ cursor: 'pointer' }}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.abbreviation}</TableCell>
                          <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>
                            <Checkbox
                              checked={selectedRegulators.includes(r.regulatorId)}
                              onChange={() => {}}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Notification Frequency</InputLabel>
                  <Select value={notificationFrequency}
                    onChange={e => setNotificationFrequency(e.target.value)}
                    label="Notification Frequency">
                    {NOTIFICATION_FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button fullWidth variant="contained" size="large"
                  onClick={handleRegulators} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {getActiveStep() === 4 && (
              <Box>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Document Types</InputLabel>
                  <Select multiple
                    value={selectedDocTypes}
                    onChange={e => setSelectedDocTypes(e.target.value)}
                    input={<OutlinedInput label="Document Types" />}
                    renderValue={selected => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map(t => <Chip key={t} label={t} size="small" />)}
                      </Box>
                    )}>
                    {DOCUMENT_TYPES.map(t => (
                      <MenuItem key={t} value={t}>
                        <Checkbox checked={selectedDocTypes.includes(t)} />
                        <ListItemText primary={t} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Risk Rating Notifications</InputLabel>
                  <Select multiple
                    value={selectedRiskRatings}
                    onChange={e => setSelectedRiskRatings(e.target.value)}
                    input={<OutlinedInput label="Risk Rating Notifications" />}
                    renderValue={selected => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map(r => <Chip key={r} label={r} size="small" color={r === 'high' ? 'error' : r === 'medium' ? 'warning' : 'default'} />)}
                      </Box>
                    )}>
                    {RISK_RATINGS.map(r => (
                      <MenuItem key={r} value={r}>
                        <Checkbox checked={selectedRiskRatings.includes(r)} />
                        <ListItemText primary={r} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button fullWidth variant="contained" size="large"
                  onClick={handleDocumentTypes} disabled={submitting}
                  sx={{ py: 1.2, fontWeight: 600 }}>
                  {submitting ? <CircularProgress size={20} /> : 'Save & Continue'}
                </Button>
              </Box>
            )}

            {getActiveStep() === 5 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  You're all set! Review your selections and complete setup.
                </Typography>
                <Button fullWidth variant="contained" size="large"
                  onClick={handleConfirm} disabled={submitting}
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
