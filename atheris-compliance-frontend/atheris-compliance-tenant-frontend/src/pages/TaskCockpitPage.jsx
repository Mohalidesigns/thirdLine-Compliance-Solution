import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import { PageHeader, DataCard, StatusBadge } from 'shared';
import { api } from '../services/api';
import RecordTestDialog from '../components/modals/RecordTestDialog';
import LinkControlsPicker from '../components/modals/LinkControlsPicker';
import OwnerPicker from '../components/org/OwnerPicker';
import WorkflowTimeline from '../components/tasks/WorkflowTimeline';

const AUDIT_TYPES = {
  CONTROL: ['control', 'control_test'],
  FINDING: ['finding'],
  RETURN: ['return', 'return_instance'],
  OBLIGATION: ['obligation'],
};
const VALID_SUBJECTS = Object.keys(AUDIT_TYPES);
const PRIORITY_RANK = { OVERDUE: 0, HIGH: 1, MEDIUM: 2, SOON: 3, LOW: 4 };

function pickPrimary(tasks) {
  if (!tasks.length) return null;
  return [...tasks].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))[0];
}

export default function TaskCockpitPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const subjectType = (params.get('subjectType') || '').toUpperCase();
  const subjectId = params.get('subjectId') ? Number(params.get('subjectId')) : null;
  const actionParam = params.get('action');
  const back = params.get('back');
  const backTo = back && back.startsWith('/') ? back : '/tasks';
  const valid = VALID_SUBJECTS.includes(subjectType) && subjectId != null;

  const [modal, setModal] = useState(null);
  const [snack, setSnack] = useState('');
  const [autoOpened, setAutoOpened] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'cockpit', subjectType, String(subjectId)],
    queryFn: () => api.tasks.center({ assignee: 'all', subjectType, subjectId, size: 50 }),
    enabled: valid,
  });
  const tasks = tasksQuery.data?.content || [];
  const primary = useMemo(() => pickPrimary(tasks), [tasks]);

  const done = (msg) => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['audit'] });
    qc.invalidateQueries({ queryKey: ['controls'] });
    qc.invalidateQueries({ queryKey: ['findings'] });
    qc.invalidateQueries({ queryKey: ['returns'] });
    qc.invalidateQueries({ queryKey: ['obligations'] });
    setModal(null);
    setSnack(msg);
  };

  const startMut = useMutation({
    mutationFn: (instanceId) => api.returns.advance(instanceId, {}),
    onSuccess: () => done('Filing started — the responsible person can submit the data now.'),
    onError: (e) => setSnack(e.message || 'Could not start the filing.'),
  });

  useEffect(() => {
    if (autoOpened || !primary || !actionParam) return;
    if (actionParam === 'review' && primary.actionType === 'OPEN'
        && (primary.type === 'CONTROL_TEST_AWAITING_REVIEW' || primary.type === 'FINDING_AWAITING_REVIEW')) {
      setModal('review');
      setAutoOpened(true);
    }
  }, [primary, actionParam, autoOpened]);

  if (!valid) {
    return <Navigate to={backTo} replace />;
  }

  const linkPath = primary?.linkPath
    ? `${primary.linkPath}${primary.linkPath.includes('?') ? '&' : '?'}from=tasks`
    : null;

  const actionFor = (t) => {
    if (!t) return null;
    switch (t.type) {
      case 'CONTROL_TEST_ASSIGN':
        return { label: 'Assign tester', run: () => setModal('assign') };
      case 'CONTROL_TEST_DUE':
      case 'CONTROL_TEST_OVERDUE':
      case 'CONTROL_TEST_FAILED':
        return { label: 'Record test', run: () => setModal('record') };
      case 'CONTROL_TEST_AWAITING_REVIEW':
        return { label: 'Review test', run: () => setModal('review') };
      case 'RETURN_START_READY':
        return { label: 'Start filing', run: () => startMut.mutate(t.sourceRef?.instanceId), busy: startMut.isPending };
      case 'RETURN_DATA_REVIEW':
      case 'RETURN_REPORT_REVIEW':
        return { label: 'Open the filing', link: true };
      case 'FINDING_UNASSIGNED':
      case 'FINDING_GAP_UNRESOLVED':
        return { label: t.type === 'FINDING_UNASSIGNED' ? 'Assign owner' : 'Link control', run: () => setModal(t.type === 'FINDING_UNASSIGNED' ? 'assign' : 'link') };
      case 'FINDING_AWAITING_REVIEW':
        return { label: 'Review remediation', run: () => setModal('review') };
      case 'FINDING_OVERDUE':
      case 'FINDING_DUE_SOON':
        return { label: 'Record remediation', run: () => setModal('remediate') };
      case 'OBLIGATION_NO_CONTROL':
        return { label: 'Link control', run: () => setModal('link') };
      default:
        return null;
    }
  };
  const action = actionFor(primary);

  return (
    <Box>
      <PageHeader
        title={primary?.title || 'Task'}
        subtitle={primary?.caption || 'Focused view of the work behind this task.'}
        onBack={() => navigate(backTo)}
        backLabel="Back to Tasks"
        actions={linkPath ? (
          <Button variant="outlined" onClick={() => navigate(linkPath)}>Open full detail →</Button>
        ) : null}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {primary?.category && <Chip size="small" variant="outlined" label={primary.category} />}
          {primary?.priority && <StatusBadge dot label={primary.priority} tone={primary.priority === 'OVERDUE' ? 'red' : primary.priority === 'HIGH' ? 'orange' : 'gray'} />}
          {primary?.stage && <Chip size="small" variant="outlined" label={primary.stage} />}
          {primary?.regulator && <Chip size="small" variant="outlined" label={primary.regulator} />}
          {primary?.responsiblePerson && <Chip size="small" variant="outlined" label={primary.responsiblePerson} />}
        </Stack>
      </PageHeader>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
        <DataCard title="The task">
          {action && (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {action.link
                ? <Button variant="contained" onClick={() => navigate(linkPath)}>{action.label}</Button>
                : <Button variant="contained" disabled={action.busy} onClick={action.run}>{action.label}</Button>}
            </Stack>
          )}
          {!action && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No action is required here right now — use “Open full detail” to review the record.
            </Typography>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
            <Field label="Due" value={primary?.dueDate ? `${primary.dueDate}${primary.daysRemaining != null ? ` (${primary.daysRemaining}d)` : ''}` : '—'} />
            <Field label="Responsible" value={primary?.responsiblePerson || '—'} />
            <Field label="Department" value={primary?.department || '—'} />
            <Field label="Area of focus" value={primary?.areaOfFocus || '—'} />
            <Field label="Escalation" value={primary?.escalationLevel != null ? `Level ${primary.escalationLevel}` : '—'} />
            <Field label="Type" value={primary?.type || '—'} />
          </Box>
        </DataCard>

        <DataCard title="Related tasks">
          {tasks.length <= 1 && <Typography variant="body2" color="text.secondary">This is the only task for this item.</Typography>}
          {tasks.length > 1 && tasks.map((t) => (
            <Box key={t.key} sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.actionLabel || t.type}</Typography>
              <Typography variant="caption" color="text.secondary">{t.priority}{t.dueDate ? ` · due ${t.dueDate}` : ''}</Typography>
            </Box>
          ))}
        </DataCard>
      </Box>

      <Box sx={{ mt: 3 }}>
        <DataCard title="Workflow & audit">
          <WorkflowTimeline subjectTypes={AUDIT_TYPES[subjectType]} subjectId={subjectId} />
        </DataCard>
      </Box>

      {modal === 'record' && primary?.sourceRef?.controlId != null && (
        <RecordTestDialog open controlId={primary.sourceRef.controlId}
          onClose={() => setModal(null)} onSaved={() => done('Test recorded.')} onSnackbar={setSnack} />
      )}
      {modal === 'assign' && <AssignDialog task={primary} onClose={() => setModal(null)} onDone={done} onError={setSnack} />}
      {modal === 'review' && <ReviewDialog task={primary} onClose={() => setModal(null)} onDone={done} onError={setSnack} />}
      {modal === 'remediate' && (
        <RemediateDialog findingId={primary?.sourceRef?.findingId} onClose={() => setModal(null)} onDone={done} onError={setSnack} />
      )}
      {modal === 'link' && (
        <LinkControlsPicker open initialIds={[]} onClose={() => setModal(null)}
          onSave={(ids) => linkControls(primary, ids, done, setSnack, setModal)} />
      )}

      <Snackbar open={!!snack} autoHideDuration={3200} onClose={() => setSnack('')}>
        <Alert severity="info" variant="filled" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

function linkControls(task, ids, done, onError, setModal) {
  const obligationId = task?.sourceRef?.obligationId;
  if (!obligationId) { onError('No obligation on this task.'); return; }
  api.obligations.linkControls(obligationId, { linkedControlIds: ids, changeReason: 'Linked from the task centre' })
    .then(() => done('Controls linked.'))
    .catch((e) => onError(e.message || 'Could not link controls.'));
}

function Field({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function AssignDialog({ task, onClose, onDone, onError }) {
  const [ownerId, setOwnerId] = useState(null);
  const isControl = task?.category === 'CONTROLS';
  const saving = useMutation({
    mutationFn: () => isControl
      ? api.controls.assignTester(task.sourceRef.controlId, ownerId)
      : api.findings.assign(task.sourceRef.findingId, { assignedToOwnerId: ownerId }),
    onSuccess: () => onDone(isControl ? 'Tester set.' : 'Remediation owner set.'),
    onError: (e) => onError(e.message || 'Could not assign.'),
  });
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isControl ? 'Assign tester' : 'Assign remediation owner'}</DialogTitle>
      <DialogContent>
        <OwnerPicker value={ownerId} onChange={setOwnerId} label={isControl ? 'Tester' : 'Remediation owner'} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={ownerId == null || saving.isPending} onClick={() => saving.mutate()}>Assign</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReviewDialog({ task, onClose, onDone, onError }) {
  const [notes, setNotes] = useState('');
  const isControl = task?.type === 'CONTROL_TEST_AWAITING_REVIEW';
  const saving = useMutation({
    mutationFn: (decision) => isControl
      ? api.controls.reviewTest(task.sourceRef.controlId, task.sourceRef.testId, decision, notes)
      : api.findings.review(task.sourceRef.findingId, decision, notes),
    onSuccess: (_r, decision) => onDone(decision === 'ACCEPT' ? 'Accepted.' : 'Changes requested.'),
    onError: (e) => onError(e.message || 'Could not review.'),
  });
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isControl ? 'Review the control test' : 'Review the remediation'}</DialogTitle>
      <DialogContent>
        <TextField fullWidth multiline minRows={2} size="small" label="Notes (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button disabled={saving.isPending} onClick={() => saving.mutate('REJECT')}>Request changes</Button>
        <Button variant="contained" disabled={saving.isPending} onClick={() => saving.mutate('ACCEPT')}>Accept</Button>
      </DialogActions>
    </Dialog>
  );
}

function RemediateDialog({ findingId, onClose, onDone, onError }) {
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const saving = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('evidenceName', name.trim());
      if (notes.trim()) fd.append('notes', notes.trim());
      return api.findings.remediate(findingId, fd);
    },
    onSuccess: () => onDone('Remediation recorded.'),
    onError: (e) => onError(e.message || 'Could not record remediation.'),
  });
  const ready = files.length > 0 && name.trim();
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record remediation</DialogTitle>
      <DialogContent>
        <Button component="label" variant="outlined" sx={{ mb: 2 }}>
          {files.length ? `${files.length} file(s) attached` : 'Attach evidence'}
          <input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </Button>
        <TextField fullWidth required size="small" label="Remediation evidence title" value={name}
          onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={2} size="small" label="Notes (optional)" value={notes}
          onChange={(e) => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!ready || saving.isPending} onClick={() => saving.mutate()}>Record</Button>
      </DialogActions>
    </Dialog>
  );
}
