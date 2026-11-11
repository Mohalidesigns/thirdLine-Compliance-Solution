import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Button, CircularProgress, Alert, TextField, Snackbar } from '@mui/material';
import {
  DetailHeader, DataCard, SectionTable, StateBadge, TL,
  ArrowLeftIcon, ShieldCheckIcon, XMarkIcon,
} from 'shared';
import { api } from '../services/api';
import { Field, FieldGrid } from '../components/detailKit';
import { EvidenceFileList } from '../components/evidence/EvidenceFiles';

function resultTone(result) {
  switch ((result || '').toLowerCase()) {
    case 'passed': return 'green';
    case 'partial': return 'amber';
    case 'failed': return 'red';
    default: return 'gray';
  }
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ControlTestReviewPage() {
  const navigate = useNavigate();
  const { testId } = useParams();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState(null);

  const { data: test, isLoading, error } = useQuery({
    queryKey: ['control-test', String(testId)],
    queryFn: ({ signal }) => api.controls.testDetail(Number(testId), { signal }),
    enabled: !!testId,
  });

  const { data: control } = useQuery({
    queryKey: ['controls', 'detail', String(test?.controlId)],
    queryFn: ({ signal }) => api.controls.detail(test.controlId, { signal }),
    enabled: !!test?.controlId,
  });

  const decided = useMemo(
    () => test?.reviewStatus === 'Accepted' || test?.reviewStatus === 'Rejected',
    [test]);

  async function decide(decision) {
    if (decision === 'Rejected' && !notes.trim()) {
      setSnack({ severity: 'warning', message: 'A reason is required when requesting changes.' });
      return;
    }
    setSaving(true);
    try {
      await api.controls.reviewTest(test.controlId, test.testId, decision, notes.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ['control-test', String(testId)] });
      await queryClient.invalidateQueries({ queryKey: ['controls'] });
      await queryClient.invalidateQueries({ queryKey: ['risks'] });
      await queryClient.invalidateQueries({ queryKey: ['obligations'] });
      setSnack({ severity: 'success', message: decision === 'Accepted' ? 'Test accepted.' : 'Changes requested.' });
    } catch (e) {
      setSnack({ severity: 'error', message: e.message || 'Failed to submit the review.' });
    } finally { setSaving(false); }
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error || !test) {
    return (
      <Box>
        <Button variant="outlined" startIcon={<ArrowLeftIcon size={16} />} onClick={() => navigate('/controls')} sx={{ mb: 2 }}>
          Back to Controls
        </Button>
        <Alert severity="error">{error?.message || 'Failed to load the control test.'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/controls')}
        backLabel="Back to Controls"
        title={`Review test: ${control?.name || test.controlNumber || 'Control'}`}
        status={test.reviewStatus}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <StateBadge tone={resultTone(test.result)} label={test.result || 'No result'} dot />
            <Typography variant="body2" color="text.secondary">
              {control?.controlNumber || `Control #${test.controlId}`}{control?.theme ? ` · ${control.theme}` : ''}
            </Typography>
          </Box>
        )}
      />

      <DataCard title="Submitted result" sx={{ mb: 3 }}>
        <FieldGrid min={200}>
          <Field label="Result" children={<StateBadge tone={resultTone(test.result)} label={test.result || '—'} dot />} />
          <Field label="Test date" value={formatDate(test.testDate)} />
          <Field label="Tested by" value={test.testedByName || '—'} />
          <Field label="Failure severity" value={test.failureSeverity} />
          <Field label="Review status" value={test.reviewStatus} />
          <Field label="Reviewed by" value={test.reviewedByName} />
        </FieldGrid>
        {test.resultDescription && (
          <Box sx={{ mt: 2.5 }}>
            <Field label="Notes" value={test.resultDescription} />
          </Box>
        )}
        {test.failureDetails && (
          <Box sx={{ mt: 2.5 }}>
            <Field label="Failure details" value={test.failureDetails} />
          </Box>
        )}
      </DataCard>

      <DataCard title="Evidence" sx={{ mb: 3 }}>
        <EvidenceFileList sourceType="control_test" sourceId={test.testId} emptyText="No evidence was attached to this test." />
      </DataCard>

      {!decided && (
        <DataCard title="Decision">
          <TextField fullWidth size="small" multiline minRows={2} label="Notes (required to request changes)"
            value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" color="warning" startIcon={<XMarkIcon size={16} />}
              disabled={saving} onClick={() => decide('Rejected')}>Request changes</Button>
            <Button variant="contained" color="success" startIcon={<ShieldCheckIcon size={16} />}
              disabled={saving} onClick={() => decide('Accepted')}>
              {saving ? 'Saving…' : 'Accept test'}
            </Button>
          </Box>
        </DataCard>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}