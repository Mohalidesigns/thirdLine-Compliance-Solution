import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, Alert, TextField, Link, IconButton, Tooltip,
  Stepper, Step, StepLabel, MenuItem,
} from '@mui/material';
import {
  Section, Field, FieldGrid, StatTile,
} from '../detailKit';
import {
  StatusBadge, TL, CheckCircleIcon, ClockIcon, CalendarIcon, CalendarDaysIcon, DocumentTextIcon,
  ExclamationCircleIcon, ExclamationTriangleIcon, LinkIcon, QueueListIcon, ArrowLeftIcon, ChevronRightIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import EscalationOverrideDialog from './EscalationOverrideDialog';
import SubmitDraftDialog from './SubmitDraftDialog';
import { EvidenceFileList } from '../evidence/EvidenceFiles';
import { formatDate, formatDateTime, isEventDriven, noPeriodLabel, responsiblePersons, statusAccent,
  statusBadge, WORKFLOW_STAGES, NOT_STARTED, REVIEW_ROLES } from './returnCommon';

const ESCALATION_ROLE = { 1: 'Analyst', 2: 'Manager', 3: 'CCO' };

export default function ReturnFilingPanel({ detail, item, periods = [], onSelectPeriod, onRefresh, onSnackbar, highlight }) {
  const { user } = useAuth();
  const canReview = REVIEW_ROLES.includes(user?.role);
  const [draftOpen, setDraftOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [escalationOpen, setEscalationOpen] = useState(false);
  const reviewRef = useRef(null);
  const isCompleted = detail.currentStage === 'Completed';

  useEffect(() => {
    if (highlight && detail.pendingReview && reviewRef.current) {
      reviewRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight, detail.pendingReview, detail.instanceId]);

  async function startFiling() {
    setStarting(true);
    try { await api.returns.advance(detail.instanceId, {}); onRefresh(); }
    catch (e) { onSnackbar(e.message); }
    finally { setStarting(false); }
  }

  const steps = (detail.stages || []).filter((s) => s.name !== NOT_STARTED);
  const stepIdx = steps.findIndex((s) => s.current);
  const currentStageIdx = stepIdx >= 0 ? stepIdx : WORKFLOW_STAGES.indexOf(detail.currentStage);
  const periodIdx = periods.findIndex((p) => p.instanceId === detail.instanceId);

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatTile icon={<CalendarDaysIcon />} label="Due Date"
          value={detail.dueDate ? formatDate(detail.dueDate) : noPeriodLabel(detail)} />
        <StatTile icon={<CheckCircleIcon />} label="Status" accent={statusAccent(detail.status)}
          chip={statusBadge(detail.status)} />
        <StatTile icon={<ClockIcon />} label="Days Late"
          value={detail.daysLate > 0 ? `${detail.daysLate}` : '—'}
          accent={detail.daysLate > 0 ? '#E53E3E' : '#2D7D46'} />
        <StatTile icon={<ExclamationCircleIcon />} label="Escalation"
          value={detail.escalationLevel > 0 ? `Level ${detail.escalationLevel}` : 'None'}
          accent={detail.escalationLevel > 0 ? '#E53E3E' : '#2B6CB0'} />
      </Box>

      {periods.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
          <Typography variant="overline" color="text.secondary" sx={{ mr: 0.5 }}>Filing period</Typography>
          <IconButton size="small" disabled={periodIdx <= 0}
            onClick={() => onSelectPeriod(periods[periodIdx - 1].instanceId)}>
            <ArrowLeftIcon size={16} />
          </IconButton>
          <TextField select size="small" sx={{ minWidth: 280 }} value={String(detail.instanceId)}
            onChange={(e) => onSelectPeriod(Number(e.target.value))}>
            {periods.map((p) => <MenuItem key={p.instanceId} value={String(p.instanceId)}>{p.label}</MenuItem>)}
          </TextField>
          <IconButton size="small" disabled={periodIdx < 0 || periodIdx >= periods.length - 1}
            onClick={() => onSelectPeriod(periods[periodIdx + 1].instanceId)}>
            <ChevronRightIcon size={16} />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            {periodIdx >= 0 ? `${periodIdx + 1} of ${periods.length}` : `${periods.length} needing action`}
          </Typography>
        </Box>
      )}

      <Section icon={<CalendarIcon />} title="Filing"
        action={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {detail.currentStage && <Chip size="small" variant="outlined" label={detail.currentStage} />}
            <Button size="small" variant="outlined" onClick={() => setEscalationOpen(true)}>Escalation</Button>
          </Box>
        )}>
        <FieldGrid min={160}>
          <Field label="Period" value={detail.period || (isEventDriven(detail) ? 'On event' : '—')} />
          <Field label="Due Date" value={detail.dueDate ? formatDate(detail.dueDate) : '—'} />
          <Field label="Prep Start" value={detail.prepStartDate ? formatDate(detail.prepStartDate) : '—'} />
          <Field label="Filing Channel" value={detail.filingChannel} />
          <Field label="Return Owner" value={detail.returnOwnerName} />
          {detail.deadlineText && <Field label="Regulator Wording" value={detail.deadlineText} />}
        </FieldGrid>
      </Section>

      {(detail.eventTriggerDate || detail.eventTriggerLabel) && (
        <Section icon={<CalendarIcon />} title="Event Trigger">
          <FieldGrid min={160}>
            <Field label="Trigger" value={detail.eventTriggerLabel} />
            <Field label="Trigger Date" value={detail.eventTriggerDate ? formatDate(detail.eventTriggerDate) : '—'} />
            <Field label="Reference" value={detail.eventReference} />
            <Field label="Base Deadline" value={detail.eventUnadjustedDueDate ? formatDate(detail.eventUnadjustedDueDate) : '—'} />
            <Field label="Adjusted">
              {detail.eventDueDateAdjusted
                ? <StatusBadge label="Moved to next working day" tone="gray" />
                : <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>No</Typography>}
            </Field>
            {detail.eventEvidenceFileId && (
              <Field label="Evidence"><EvidenceFileButton fileId={detail.eventEvidenceFileId} /></Field>
            )}
          </FieldGrid>
        </Section>
      )}

      {detail.escalationLevel > 0 && (
        <Section icon={<ExclamationTriangleIcon />} title="Escalation">
          <Alert severity="error">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Escalated · Level {detail.escalationLevel} · {ESCALATION_ROLE[detail.escalationLevel] || 'Management'}
            </Typography>
            {detail.escalatedAt && <Typography variant="caption">Escalated since {formatDate(detail.escalatedAt)}</Typography>}
          </Alert>
        </Section>
      )}

      <Section icon={<QueueListIcon />} title="Stages"
        action={detail.currentStage ? <Chip size="small" variant="outlined" label={detail.currentStage} /> : null}>
        {detail.currentStage === NOT_STARTED ? (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              This filing has not been started. Starting it opens Data Gathering so the responsible person can submit.
            </Typography>
            <Button size="small" variant="contained" onClick={startFiling} disabled={starting}>
              {starting ? 'Starting…' : 'Start filing'}
            </Button>
          </Box>
        ) : (
          <Stepper activeStep={currentStageIdx} alternativeLabel sx={{ mb: 2 }}>
            {steps.map((stage, i) => (
              <Step key={stage.name} completed={stage.completed} active={i === currentStageIdx}>
                <StepLabel>
                  <Typography sx={{
                    fontSize: '0.8125rem',
                    fontWeight: i === currentStageIdx ? 700 : 500,
                    color: i === currentStageIdx ? 'primary.main' : (stage.completed ? 'text.secondary' : 'text.disabled'),
                  }}>{stage.name}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {detail.stages?.some((s) => s.completedAt || s.evidenceUrl) && (
          <Box sx={{ mb: 2 }}>
            {detail.stages.filter((s) => s.name !== NOT_STARTED).map((stage) => (stage.completedAt || stage.evidenceUrl) ? (
              <Typography key={stage.name} variant="caption" color="text.secondary" display="block">
                {stage.name}
                {stage.completedAt ? `: completed ${formatDate(stage.completedAt)}` : ''}
                {stage.completedByName ? ` by ${stage.completedByName}` : ''}
                {stage.evidenceUrl && (
                  <> · <Link href={stage.evidenceUrl} target="_blank" rel="noopener" variant="caption"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                    <LinkIcon size={14} /> Evidence
                  </Link></>
                )}
              </Typography>
            ) : null)}
          </Box>
        )}

        {detail.currentStage === 'Data Gathering' && (
          detail.pendingReview ? (
            <Box ref={reviewRef}>
              <ReviewPanel detail={detail} item={item} gate="data" canAct highlighted={highlight}
                onDone={onRefresh} onSnackbar={onSnackbar} />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Waiting for the responsible person to submit the filing data.
              </Typography>
            </Box>
          )
        )}

        {detail.currentStage === 'Draft' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Attach the drafted report to send it to the CCO for sign-off.
            </Typography>
            <Button size="small" variant="contained" onClick={() => setDraftOpen(true)}>
              Upload draft &amp; send to CCO → Review
            </Button>
          </Box>
        )}

        {detail.currentStage === 'Review' && (
          detail.pendingReview && canReview ? (
            <Box ref={reviewRef}>
              <ReviewPanel detail={detail} item={item} gate="report" canAct highlighted={highlight}
                onDone={onRefresh} onSnackbar={onSnackbar} />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">Awaiting CCO review.</Typography>
            </Box>
          )
        )}

        {!isCompleted && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            The next filing period is created only when this one is accepted by the CCO.
          </Typography>
        )}

        {isCompleted && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon size={18} sx={{ color: 'success.main' }} />
              Completed {detail.completedAt ? formatDate(detail.completedAt) : ''}{detail.daysLate > 0 && ` (${detail.daysLate} days late)`}
            </Typography>
            {detail.submissionEvidenceUrl && (
              <Link href={detail.submissionEvidenceUrl} target="_blank" rel="noopener" variant="caption">View evidence</Link>
            )}
          </Box>
        )}
      </Section>

      {detail.notes && (
        <Section icon={<DocumentTextIcon />} title="Notes">
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.85rem' }}>{detail.notes}</Typography>
        </Section>
      )}

      <SubmitDraftDialog open={draftOpen} instanceId={detail.instanceId} period={detail.period}
        onClose={() => setDraftOpen(false)} onSaved={() => { setDraftOpen(false); onRefresh(); }}
        onSnackbar={onSnackbar} />
      <EscalationOverrideDialog open={escalationOpen} instanceId={detail.instanceId}
        onClose={() => setEscalationOpen(false)} onSnackbar={onSnackbar} />
    </Box>
  );
}

export function ReviewPanel({ detail, item, gate, canAct, onDone, onSnackbar, highlighted }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const isData = gate === 'data';
  if (!canAct) return null;

  const decide = async (decision) => {
    setBusy(true);
    try {
      const fn = isData ? api.returns.dataReview : api.returns.review;
      await fn(detail.instanceId, { decision, notes });
      onSnackbar?.(decision === 'ACCEPT'
        ? (isData ? 'Data accepted — moved to Draft.' : 'Report accepted — filing completed.')
        : (isData ? 'Data rejected — the link has been re-sent.' : 'Changes requested — moved back to Draft.'));
      onDone();
    } catch (e) { onSnackbar?.(e.message); }
    finally { setBusy(false); }
  };

  const ev = detail.reviewEvidenceRef;
  const evIsUrl = typeof ev === 'string' && /^https?:\/\//i.test(ev);
  return (
    <Box sx={{
      textAlign: 'left', border: '1px solid', borderRadius: 1, p: 2,
      borderColor: highlighted ? TL.accent : 'divider',
      boxShadow: highlighted ? `0 0 0 3px ${TL.accent}33` : 'none',
      bgcolor: highlighted ? '#FFFDF5' : 'transparent',
    }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {isData ? 'Submitted data — review before drafting' : 'Drafted report — review'}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 1.5 }}>
        <Field label="Responsible person" value={responsiblePersons(item).join(', ') || '—'} />
        <Field label="Submitted by" value={detail.reviewSubmittedByName || '—'} />
        <Field label="Submitted at" value={formatDateTime(detail.reviewSubmittedAt)} />
        <Field label="Submitted reference" value={ev && !evIsUrl ? ev : '—'} />
      </Box>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {isData ? 'Submitted data' : 'Drafted report'}
        </Typography>
        <EvidenceFileList sourceType="return_instance" sourceId={detail.instanceId}
          emptyText={isData ? 'No file was attached to this submission.' : 'No report was attached.'} />
        {evIsUrl && (
          <Link href={ev} target="_blank" rel="noopener" variant="body2" sx={{ display: 'inline-block', mt: 1 }}>
            Open the submitted link
          </Link>
        )}
      </Box>
      <TextField fullWidth size="small" multiline minRows={2} label="Notes (optional)"
        value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ mb: 1.5 }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => decide('ACCEPT')}>
          {isData ? 'Accept data → Draft' : 'Accept → Complete'}
        </Button>
        <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => decide('REJECT')}>
          {isData ? 'Reject & re-send link' : 'Request changes'}
        </Button>
      </Box>
    </Box>
  );
}

function EvidenceFileButton({ fileId }) {
  const query = useQuery({ queryKey: ['evidence', String(fileId)], queryFn: ({ signal }) => api.evidence.detail(fileId, { signal }) });
  const [error, setError] = useState('');
  async function download() {
    setError('');
    try {
      const file = await api.evidence.download(fileId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url; link.download = file.name; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || 'Evidence download failed'); }
  }
  return (
    <Tooltip title={error || query.data?.originalName || 'Download trigger evidence'}>
      <Button size="small" onClick={download} disabled={query.isPending || query.isError}>
        {query.isPending ? 'Loading…' : 'Evidence file'}
      </Button>
    </Tooltip>
  );
}
