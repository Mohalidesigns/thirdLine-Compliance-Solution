import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, LinearProgress, MenuItem,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { ArrowDownTrayIcon, TL } from 'shared';
import { api } from '../../../services/api';
import ActionDialog from './ActionDialog';
import { HashText } from './EvidenceList';
import { errorMessage, formatDateTime } from './executionUtils';
import { humanize } from '../../../pages/runbooks/runbookConstants';

/* ───────── M12 Pre-flight checklist (blocking) ───────── */
export function PreflightDialog({ execution, onSubmit, onLeave, readOnly }) {
  const prereqs = execution?.prerequisites || [];
  const [acked, setAcked] = useState(() => new Set(prereqs.filter((p) => p.acknowledged).map((p) => p.prereqId)));
  const [attested, setAttested] = useState(false);
  const toggle = (id) => setAcked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const missing = prereqs.filter((p) => p.mandatory && !acked.has(p.prereqId)).length;
  return (
    <ActionDialog
      title="Pre-flight checklist"
      subtitle={`${execution?.executionRef || ''} · ${execution?.runbookCode || ''} ${execution?.runbookTitle || ''}`}
      blocking
      onClose={onLeave}
      // stay in the console: once pre-flight is recorded the console stops rendering this dialog
      // (closing it here would run onLeave and drop the user back on the executions list)
      keepOpen
      confirmLabel="Confirm & start execution"
      disabled={readOnly || missing > 0 || !attested}
      hideConfirm={readOnly}
      extraActions={<Button onClick={onLeave} sx={{ mr: 'auto' }}>Back to executions</Button>}
      onConfirm={() => onSubmit([...acked])}
    >
      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>This execution has not passed pre-flight yet. Only an executor can confirm it.</Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Confirm every prerequisite before the clock-driven steps begin. Mandatory items must all be ticked.
      </Typography>
      {prereqs.length === 0 && (
        <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1 }}>This runbook declares no prerequisites.</Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
        {prereqs.map((p) => (
          <Box key={p.prereqId} sx={{ border: `1px solid ${TL.gray100}`, borderRadius: '8px', px: 1.5, py: 0.75 }}>
            <FormControlLabel
              disabled={readOnly}
              control={<Checkbox checked={acked.has(p.prereqId)} onChange={() => toggle(p.prereqId)} />}
              label={(
                <Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.label}</Typography>
                    <Chip size="small" label={humanize(p.prereqType)} sx={{ height: 20, fontSize: '0.6875rem' }} />
                    {p.mandatory && <Chip size="small" color="warning" variant="outlined" label="Mandatory" sx={{ height: 20, fontSize: '0.6875rem' }} />}
                  </Box>
                  {p.detail && <Typography variant="caption" color="text.secondary">{p.detail}</Typography>}
                </Box>
              )}
            />
          </Box>
        ))}
      </Box>
      <FormControlLabel
        disabled={readOnly}
        control={<Checkbox checked={attested} onChange={(e) => setAttested(e.target.checked)} />}
        label="I have the required access and authority to execute this runbook."
      />
      {missing > 0 && !readOnly && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
          {missing} mandatory prerequisite{missing !== 1 ? 's' : ''} still unticked.
        </Typography>
      )}
    </ActionDialog>
  );
}

