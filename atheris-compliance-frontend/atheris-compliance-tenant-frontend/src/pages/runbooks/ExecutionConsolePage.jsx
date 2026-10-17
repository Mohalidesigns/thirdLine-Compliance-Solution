import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Snackbar, Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UndoIcon from '@mui/icons-material/Undo';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import { PageHeader, StatusBadge, TL } from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import StepList from '../../components/runbooks/execution/StepList';
import StepCard from '../../components/runbooks/execution/StepCard';
import ConsoleSidePanel from '../../components/runbooks/execution/ConsoleSidePanel';
import {
  CaptureEvidenceDialog, FailStepDialog, PassStepDialog, SkipStepDialog, VerifyStepDialog,
} from '../../components/runbooks/execution/StepDialogs';
import {
  EscalateDialog, PreflightDialog, ReasonDialog, RollbackDialog,
} from '../../components/runbooks/execution/ExecutionDialogs';
import {
  errorMessage, execTone, executionKey, formatDateTime, isActiveExecution, isTerminalStep, orderedSteps,
  outcomeTone, statusLabel, TERMINAL_EXECUTION_STATUSES, useApplyExecution, WORKABLE_EXECUTION_STATUSES,
} from '../../components/runbooks/execution/executionUtils';
import { EXECUTOR_ROLES } from './runbookConstants';

const PREFLIGHT_STATUSES = ['NOT_STARTED', 'PREFLIGHT'];

