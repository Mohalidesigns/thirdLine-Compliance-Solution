import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Alert, Chip, CircularProgress, Grid,
  Stack, List, ListItem, ListItemText, IconButton, ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import {
  StatusBadge, TL,
  ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon, TrashIcon, ArrowUpTrayIcon,
} from 'shared';
import verityLogoLight from '../Verity/verity-logo-light.png';
import { publicApi } from '../services/api';

const labelSx = { fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' };
const MAX_MB = 20;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx';

function TLCard({ children, sx }) {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow, overflow: 'hidden', ...sx }}>
      {children}
    </Box>
  );
}

function Notice({ icon, tone, title, children }) {
  return (
    <TLCard sx={{ textAlign: 'center', px: 3, py: 6 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: '12px', mx: 'auto', mb: 2, bgcolor: tone.tile, color: tone.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: TL.gray800, mb: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, maxWidth: 460, mx: 'auto' }}>{children}</Typography>
    </TLCard>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={labelSx}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, wordBreak: 'break-word', mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

function deadlineRule(view) {
  if (view.deadlineMode === 'MANUAL') return 'Set per event (you provide the due date)';
  if (view.deadlineMode === 'OFFSET' && view.deadlineDays) {
    const unit = view.deadlineUnit === 'WORKING' ? 'working' : 'calendar';
    return `Within ${view.deadlineDays} ${unit} day${view.deadlineDays === 1 ? '' : 's'} of the event`;
  }
  if (view.deadlineText) return view.deadlineText;
  return null;
}

export default function PublicReturnUploadPage() {
  const { token } = useParams();
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState('file');           // 'file' | 'reference'
  const [triggerDate, setTriggerDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    publicApi.returnUploadView(token)
      .then(setView)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function pickFile(list) {
    setFileError('');
    const f = list && list[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { setFileError(`"${f.name}" is larger than ${MAX_MB} MB.`); return; }
    setFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    if (!triggerDate) { setSubmitError('The event (trigger) date is required.'); return; }
    if (mode === 'reference' && !reference.trim()) { setSubmitError('Provide an evidence reference.'); return; }
    if (mode === 'file' && !file) { setSubmitError('Attach an evidence file.'); return; }
    if (view.deadlineMode === 'MANUAL' && !dueDate) { setSubmitError('This return requires a due date.'); return; }
    setSubmitting(true);
    try {
      await publicApi.returnUploadSubmit(token, {
        triggerDate,
        reference: mode === 'reference' ? reference.trim() : undefined,
        dueDate: view.deadlineMode === 'MANUAL' ? dueDate : undefined,
        file: mode === 'file' ? file : undefined,
      });
      setDone(true);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children) => (
    <Box sx={{ minHeight: '100vh', bgcolor: TL.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      py: { xs: 3, md: 8 }, px: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 760 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box component="img" src={verityLogoLight} alt="Verity Compliance" sx={{ height: 44, width: 'auto' }} />
        </Box>
        {children}
      </Box>
    </Box>
  );

  if (loading) return shell(<Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>);

  if (loadError) {
    return shell(
      <Notice icon={<ExclamationTriangleIcon size={28} />} tone={{ tile: '#FFF7ED', fg: '#C2410C' }} title="This link is not available">
        {loadError}
      </Notice>
    );
  }

  if (done) {
    return shell(
      <Notice icon={<CheckCircleIcon size={28} />} tone={{ tile: '#F0FDF4', fg: '#15803D' }} title="Event filing recorded">
        Thank you. The event filing has been recorded and the compliance team has been notified.
        You do not need to do anything further.
      </Notice>
    );
  }

  const closed = view.editable === false;

  return shell(
    <TLCard>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, borderBottom: `1px solid ${TL.gray100}` }}>
        <Typography sx={labelSx}>{view.institutionName || 'Institution'}</Typography>
        <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.textPrimary, mt: 0.5 }}>
          Event filing — {view.returnName}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mt: 0.5 }}>
          Record an occurrence for this event-driven return and attach the supporting evidence.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          {view.regulator && <Chip size="small" variant="outlined" label={view.regulator} />}
          {view.actName && <Chip size="small" variant="outlined" label={view.actName} />}
          {view.frequency && <Chip size="small" variant="outlined" label={view.frequency} />}
          {view.triggerLabel && <StatusBadge dot label={view.triggerLabel} tone="blue" />}
        </Box>
      </Box>

      <Box sx={{ p: { xs: 2, md: 4 } }}>
        {/* Return + regulator details */}
        <Typography sx={{ ...labelSx, mb: 1.5 }}>Return details</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, mb: 3 }}>
          <Detail label="Return" value={view.returnName} />
          <Detail label="Regulator" value={view.regulator} />
          <Detail label="Act / Regulation" value={view.actName} />
          <Detail label="Frequency" value={view.frequency || view.frequencyType} />
          <Detail label="Event trigger" value={view.triggerLabel} />
          <Detail label="Deadline rule" value={deadlineRule(view)} />
          <Detail label="Responsible unit" value={view.responsibleUnit} />
          <Detail label="Responsible person" value={view.responsiblePerson} />
          <Detail label="Return owner" value={view.ownerName} />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {closed ? (
          <Alert severity="info" icon={<ShieldCheckIcon size={20} />}>
            This return is not accepting event filings right now. Please contact the compliance team.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Event (trigger) date" type="date" fullWidth required
                  InputLabelProps={{ shrink: true }} inputProps={{ max: new Date().toISOString().split('T')[0] }}
                  value={triggerDate} onChange={(e) => setTriggerDate(e.target.value)} />
              </Grid>
              {view.deadlineMode === 'MANUAL' && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Due date" type="date" fullWidth required
                    InputLabelProps={{ shrink: true }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Typography sx={{ ...labelSx, mb: 0.75 }}>Evidence</Typography>
                <ToggleButtonGroup exclusive size="small" value={mode} sx={{ mb: 1.5 }}
                  onChange={(_, v) => { if (v) { setMode(v); setFileError(''); setSubmitError(''); } }}>
                  <ToggleButton value="file">Attach a file</ToggleButton>
                  <ToggleButton value="reference">Enter a reference</ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {mode === 'file' ? (
                <Grid size={{ xs: 12 }}>
                  <Button component="label" variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />}>
                    Attach evidence (PDF, PNG, JPG, DOCX, XLSX · max {MAX_MB} MB)
                    <input hidden type="file" accept={ACCEPT}
                      onChange={(e) => { pickFile(e.target.files); e.target.value = ''; }} />
                  </Button>
                  {fileError && <Alert severity="warning" sx={{ mt: 1 }}>{fileError}</Alert>}
                  {file && (
                    <List dense sx={{ mt: 1, maxWidth: 480 }}>
                      <ListItem divider secondaryAction={
                        <IconButton edge="end" size="small" onClick={() => setFile(null)}><TrashIcon size={16} /></IconButton>
                      }>
                        <ListItemText primary={file.name} secondary={`${(file.size / 1024 / 1024).toFixed(1)} MB`} />
                      </ListItem>
                    </List>
                  )}
                </Grid>
              ) : (
                <Grid size={{ xs: 12 }}>
                  <TextField label="Evidence reference" fullWidth multiline minRows={2}
                    placeholder="e.g. the filing portal reference, or a short description of the occurrence"
                    value={reference} onChange={(e) => setReference(e.target.value)} />
                </Grid>
              )}

              {submitError && <Grid size={{ xs: 12 }}><Alert severity="error">{submitError}</Alert></Grid>}

              <Grid size={{ xs: 12 }}>
                <Stack direction="row" justifyContent="flex-end">
                  <Button type="submit" variant="contained" disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon size={16} />}>
                    {submitting ? 'Submitting…' : 'Record event filing'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </form>
        )}
      </Box>
    </TLCard>
  );
}
