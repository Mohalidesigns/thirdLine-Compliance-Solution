import { useRef, useState } from 'react';
import {
  Alert, Box, Checkbox, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup,
  Tab, Tabs, TextField, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { TL } from 'shared';
import ActionDialog from './ActionDialog';
import { HashText } from './EvidenceList';
import { formatBytes } from './executionUtils';
import { EVIDENCE_TYPES, FAILURE_CATEGORIES, humanize } from '../../../pages/runbooks/runbookConstants';

const stepName = (step) => `${step?.stepCode ? `${step.stepCode} · ` : ''}${step?.title || 'Step'}`;

/* ───────── Pass ───────── */
export function PassStepDialog({ step, onClose, onSubmit }) {
  const [actualResult, setActualResult] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <ActionDialog
      title="Pass step"
      subtitle={stepName(step)}
      onClose={onClose}
      confirmLabel={step?.dualControl ? 'Pass & request verification' : 'Pass step'}
      confirmColor="success"
      onConfirm={() => onSubmit({ actualResult: actualResult.trim() || null, notes: notes.trim() || null })}
    >
      {step?.expectedResult && (
        <Alert severity="info" sx={{ mb: 2 }}><strong>Expected:</strong> {step.expectedResult}</Alert>
      )}
      {step?.dualControl && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Dual-control step — it will wait for a second person to verify before it counts as passed.
        </Alert>
      )}
      <TextField label="Actual result" fullWidth multiline minRows={3} value={actualResult}
        onChange={(e) => setActualResult(e.target.value)} sx={{ mb: 2 }} autoFocus />
      <TextField label="Operator notes" fullWidth multiline minRows={2} value={notes}
        onChange={(e) => setNotes(e.target.value)} />
    </ActionDialog>
  );
}

/* ───────── M14 Fail ───────── */
export function FailStepDialog({ step, onClose, onSubmit }) {
  const [actualResult, setActualResult] = useState('');
  const [category, setCategory] = useState('DEVIATION');
  const [raiseFinding, setRaiseFinding] = useState(!!step?.blocking);
  const [escalateLevel, setEscalateLevel] = useState(step?.blocking ? 1 : 0);
  const [nextAction, setNextAction] = useState(step?.blocking ? 'PAUSE' : 'CONTINUE');
  return (
    <ActionDialog
      title="Fail step"
      subtitle={stepName(step)}
      onClose={onClose}
      confirmLabel="Record failure"
      confirmColor="error"
      disabled={!actualResult.trim()}
      onConfirm={() => onSubmit({
        actualResult: actualResult.trim(), category, raiseFinding, escalateLevel: Number(escalateLevel), nextAction,
      })}
    >
      {step?.blocking && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This is a blocking step — later steps cannot proceed normally until the failure is handled.
        </Alert>
      )}
      <TextField label="Actual result" required fullWidth multiline minRows={3} value={actualResult}
        onChange={(e) => setActualResult(e.target.value)} sx={{ mb: 2 }} autoFocus
        helperText="What actually happened (required)." />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <TextField select label="Failure category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {FAILURE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{humanize(c)}</MenuItem>)}
        </TextField>
        <TextField select label="Trigger escalation" value={escalateLevel}
          onChange={(e) => setEscalateLevel(e.target.value)}>
          <MenuItem value={0}>No escalation</MenuItem>
          {[1, 2, 3].map((l) => <MenuItem key={l} value={l}>Level {l}</MenuItem>)}
        </TextField>
      </Box>
      <FormControlLabel sx={{ mb: 1 }}
        control={<Checkbox checked={raiseFinding} onChange={(e) => setRaiseFinding(e.target.checked)} />}
        label="Raise a finding from this failure" />
      <FormControl sx={{ display: 'block' }}>
        <FormLabel sx={{ fontSize: '0.8125rem' }}>Then</FormLabel>
        <RadioGroup row value={nextAction} onChange={(e) => setNextAction(e.target.value)}>
          <FormControlLabel value="CONTINUE" control={<Radio size="small" />} label="Continue" />
          <FormControlLabel value="PAUSE" control={<Radio size="small" />} label="Pause execution" />
          <FormControlLabel value="ROLLBACK" control={<Radio size="small" />} label="Start rollback" />
        </RadioGroup>
      </FormControl>
    </ActionDialog>
  );
}

