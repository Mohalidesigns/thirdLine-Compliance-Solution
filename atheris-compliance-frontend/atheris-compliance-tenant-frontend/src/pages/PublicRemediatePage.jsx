import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Alert, Chip,
  CircularProgress, Grid, IconButton, List, ListItem, ListItemText,
  Stack,
} from '@mui/material';
import {
  StatusBadge, TL, riskTone,
  ShieldCheckIcon, ExclamationTriangleIcon, TrashIcon, ArrowUpTrayIcon, CheckCircleIcon, ClockIcon,
} from 'shared';
import { publicApi } from '../services/api';

const labelSx = { fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' };

/** Thirdline card (white, 12px radius, gray-100 hairline, shadow-sm). */
function TLCard({ children, sx }) {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow, overflow: 'hidden', ...sx }}>
      {children}
    </Box>
  );
}

/** Centered status message (link unavailable / submitted). */
function Notice({ icon, tone, title, children }) {
  return (
    <TLCard sx={{ textAlign: 'center', px: 3, py: 6 }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: '12px', mx: 'auto', mb: 2, bgcolor: tone.tile, color: tone.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: TL.gray800, mb: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, maxWidth: 440, mx: 'auto' }}>{children}</Typography>
    </TLCard>
  );
}
const MAX_FILES = 5;
const MAX_MB = 20;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PublicRemediatePage() {
  const { token } = useParams();
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    publicApi.remediationView(token)
      .then(setView)
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function addFiles(list) {
    setFileError('');
    const incoming = Array.from(list || []);
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) { setFileError(`You can attach at most ${MAX_FILES} files.`); break; }
      if (f.size > MAX_MB * 1024 * 1024) { setFileError(`"${f.name}" is larger than ${MAX_MB} MB and was skipped.`); continue; }
      if (next.some(x => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    setFiles(next);
  }

  function removeFile(i) {
    setFiles(f => f.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await publicApi.remediationSubmit(token, { notes, files });
      setDone(true);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children) => (
    <Box sx={{ minHeight: '100vh', bgcolor: TL.bg, display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', py: { xs: 3, md: 8 }, px: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 720 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '8px', bgcolor: TL.primary, color: TL.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheckIcon size={20} />
          </Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: TL.primary }}>Atheris</Typography>
        </Box>
        {children}
      </Box>
    </Box>
  );

  if (loading) {
    return shell(
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    );
  }

  if (loadError) {
    return shell(
      <Notice icon={<ExclamationTriangleIcon size={28} />} tone={{ tile: '#FFF7ED', fg: '#C2410C' }} title="This link is not available">
        {loadError}
      </Notice>
    );
  }

  if (done) {
    return shell(
      <Notice icon={<CheckCircleIcon size={28} />} tone={{ tile: '#F0FDF4', fg: '#15803D' }} title="Remediation submitted">
        Thank you. Your evidence has been submitted and is now awaiting review.
        You do not need to do anything further.
      </Notice>
    );
  }

  const closed = view.editable === false;

  return shell(
    <TLCard>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, borderBottom: `1px solid ${TL.gray100}` }}>
        <Typography sx={labelSx}>
          {view.institutionName || 'Institution'}
        </Typography>
        <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.textPrimary, mt: 0.5 }}>
          Remediation request — Finding #{view.findingId}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mt: 0.5 }}>
          Please review the finding below and submit your remediation evidence.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          {view.severity && (
            <StatusBadge dot label={`${view.severity} severity`} tone={riskTone(view.severity)} />
          )}
          {view.findingType && (
            <Chip size="small" variant="outlined" label={view.findingType} />
          )}
          {view.controlNumber && (
            <Chip size="small" variant="outlined" label={view.controlNumber}
              sx={{ fontFamily: TL.mono }} />
          )}
        </Box>
      </Box>

      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, p: 1.5,
          bgcolor: TL.gray50, border: `1px solid ${TL.gray100}`, borderRadius: '8px', flexWrap: 'wrap' }}>
          <ClockIcon size={16} sx={{ color: closed ? TL.gray300 : TL.gray500 }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>
            Deadline: {formatDate(view.remediationDeadline)}
          </Typography>
          {view.ownerName && (
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, ml: 'auto' }}>
              Owner: {view.ownerName}
            </Typography>
          )}
        </Box>

        <Typography sx={{ ...labelSx, mb: 0.75 }}>Finding</Typography>
        <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, mb: 3, whiteSpace: 'pre-wrap' }}>{view.description}</Typography>

        {closed ? (
          <Alert severity="info" icon={<ShieldCheckIcon size={20} />}>
            This finding has already been resolved — no further action is needed.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField label="Remediation notes" fullWidth multiline minRows={4}
                  placeholder="Describe the action you took to remediate this finding."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Button component="label" variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />}
                  disabled={files.length >= MAX_FILES}>
                  Attach evidence (PDF, PNG, JPG, DOCX, XLSX · max {MAX_FILES} files · {MAX_MB} MB each)
                  <input hidden type="file" multiple accept={ACCEPT}
                    onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
                </Button>
                {fileError && <Alert severity="warning" sx={{ mt: 1 }}>{fileError}</Alert>}
                {files.length > 0 && (
                  <List dense sx={{ mt: 1 }}>
                    {files.map((f, i) => (
                      <ListItem key={`${f.name}-${i}`} divider
                        secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => removeFile(i)}>
                            <TrashIcon size={16} />
                          </IconButton>
                        }>
                        <ListItemText primary={f.name}
                          secondary={`${(f.size / 1024 / 1024).toFixed(1)} MB`} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Grid>

              {submitError && (
                <Grid size={{ xs: 12 }}><Alert severity="error">{submitError}</Alert></Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Stack direction="row" justifyContent="flex-end">
                  <Button type="submit" variant="contained" disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon size={16} />}>
                    {submitting ? 'Submitting…' : 'Submit Remediation'}
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