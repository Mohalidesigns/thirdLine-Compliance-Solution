import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert, Chip,
  CircularProgress, Divider, Grid, IconButton, List, ListItem, ListItemText,
  Stack,
} from '@mui/material';
import {
  VerifiedUser, Warning, Delete, UploadFile, CheckCircle, Schedule,
} from '@mui/icons-material';
import { publicApi } from '../services/api';

const SEV_COLOR = { Critical: 'error', High: 'error', Medium: 'warning', Low: 'success' };
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7FAFC', display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', py: { xs: 3, md: 8 }, px: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 720 }}>{children}</Box>
    </Box>
  );

  if (loading) {
    return shell(
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    );
  }

  if (loadError) {
    return shell(
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Warning sx={{ fontSize: 56, color: 'warning.main', mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>This link is not available</Typography>
          <Typography variant="body2" color="text.secondary">{loadError}</Typography>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return shell(
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Remediation submitted</Typography>
          <Typography variant="body2" color="text.secondary">
            Thank you. Your evidence has been submitted and is now awaiting review.
            You do not need to do anything further.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const closed = view.editable === false;

  return shell(
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="overline" color="text.secondary">
          {view.institutionName || 'Institution'}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Remediation request — Finding #{view.findingId}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please review the finding below and submit your remediation evidence.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {view.severity && (
            <Chip size="small" label={`${view.severity} severity`}
              color={SEV_COLOR[view.severity] || 'default'} sx={{ height: 22, borderRadius: '4px' }} />
          )}
          {view.findingType && (
            <Chip size="small" variant="outlined" label={view.findingType} sx={{ height: 22, borderRadius: '4px' }} />
          )}
          {view.controlNumber && (
            <Chip size="small" variant="outlined" label={view.controlNumber}
              sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace' }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5,
          bgcolor: 'grey.50', borderRadius: 1 }}>
          <Schedule fontSize="small" color={closed ? 'disabled' : 'action'} />
          <Typography variant="body2" fontWeight={600}>
            Deadline: {formatDate(view.remediationDeadline)}
          </Typography>
          {view.ownerName && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Owner: {view.ownerName}
            </Typography>
          )}
        </Box>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Finding</Typography>
        <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{view.description}</Typography>

        <Divider sx={{ mb: 2 }} />

        {closed ? (
          <Alert severity="info" icon={<VerifiedUser />}>
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
                <Button component="label" variant="outlined" startIcon={<UploadFile />}
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
                            <Delete fontSize="small" />
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
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}>
                    {submitting ? 'Submitting…' : 'Submit Remediation'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </form>
        )}
      </CardContent>
    </Card>
  );
}