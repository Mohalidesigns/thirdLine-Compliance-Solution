import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box, Typography, Paper, TextField, MenuItem, Button, Alert, CircularProgress, Stack, Divider,
} from '@mui/material';
import verityLogoLight from '../Verity/verity-logo-light.png';
import { publicApi } from '../services/api';

const TL = {
  bg: '#F7FAFC', gray50: '#F7FAFC', gray100: '#EDF2F7', gray300: '#CBD5E0', gray400: '#A0AEC0',
  gray500: '#718096', gray700: '#2D3748', gray800: '#1A202C', textPrimary: '#1A365D',
  cardShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const labelSx = { fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' };
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx';
const MAX_MB = 20;
const today = () => new Date().toISOString().split('T')[0];

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

async function apiControlTestView(token) {
  return publicApi.controlTestView(token);
}

export default function PublicControlTestPage() {
  const { token } = useParams();
  const [testDate, setTestDate] = useState(today());
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [failureDetails, setFailureDetails] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  const { data: view, isPending, isError, error, refetch } = useQuery({
    queryKey: ['public', 'control-test', token],
    queryFn: () => apiControlTestView(token),
  });

  const mutation = useMutation({
    mutationFn: (payload) => publicApi.controlTestSubmit(token, payload),
  });

  const shell = (children) => (
    <Box sx={{ minHeight: '100vh', bgcolor: TL.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      py: { xs: 3, md: 8 }, px: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 720 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box component="img" src={verityLogoLight} alt="Verity Compliance" sx={{ height: 44, width: 'auto' }} />
        </Box>
        {children}
      </Box>
    </Box>
  );

  if (isPending) return shell(<Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>);

  if (isError) {
    return shell(
      <Paper sx={{ p: 4, borderRadius: '12px', boxShadow: TL.cardShadow }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error?.message || 'This test link is not valid.'}
        </Alert>
      </Paper>
    );
  }

  const closed = view.editable === false;
  const showFailure = result === 'Failed' || result === 'Partial';

  function pickFile(list) {
    setFileError('');
    const f = list && list[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { setFileError(`"${f.name}" is larger than ${MAX_MB} MB.`); return; }
    setFile(f);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!result) return;
    mutation.mutate({
      testDate,
      result,
      notes: notes.trim() || undefined,
      failureDetails: showFailure && failureDetails.trim() ? failureDetails.trim() : undefined,
      file: file || undefined,
    });
  }

  return shell(
    <Paper sx={{ borderRadius: '12px', boxShadow: TL.cardShadow, overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, borderBottom: `1px solid ${TL.gray100}` }}>
        <Typography sx={labelSx}>{view.institutionName || 'Institution'}</Typography>
        <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.textPrimary, mt: 0.5 }}>
          Control test — {view.controlName}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mt: 0.5 }}>
          Record the result of testing this control and attach supporting evidence.
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2, md: 4 } }}>
        {/* Control details */}
        <Typography sx={{ ...labelSx, mb: 1.5 }}>Control details</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, mb: 3 }}>
          <Detail label="Control number" value={view.controlNumber} />
          <Detail label="Theme" value={view.theme} />
          <Detail label="Control type" value={view.controlType} />
          <Detail label="Frequency" value={view.frequency} />
          <Detail label="Act / Regulation" value={view.actName} />
          <Detail label="Regulator" value={view.regulator} />
          <Detail label="Responsible person" value={view.responsiblePerson} />
          <Detail label="Owner" value={view.ownerName} />
          <Detail label="Due date" value={formatDate(view.dueDate)} />
          <Detail label="Last test" value={view.lastTestResult} />
          <Detail label="Last test date" value={formatDate(view.lastTestDate)} />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Detail label="What it does" value={view.whatItDoes} />
          <Box sx={{ mt: 2 }}><Detail label="How it is tested" value={view.howTested} /></Box>
          <Box sx={{ mt: 2 }}><Detail label="Regulatory requirement" value={view.regulatoryRequirement} /></Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {mutation.isSuccess ? (
          <Alert severity="success">Your test result has been recorded and is being reviewed.</Alert>
        ) : closed ? (
          <Alert severity="info">
            {view.dueDate ? 'This control is not active.' : 'This control has no test scheduled right now.'}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField label="Test date" type="date" fullWidth required
                InputLabelProps={{ shrink: true }} inputProps={{ max: today() }}
                value={testDate} onChange={(e) => setTestDate(e.target.value)} />

              <TextField label="Result" select fullWidth required
                value={result} onChange={(e) => setResult(e.target.value)}>
                <MenuItem value="Passed">Passed</MenuItem>
                <MenuItem value="Failed">Failed</MenuItem>
                <MenuItem value="Partial">Partial</MenuItem>
              </TextField>

              <TextField label="Notes" fullWidth multiline minRows={3}
                placeholder="Describe how the control was tested and what you observed."
                value={notes} onChange={(e) => setNotes(e.target.value)} />

              {showFailure && (
                <TextField label="Failure details" fullWidth multiline minRows={3} required
                  placeholder="Describe what failed and the impact."
                  value={failureDetails} onChange={(e) => setFailureDetails(e.target.value)} />
              )}

              <Box>
                <Typography sx={{ ...labelSx, mb: 0.75 }}>Evidence</Typography>
                <Button component="label" variant="outlined">
                  Attach evidence (PDF, PNG, JPG, XLSX · max {MAX_MB} MB)
                  <input hidden type="file" accept={ACCEPT}
                    onChange={(e) => { pickFile(e.target.files); e.target.value = ''; }} />
                </Button>
                {fileError && <Alert severity="warning" sx={{ mt: 1 }}>{fileError}</Alert>}
                {file && (
                  <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, mt: 1 }}>{file.name}</Typography>
                )}
              </Box>

              {mutation.isError && <Alert severity="error">{mutation.error?.message || 'Submission failed.'}</Alert>}

              <Stack direction="row" justifyContent="flex-end">
                <Button type="submit" variant="contained" disabled={mutation.isPending || !result}
                  startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}>
                  {mutation.isPending ? 'Submitting…' : 'Submit test result'}
                </Button>
              </Stack>
            </Stack>
          </form>
        )}
      </Box>
    </Paper>
  );
}