/* ───────── Reason dialog (Pause, M19 Abort) ───────── */
export function ReasonDialog({ title, subtitle, confirmLabel, confirmColor = 'primary', required = true, warning, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  return (
    <ActionDialog title={title} subtitle={subtitle} onClose={onClose} confirmLabel={confirmLabel} confirmColor={confirmColor}
      disabled={required && !reason.trim()} onConfirm={() => onSubmit(reason.trim())}>
      {warning && <Alert severity="warning" sx={{ mb: 2 }}>{warning}</Alert>}
      <TextField label="Reason" required={required} fullWidth multiline minRows={3} autoFocus
        value={reason} onChange={(e) => setReason(e.target.value)} />
    </ActionDialog>
  );
}

/* ───────── M17 Escalate now ───────── */
export function EscalateDialog({ onClose, onSubmit }) {
  const [level, setLevel] = useState(1);
  const [message, setMessage] = useState('');
  return (
    <ActionDialog title="Escalate now" onClose={onClose} confirmLabel="Escalate" confirmColor="error"
      disabled={!message.trim()} onConfirm={() => onSubmit({ level: Number(level), message: message.trim() })}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Notifies the role configured for the chosen level in this runbook&apos;s escalation matrix.
      </Typography>
      <TextField select label="Level" value={level} onChange={(e) => setLevel(e.target.value)} sx={{ mb: 2, minWidth: 160 }}>
        {[1, 2, 3].map((l) => <MenuItem key={l} value={l}>Level {l}</MenuItem>)}
      </TextField>
      <TextField label="Message" required fullWidth multiline minRows={3} value={message} autoFocus
        onChange={(e) => setMessage(e.target.value)} />
    </ActionDialog>
  );
}

/* ───────── M18 Trigger rollback ───────── */
export function RollbackDialog({ execution, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const { runbookId, versionId } = execution || {};
  const versionQuery = useQuery({
    queryKey: ['runbook-version', String(runbookId), String(versionId)],
    queryFn: ({ signal }) => api.runbooks.versions.get(runbookId, versionId, { signal }),
    enabled: runbookId != null && versionId != null,
    staleTime: 5 * 60 * 1000,
  });
  const fromTree = versionQuery.data?.rollbackSteps || [];
  const fromExec = (execution?.steps || []).filter((s) => s.rollback);
  const rollbackSteps = fromTree.length
    ? fromTree.map((r) => ({ key: r.rollbackId, code: r.reversesStepCode, title: r.title }))
    : fromExec.map((s) => ({ key: s.stepExecId, code: s.stepCode, title: s.title }));
  return (
    <ActionDialog title="Trigger rollback" onClose={onClose} confirmLabel="Start rollback" confirmColor="warning"
      disabled={!reason.trim()} onConfirm={() => onSubmit(reason.trim())}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        The execution moves to Rolling back and the steps below are added as tracked steps.
      </Alert>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Rollback steps</Typography>
      {versionQuery.isFetching && <LinearProgress sx={{ mb: 1 }} />}
      {!versionQuery.isFetching && rollbackSteps.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
          {versionQuery.error ? 'Could not load the rollback plan.' : 'This runbook version defines no rollback steps.'}
        </Typography>
      )}
      <Box component="ol" sx={{ pl: 3, mt: 0, mb: 2 }}>
        {rollbackSteps.map((r) => (
          <li key={r.key}>
            <Typography variant="body2">
              {r.title}{r.code ? <Typography component="span" variant="caption" color="text.secondary"> — reverses {r.code}</Typography> : null}
            </Typography>
          </li>
        ))}
      </Box>
      <TextField label="Reason" required fullWidth multiline minRows={3} value={reason} autoFocus
        onChange={(e) => setReason(e.target.value)} />
    </ActionDialog>
  );
}

/* ───────── M20 Sign-off ───────── */
/** Sign-off roles a user may record: CCO/TENANT_ADMIN → CCO, AUDITOR → AUDITOR, ANALYST → REVIEWER, operator → OPERATOR. */
export function allowedSignoffRoles(user, execution) {
  const roles = [];
  if (user && execution && user.userId != null && user.userId === execution.operatorUserId) roles.push('OPERATOR');
  if (user?.role === 'ANALYST') roles.push('REVIEWER');
  if (['CCO', 'TENANT_ADMIN'].includes(user?.role)) roles.push('CCO');
  if (user?.role === 'AUDITOR') roles.push('AUDITOR');
  return [...new Set(roles)];
}

export function SignoffDialog({ execution, roles, onClose, onSubmit }) {
  const [role, setRole] = useState(roles[0] || '');
  const [decision, setDecision] = useState('ACCEPTED');
  const [comment, setComment] = useState('');
  const completeness = execution?.evidenceCompleteness ?? 0;
  const acceptBlocked = decision === 'ACCEPTED' && completeness < 100;
  return (
    <ActionDialog title="Sign-off" subtitle={execution?.executionRef} onClose={onClose}
      confirmLabel="Record sign-off" confirmColor={decision === 'REJECTED' ? 'error' : 'success'}
      disabled={!role || acceptBlocked || (decision === 'REJECTED' && !comment.trim())}
      onConfirm={() => onSubmit({ role, decision, comment: comment.trim() || null })}>
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">Mandatory evidence completeness</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={Math.min(100, completeness)}
          color={completeness >= 100 ? 'success' : 'warning'} sx={{ height: 6, borderRadius: 3 }} />
        {execution?.mandatoryEvidenceMissing > 0 && (
          <Typography variant="caption" color="warning.main">
            {execution.mandatoryEvidenceMissing} mandatory evidence item{execution.mandatoryEvidenceMissing !== 1 ? 's' : ''} missing.
          </Typography>
        )}
      </Box>
      <TextField select label="Sign as" fullWidth value={role} onChange={(e) => setRole(e.target.value)} sx={{ mb: 2 }}>
        {roles.map((r) => <MenuItem key={r} value={r}>{humanize(r)}</MenuItem>)}
      </TextField>
      <ToggleButtonGroup exclusive size="small" value={decision} onChange={(_, v) => v && setDecision(v)} sx={{ mb: 2 }}>
        <ToggleButton value="ACCEPTED" color="success">Accept</ToggleButton>
        <ToggleButton value="REJECTED" color="error">Reject</ToggleButton>
      </ToggleButtonGroup>
      {acceptBlocked && (
        <Alert severity="warning" sx={{ mb: 2 }}>Acceptance requires 100% of mandatory evidence.</Alert>
      )}
      <TextField label="Comment" fullWidth multiline minRows={3} value={comment}
        required={decision === 'REJECTED'} onChange={(e) => setComment(e.target.value)} />
    </ActionDialog>
  );
}

/* ───────── M21 Generate evidence pack ───────── */
export function EvidencePackDialog({ execution, onClose, onSubmit }) {
  const [includeCommands, setIncludeCommands] = useState(true);
  const [auditorName, setAuditorName] = useState('');
  const [auditorFirm, setAuditorFirm] = useState('');
  const [result, setResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState('');

  const download = async () => {
    setDownloading(true); setDlError('');
    try { await api.runbooks.executions.downloadPack(execution.executionId); }
    catch (e) { setDlError(errorMessage(e, 'Download failed')); }
    finally { setDownloading(false); }
  };

  if (result) {
    return (
      <ActionDialog title="Evidence pack ready" subtitle={execution?.executionRef} onClose={onClose} hideConfirm onConfirm={() => {}}
        extraActions={(
          <Button variant="contained" onClick={download} disabled={downloading}
            startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <ArrowDownTrayIcon size={16} />}>
            Download
          </Button>
        )}>
        {dlError && <Alert severity="error" sx={{ mb: 2 }}>{dlError}</Alert>}
        <Typography variant="body2" sx={{ mb: 1 }}>
          Generated {formatDateTime(result.packGeneratedAt)}. Re-hashing the downloaded pack must match:
        </Typography>
        <Typography variant="caption" color="text.secondary">Pack SHA-256</Typography>
        <Typography sx={{ fontFamily: TL.mono, fontSize: '0.8125rem', wordBreak: 'break-all', mb: 1 }}>
          {result.packHash || '–'}
        </Typography>
        <HashText hash={result.packHash} label="Copy" />
      </ActionDialog>
    );
  }

  return (
    <ActionDialog title="Generate evidence pack" subtitle={execution?.executionRef} onClose={onClose}
      confirmLabel="Generate" keepOpen
      onConfirm={async () => {
        const detail = await onSubmit({
          includeCommands, auditorName: auditorName.trim() || null, auditorFirm: auditorFirm.trim() || null,
        });
        setResult(detail || {});
      }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Bundles every evidence file, a SHA-256 manifest, all sign-offs and the framework clauses satisfied.
      </Typography>
      <FormControlLabel sx={{ mb: 2 }}
        control={<Checkbox checked={includeCommands} onChange={(e) => setIncludeCommands(e.target.checked)} />}
        label="Include command blocks" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField label="Auditor name" value={auditorName} onChange={(e) => setAuditorName(e.target.value)} />
        <TextField label="Audit firm" value={auditorFirm} onChange={(e) => setAuditorFirm(e.target.value)} />
      </Box>
    </ActionDialog>
  );
}