/* ───────── M15 Skip ───────── */
export function SkipStepDialog({ step, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [notApplicable, setNotApplicable] = useState(false);
  const short = reason.trim().length < 10;
  return (
    <ActionDialog
      title="Skip step"
      subtitle={stepName(step)}
      onClose={onClose}
      confirmLabel={notApplicable ? 'Mark not applicable' : 'Skip step'}
      confirmColor="warning"
      disabled={short}
      onConfirm={() => onSubmit({ reason: reason.trim(), notApplicable })}
    >
      {step?.dualControl && (
        <Alert severity="info" sx={{ mb: 2 }}>Dual-control step — the skip is recorded against your name for review.</Alert>
      )}
      <TextField label="Reason" required fullWidth multiline minRows={3} value={reason} autoFocus
        onChange={(e) => setReason(e.target.value)} sx={{ mb: 1.5 }}
        error={reason.length > 0 && short}
        helperText={`${reason.trim().length}/10 characters minimum`} />
      <FormControlLabel
        control={<Checkbox checked={notApplicable} onChange={(e) => setNotApplicable(e.target.checked)} />}
        label="This step is not applicable (N/A) to this run" />
    </ActionDialog>
  );
}

/* ───────── M16 Dual-control verify ───────── */
export function VerifyStepDialog({ step, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  return (
    <ActionDialog
      title="Verify step (second person)"
      subtitle={stepName(step)}
      onClose={onClose}
      confirmLabel="Verify"
      confirmColor="success"
      disabled={!password}
      onConfirm={() => onSubmit(password)}
    >
      <Box sx={{ mb: 2, display: 'grid', gap: 0.5 }}>
        <Typography variant="body2"><strong>Performed by:</strong> {step?.performedByName || '–'}</Typography>
        {step?.actualResult && <Typography variant="body2"><strong>Actual result:</strong> {step.actualResult}</Typography>}
        <Typography variant="body2"><strong>Evidence items:</strong> {(step?.evidence || []).length}</Typography>
      </Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Re-enter your password to confirm you independently checked this step. The verifier must not be the performer.
      </Alert>
      <TextField label="Your password" type="password" fullWidth autoFocus autoComplete="current-password"
        value={password} onChange={(e) => setPassword(e.target.value)} />
    </ActionDialog>
  );
}

/* ───────── M13 Capture evidence ───────── */
const TABS = [
  { key: 'file', label: 'Upload file', defaultType: 'SCREENSHOT' },
  { key: 'paste', label: 'Paste output', defaultType: 'QUERY_OUTPUT' },
  { key: 'ref', label: 'Ticket / external ref', defaultType: 'TICKET_REF' },
  { key: 'attest', label: 'Attestation', defaultType: 'ATTESTATION' },
];

export function CaptureEvidenceDialog({ step, onClose, onSubmit }) {
  const reqs = step?.evidenceReqs || [];
  const firstOpen = reqs.find((r) => !r.satisfied) || reqs[0];
  const [tab, setTab] = useState('file');
  const [reqId, setReqId] = useState(firstOpen?.reqId ?? '');
  const [evidenceType, setEvidenceType] = useState(firstOpen?.evidenceType || 'SCREENSHOT');
  const [typeTouched, setTypeTouched] = useState(false);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [pastedOutput, setPastedOutput] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [attestationText, setAttestationText] = useState('');
  const [saved, setSaved] = useState(null); // EvidenceItemDto just created
  const inputRef = useRef(null);

  const pickReq = (id) => {
    setReqId(id);
    const r = reqs.find((x) => x.reqId === id);
    if (r?.evidenceType) { setEvidenceType(r.evidenceType); setTypeTouched(true); }
  };
  const pickTab = (key) => {
    setTab(key);
    if (!typeTouched) setEvidenceType(TABS.find((t) => t.key === key).defaultType);
  };

  const payloadReady = (tab === 'file' && !!file) || (tab === 'paste' && pastedOutput.trim())
    || (tab === 'ref' && externalRef.trim()) || (tab === 'attest' && attestationText.trim());

  const confirm = async () => {
    const fields = { reqId: reqId === '' ? undefined : reqId, evidenceType };
    if (tab === 'file') fields.file = file;
    if (tab === 'paste') fields.pastedOutput = pastedOutput;
    if (tab === 'ref') fields.externalRef = externalRef.trim();
    if (tab === 'attest') fields.attestationText = attestationText.trim();
    const before = new Set((step?.evidence || []).map((e) => e.evidenceId));
    const detail = await onSubmit(fields);
    const updated = (detail?.steps || []).find((s) => s.stepExecId === step.stepExecId);
    const created = (updated?.evidence || []).filter((e) => !before.has(e.evidenceId));
    setSaved(created[created.length - 1] || { sha256: null });
  };

  if (saved) {
    return (
      <ActionDialog title="Evidence captured" subtitle={stepName(step)} onClose={onClose} hideConfirm onConfirm={() => {}}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Evidence stored immutably. It can no longer be edited or deleted.
        </Alert>
        {saved.sha256 ? (
          <Box>
            <Typography variant="caption" color="text.secondary">SHA-256</Typography>
            <Typography sx={{ fontFamily: TL.mono, fontSize: '0.8125rem', wordBreak: 'break-all', mb: 1 }}>{saved.sha256}</Typography>
            <HashText hash={saved.sha256} label="Copy" />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">The server did not return a hash for this item.</Typography>
        )}
      </ActionDialog>
    );
  }

  return (
    <ActionDialog
      title="Capture evidence"
      subtitle={stepName(step)}
      onClose={onClose}
      confirmLabel="Save evidence"
      disabled={!payloadReady}
      keepOpen
      maxWidth="md"
      onConfirm={confirm}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2, mb: 2 }}>
        <TextField select label="Satisfies requirement" value={reqId} onChange={(e) => pickReq(e.target.value)}>
          <MenuItem value="">Not tied to a requirement</MenuItem>
          {reqs.map((r) => (
            <MenuItem key={r.reqId} value={r.reqId}>
              {r.satisfied ? '✓ ' : ''}{r.label || humanize(r.evidenceType)}{r.mandatory ? ' (mandatory)' : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Evidence type" value={evidenceType}
          onChange={(e) => { setEvidenceType(e.target.value); setTypeTouched(true); }}>
          {EVIDENCE_TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
        </TextField>
      </Box>

      <Tabs value={tab} onChange={(_, v) => pickTab(v)} variant="scrollable" sx={{ mb: 2, borderBottom: `1px solid ${TL.gray100}` }}>
        {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} sx={{ textTransform: 'none' }} />)}
      </Tabs>

      {tab === 'file' && (
        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer?.files?.[0];
            if (f) setFile(f);
          }}
          sx={{
            border: `2px dashed ${dragOver ? TL.primary : TL.gray300}`, borderRadius: '10px', p: 4,
            textAlign: 'center', cursor: 'pointer', bgcolor: dragOver ? TL.gray50 : 'transparent',
          }}
        >
          <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: TL.gray400 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {file ? <><strong>{file.name}</strong> · {formatBytes(file.size)}</> : 'Drag a file here, or click to choose'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            The file is hashed (SHA-256) and stored in the evidence vault.
          </Typography>
          <input ref={inputRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Box>
      )}
      {tab === 'paste' && (
        <TextField label="Command / query output" fullWidth multiline minRows={8} value={pastedOutput}
          onChange={(e) => setPastedOutput(e.target.value)} helperText="Saved as a .txt evidence file."
          slotProps={{ input: { sx: { fontFamily: TL.mono, fontSize: '0.8125rem' } } }} />
      )}
      {tab === 'ref' && (
        <TextField label="Ticket or external reference" fullWidth value={externalRef}
          onChange={(e) => setExternalRef(e.target.value)} placeholder="e.g. CHG-10234 or https://…" />
      )}
      {tab === 'attest' && (
        <TextField label="Attestation" fullWidth multiline minRows={4} value={attestationText}
          onChange={(e) => setAttestationText(e.target.value)}
          placeholder="I confirm that…" helperText="Recorded against your name with a timestamp." />
      )}
    </ActionDialog>
  );
}
