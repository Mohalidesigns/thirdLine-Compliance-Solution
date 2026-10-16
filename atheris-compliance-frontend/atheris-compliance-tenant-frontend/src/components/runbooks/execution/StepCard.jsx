import { Alert, Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { StatusBadge, TL } from 'shared';
import EvidenceList, { CommandBlock } from './EvidenceList';
import { formatDateTime, statusLabel, stepTone } from './executionUtils';
import { humanize } from '../../../pages/runbooks/runbookConstants';

function Block({ label, children }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TL.gray400, mb: 0.75,
      }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

const textSx = { fontSize: '0.875rem', color: TL.gray800, whiteSpace: 'pre-wrap', lineHeight: 1.6 };

/**
 * Centre pane: the selected step. `can` = { act, verify } decides which buttons render;
 * `onAction(type)` opens the matching modal (start | evidence | pass | fail | skip | verify).
 */
export default function StepCard({ step, execId, can, userId, onAction, onError }) {
  if (!step) {
    return <Typography color="text.secondary" sx={{ p: 3 }}>Select a step.</Typography>;
  }
  const { status } = step;
  const reqs = step.evidenceReqs || [];
  const workable = can.act && ['PENDING', 'IN_PROGRESS'].includes(status);
  const isPerformer = userId != null && step.performedByUserId === userId;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: TL.mono, fontSize: '0.8125rem', color: TL.gray500 }}>
            {step.rollback ? 'Rollback · ' : ''}{step.stepCode || '–'}
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: TL.textPrimary, lineHeight: 1.3 }}>{step.title}</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge label={statusLabel(status)} tone={stepTone(status)} />
            {step.assignedRole && <Chip size="small" variant="outlined" label={humanize(step.assignedRole)} sx={{ height: 22 }} />}
            {step.blocking && <Chip size="small" color="warning" variant="outlined" label="Blocking" sx={{ height: 22 }} />}
            {step.dualControl && <Chip size="small" color="secondary" variant="outlined" label="Dual control" sx={{ height: 22 }} />}
            {step.durationEstimateMin != null && (
              <Typography variant="caption" color="text.secondary">~{step.durationEstimateMin} min</Typography>
            )}
          </Box>
        </Box>
      </Box>

      {step.safetyNote && (
        <Alert severity="warning" sx={{ mb: 2.5 }}><strong>Safety:</strong> {step.safetyNote}</Alert>
      )}

      {status === 'AWAITING_VERIFICATION' && (
        <Alert severity="info" icon={<VerifiedUserIcon />} sx={{ mb: 2.5 }}
          action={can.verify && !isPerformer ? (
            <Button color="inherit" size="small" variant="outlined" onClick={() => onAction('verify')}>Verify</Button>
          ) : null}>
          Awaiting second-person verification
          {isPerformer ? ' — you performed this step, so another user must verify it.' : '.'}
        </Alert>
      )}

      {step.instructionMd && (
        <Block label="Instruction"><Typography sx={textSx}>{step.instructionMd}</Typography></Block>
      )}

      {step.commandBlock && (
        <Block label="Command"><CommandBlock command={step.commandBlock} lang={step.commandLang} /></Block>
      )}

      {step.expectedResult && (
        <Block label="Expected result">
          <Box sx={{ borderLeft: `3px solid ${TL.success}`, pl: 1.5 }}><Typography sx={textSx}>{step.expectedResult}</Typography></Box>
        </Block>
      )}

      {(step.actualResult || step.operatorNotes || step.failureCategory || step.skipReason || step.performedByName) && (
        <Block label="Recorded">
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {step.actualResult && <Typography sx={textSx}><strong>Actual:</strong> {step.actualResult}</Typography>}
            {step.failureCategory && <Typography sx={textSx}><strong>Failure category:</strong> {humanize(step.failureCategory)}</Typography>}
            {step.skipReason && <Typography sx={textSx}><strong>Skip reason:</strong> {step.skipReason}</Typography>}
            {step.operatorNotes && <Typography sx={textSx}><strong>Notes:</strong> {step.operatorNotes}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {step.performedByName ? `Performed by ${step.performedByName}` : ''}
              {step.verifiedByName ? ` · verified by ${step.verifiedByName}` : ''}
              {step.startedAt ? ` · started ${formatDateTime(step.startedAt)}` : ''}
              {step.completedAt ? ` · completed ${formatDateTime(step.completedAt)}` : ''}
            </Typography>
          </Box>
        </Block>
      )}

      <Block label="Evidence">
        {reqs.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
            {reqs.map((r) => (
              <Box key={r.reqId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {r.satisfied
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: TL.success }} />
                  : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: r.mandatory ? TL.warning : TL.gray400 }} />}
                <Typography sx={{ fontSize: '0.8125rem', color: TL.gray800 }}>{r.label || humanize(r.evidenceType)}</Typography>
                <Chip size="small" label={humanize(r.evidenceType)} sx={{ height: 20, fontSize: '0.6875rem' }} />
                {r.mandatory && <Chip size="small" variant="outlined" color="warning" label="Mandatory" sx={{ height: 20, fontSize: '0.6875rem' }} />}
              </Box>
            ))}
          </Box>
        )}
        <EvidenceList execId={execId} items={step.evidence || []} onError={onError} />
      </Block>

      {can.act && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 1, borderTop: `1px solid ${TL.gray100}` }}>
          {status === 'PENDING' && (
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => onAction('start')}>Start step</Button>
          )}
          {workable && (
            <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => onAction('evidence')}>Capture evidence</Button>
          )}
          {status === 'IN_PROGRESS' && (
            <>
              <Tooltip title={step.mandatoryEvidenceSatisfied ? 'Shortcut: P' : 'Capture all mandatory evidence first'}>
                <span>
                  <Button variant="contained" color="success" startIcon={<CheckIcon />}
                    disabled={!step.mandatoryEvidenceSatisfied} onClick={() => onAction('pass')}>
                    Pass
                  </Button>
                </span>
              </Tooltip>
              <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => onAction('fail')}>Fail</Button>
            </>
          )}
          {workable && step.allowSkip && (
            <Button variant="text" color="inherit" startIcon={<SkipNextIcon />} onClick={() => onAction('skip')}>Skip / N/A</Button>
          )}
        </Box>
      )}
    </Box>
  );
}