export default function ExecutionConsolePage() {
  const { execId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const apply = useApplyExecution(execId);

  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState(null); // { type, stepExecId? }
  const [snack, setSnack] = useState(null); // { msg, severity }
  const [ackingId, setAckingId] = useState(null);

  const query = useQuery({
    queryKey: executionKey(execId),
    queryFn: ({ signal }) => api.runbooks.executions.get(execId, { signal }),
    // Picks up scheduler-raised SLA escalations; the countdowns themselves tick locally.
    refetchInterval: 60_000,
  });
  const exec = query.data;
  const steps = orderedSteps(exec?.steps || []);
  const autoStep = steps.find((s) => !isTerminalStep(s.status)) || steps[steps.length - 1];
  const selected = steps.find((s) => s.stepExecId === selectedId) || autoStep;
  const selectedIdx = selected ? steps.indexOf(selected) : -1;

  const status = exec?.status;
  const isExecutor = EXECUTOR_ROLES.includes(user?.role);
  const workable = WORKABLE_EXECUTION_STATUSES.includes(status);
  // Mirrors the backend: procedure steps run only while IN_PROGRESS, rollback steps only while ROLLING_BACK
  // (an ESCALATED run is halted until someone resumes, rolls back or aborts it).
  const canAct = isExecutor && workable
    && (selected?.rollback ? status === 'ROLLING_BACK' : status === 'IN_PROGRESS');
  const needsPreflight = !!exec && PREFLIGHT_STATUSES.includes(status) && !exec.preflightCompletedAt;
  const showPreflight = needsPreflight && isExecutor;
  const finished = TERMINAL_EXECUTION_STATUSES.includes(status) || status === 'PENDING_SIGNOFF';

  const toast = (msg, severity = 'success') => setSnack({ msg, severity });
  const dialogStep = dialog?.stepExecId != null ? steps.find((s) => s.stepExecId === dialog.stepExecId) : null;

  // Runs a mutation that returns ExecutionDetailDto. Errors propagate to the calling dialog.
  const run = async (fn, msg, { advance = false } = {}) => {
    const data = apply(await fn());
    if (advance) setSelectedId(null);
    if (msg) toast(msg);
    return data;
  };
  // Direct (dialog-less) actions surface errors in the snackbar.
  const runDirect = async (fn, msg) => {
    try { await run(fn, msg); } catch (e) { toast(errorMessage(e), 'error'); }
  };

  const goStep = (delta) => {
    const next = steps[selectedIdx + delta];
    if (next) setSelectedId(next.stepExecId);
  };

  const onStepAction = (type) => {
    if (!selected) return;
    if (type === 'start') {
      runDirect(() => api.runbooks.executions.startStep(execId, selected.stepExecId), `Step ${selected.stepCode || ''} started`);
      return;
    }
    setDialog({ type, stepExecId: selected.stepExecId });
  };

  // Keyboard: N = next step, P = pass (when allowed). Ignored while typing or a dialog is open.
  useEffect(() => {
    const onKey = (e) => {
      if (dialog || showPreflight || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (document.querySelector('.MuiDialog-root')) return;
      const k = e.key.toLowerCase();
      if (k === 'n') {
        const next = steps[selectedIdx + 1];
        if (next) { e.preventDefault(); setSelectedId(next.stepExecId); }
      } else if (k === 'p') {
        if (canAct && selected?.status === 'IN_PROGRESS' && selected.mandatoryEvidenceSatisfied) {
          e.preventDefault();
          setDialog({ type: 'pass', stepExecId: selected.stepExecId });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, showPreflight, steps, selectedIdx, selected, canAct]);

  if (query.isPending) {
    return <><RunbooksNav /><Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box></>;
  }
  if (query.error || !exec) {
    return (
      <>
        <RunbooksNav />
        <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(query.error, 'Failed to load execution.')}</Alert>
        <Button onClick={() => navigate('/runbooks/executions')}>Back to executions</Button>
      </>
    );
  }

  const done = steps.filter((s) => isTerminalStep(s.status)).length;
  const stepApi = (fn) => (payload) => fn(execId, dialog.stepExecId, payload);

  return (
    <Box sx={{ pb: 10 }}>
      <PageHeader
        title={exec.executionRef || `Execution #${exec.executionId}`}
        subtitle={(
          <>
            <Box component="span" sx={{ fontFamily: TL.mono }}>{exec.runbookCode}</Box> {exec.runbookTitle}
            {exec.versionNumber != null ? ` · v${exec.versionNumber}` : ''}
            {exec.operatorName ? ` · operator ${exec.operatorName}` : ''}
          </>
        )}
        onBack={() => navigate('/runbooks/executions')}
        backLabel="Executions"
        actions={finished ? (
          <Button variant="contained" startIcon={<AssignmentTurnedInOutlinedIcon />}
            onClick={() => navigate(`/runbooks/executions/${execId}/summary`)}>
            View summary
          </Button>
        ) : null}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge label={statusLabel(status)} tone={execTone(status)} />
          {exec.outcome && <StatusBadge label={`Outcome ${exec.outcome}`} tone={outcomeTone(exec.outcome)} />}
          {exec.overdue && <StatusBadge label="Overdue" tone="red" />}
          <Typography variant="caption" color="text.secondary">
            {done}/{steps.length} steps · {exec.evidenceCount ?? 0} evidence · started {formatDateTime(exec.startedAt)}
          </Typography>
        </Box>
      </PageHeader>

      <RunbooksNav />

      {needsPreflight && !isExecutor && (
        <Alert severity="info" sx={{ mb: 2 }}>Awaiting pre-flight confirmation by the operator.</Alert>
      )}
      {!isExecutor && (
        <Alert severity="info" sx={{ mb: 2 }}>Read-only view — your role cannot execute runbook steps.</Alert>
      )}
      {status === 'PAUSED' && <Alert severity="warning" sx={{ mb: 2 }}>Execution is paused. Resume to continue working steps.</Alert>}
      {status === 'ROLLING_BACK' && <Alert severity="warning" sx={{ mb: 2 }}>Rollback in progress — work the Rollback steps.</Alert>}
      {status === 'ESCALATED' && <Alert severity="error" sx={{ mb: 2 }}>A blocking step failed and was escalated — resume, trigger rollback or abort to continue.</Alert>}
      {status === 'PENDING_SIGNOFF' && (
        <Alert severity="success" sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => navigate(`/runbooks/executions/${execId}/summary`)}>Sign-off</Button>}>
          All steps are complete — this execution is pending sign-off.
        </Alert>
      )}

      <Box sx={{
        display: 'grid', gap: 2, alignItems: 'start',
        gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)', lg: '270px minmax(0, 1fr) 320px' },
      }}>
        <Box sx={{
          bgcolor: '#fff', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow,
          position: { md: 'sticky' }, top: { md: 16 }, maxHeight: { md: 'calc(100vh - 160px)' }, overflowY: 'auto',
        }}>
          <StepList steps={steps} selectedId={selected?.stepExecId} onSelect={setSelectedId} />
        </Box>

        <Box sx={{ bgcolor: '#fff', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow, minWidth: 0 }}>
          <StepCard
            step={selected}
            execId={execId}
            userId={user?.userId}
            can={{ act: canAct, verify: canAct }}
            onAction={onStepAction}
            onError={(m) => toast(m, 'error')}
          />
        </Box>

        <Box sx={{ gridColumn: { xs: 'auto', md: '1 / -1', lg: 'auto' }, minWidth: 0 }}>
          <ConsoleSidePanel
            execution={exec}
            canAct={isExecutor && isActiveExecution(status)}
            ackingId={ackingId}
            onEscalate={() => setDialog({ type: 'escalate' })}
            onAck={async (escId) => {
              setAckingId(escId);
              await runDirect(() => api.runbooks.executions.ackEscalation(execId, escId), 'Escalation acknowledged');
              setAckingId(null);
            }}
          />
        </Box>
      </Box>

      {/* Sticky footer */}
      <Box sx={{
        position: 'sticky', bottom: 0, mt: 2, zIndex: 5,
        bgcolor: '#fff', border: `1px solid ${TL.gray100}`, borderRadius: '12px',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', px: 2, py: 1.25,
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      }}>
        <Button startIcon={<ChevronLeftIcon />} disabled={selectedIdx <= 0} onClick={() => goStep(-1)}>Prev</Button>
        <Button endIcon={<ChevronRightIcon />} disabled={selectedIdx < 0 || selectedIdx >= steps.length - 1} onClick={() => goStep(1)}>
          Next
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          Shortcuts: N next · P pass
        </Typography>
        <Box sx={{ flex: 1 }} />
        {isExecutor && ['IN_PROGRESS', 'ESCALATED'].includes(status) && (
          <Button startIcon={<PauseIcon />} onClick={() => setDialog({ type: 'pause' })}>Pause</Button>
        )}
        {isExecutor && ['PAUSED', 'ESCALATED'].includes(status) && (
          <Button variant="contained" startIcon={<PlayArrowIcon />}
            onClick={() => runDirect(() => api.runbooks.executions.resume(execId), 'Execution resumed')}>
            Resume
          </Button>
        )}
        {isExecutor && ['IN_PROGRESS', 'ESCALATED', 'PAUSED'].includes(status) && (
          <Button color="warning" startIcon={<UndoIcon />} onClick={() => setDialog({ type: 'rollback' })}>Trigger rollback</Button>
        )}
        {isExecutor && isActiveExecution(status) && (
          <Button color="error" startIcon={<StopCircleOutlinedIcon />} onClick={() => setDialog({ type: 'abort' })}>Abort</Button>
        )}
        {finished && (
          <Button variant="outlined" onClick={() => navigate(`/runbooks/executions/${execId}/summary`)}>Summary</Button>
        )}
      </Box>

      {/* M12 */}
      {showPreflight && (
        <PreflightDialog
          execution={exec}
          onLeave={() => navigate('/runbooks/executions')}
          onSubmit={(ids) => run(() => api.runbooks.executions.preflight(execId, ids), 'Pre-flight confirmed — execution started')}
        />
      )}

      {/* Step modals (M13–M16 + pass) */}
      {dialog?.type === 'pass' && dialogStep && (
        <PassStepDialog step={dialogStep} onClose={() => setDialog(null)}
          onSubmit={(p) => run(() => stepApi(api.runbooks.executions.passStep)(p),
            dialogStep.dualControl ? 'Passed — awaiting verification' : 'Step passed', { advance: !dialogStep.dualControl })} />
      )}
      {dialog?.type === 'fail' && dialogStep && (
        <FailStepDialog step={dialogStep} onClose={() => setDialog(null)}
          onSubmit={(p) => run(() => stepApi(api.runbooks.executions.failStep)(p), 'Failure recorded', { advance: true })} />
      )}
      {dialog?.type === 'skip' && dialogStep && (
        <SkipStepDialog step={dialogStep} onClose={() => setDialog(null)}
          onSubmit={(p) => run(() => stepApi(api.runbooks.executions.skipStep)(p), 'Step skipped', { advance: true })} />
      )}
      {dialog?.type === 'verify' && dialogStep && (
        <VerifyStepDialog step={dialogStep} onClose={() => setDialog(null)}
          onSubmit={(pw) => run(() => api.runbooks.executions.verifyStep(execId, dialog.stepExecId, pw), 'Step verified', { advance: true })} />
      )}
      {dialog?.type === 'evidence' && dialogStep && (
        <CaptureEvidenceDialog step={dialogStep} onClose={() => setDialog(null)}
          onSubmit={(fields) => run(() => api.runbooks.executions.captureEvidence(execId, dialog.stepExecId, fields))} />
      )}

      {/* Execution modals (M17–M19 + pause) */}
      {dialog?.type === 'escalate' && (
        <EscalateDialog onClose={() => setDialog(null)}
          onSubmit={(p) => run(() => api.runbooks.executions.escalate(execId, p), 'Escalation sent')} />
      )}
      {dialog?.type === 'rollback' && (
        <RollbackDialog execution={exec} onClose={() => setDialog(null)}
          onSubmit={(reason) => run(() => api.runbooks.executions.rollback(execId, reason), 'Rollback started', { advance: true })} />
      )}
      {dialog?.type === 'pause' && (
        <ReasonDialog title="Pause execution" confirmLabel="Pause" onClose={() => setDialog(null)}
          onSubmit={(reason) => run(() => api.runbooks.executions.pause(execId, reason), 'Execution paused')} />
      )}
      {dialog?.type === 'abort' && (
        <ReasonDialog title="Abort execution" confirmLabel="Abort execution" confirmColor="error"
          warning="Aborting ends this execution permanently. Captured evidence is retained."
          onClose={() => setDialog(null)}
          onSubmit={(reason) => run(() => api.runbooks.executions.abort(execId, reason), 'Execution aborted')} />
      )}

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert>
        ) : <span />}
      </Snackbar>
    </Box>
  );
}
