import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Link, Snackbar, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowDownTrayIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, ClockIcon, DocumentCheckIcon,
  ExclamationCircleIcon, FingerPrintIcon, LinkIcon, QueueListIcon, ScaleIcon, ShieldCheckIcon,
  PageHeader, SectionTable, StatusBadge, TL,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import { Section, StatTile } from '../../components/detailKit';
import EvidenceList, { HashText } from '../../components/runbooks/execution/EvidenceList';
import { StepStatusIcon } from '../../components/runbooks/execution/StepList';
import { allowedSignoffRoles, EvidencePackDialog, SignoffDialog } from '../../components/runbooks/execution/ExecutionDialogs';
import {
  errorMessage, execTone, executionKey, executionTimelineKey, formatDateTime, formatDuration, isActiveExecution,
  orderedSteps, outcomeTone, statusLabel, stepTone, useApplyExecution,
} from '../../components/runbooks/execution/executionUtils';
import { PACK_ROLES, humanize } from './runbookConstants';

const SIGNOFF_STATUSES = ['PENDING_SIGNOFF', 'COMPLETED_PASS', 'COMPLETED_FAIL'];

const STEP_COLUMNS = [
  { id: 'step', label: 'Step', minWidth: 260, render: (s) => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <StepStatusIcon status={s.status} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: TL.mono, fontSize: '0.6875rem', color: TL.gray500 }}>
          {s.rollback ? 'Rollback · ' : ''}{s.stepCode || '–'}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 340 }}>{s.title}</Typography>
      </Box>
    </Box>
  ) },
  { id: 'status', label: 'Status', minWidth: 120, render: (s) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
      <StatusBadge label={statusLabel(s.status)} tone={stepTone(s.status)} />
      {s.failureCategory && <Typography variant="caption" color="error">{humanize(s.failureCategory)}</Typography>}
    </Box>
  ) },
  { id: 'people', label: 'Performed / verified by', minWidth: 170, render: (s) => (
    <Box>
      <Typography variant="body2">{s.performedByName || '—'}</Typography>
      {s.dualControl && (
        <Typography variant="caption" color={s.verifiedByName ? 'text.secondary' : 'warning.main'}>
          {s.verifiedByName ? `verified by ${s.verifiedByName}` : 'not verified'}
        </Typography>
      )}
    </Box>
  ) },
  { id: 'actual', label: 'Actual result', minWidth: 220, render: (s) => {
    const text = s.actualResult || s.skipReason || '';
    return text ? (
      <Tooltip title={text}>
        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.skipReason && !s.actualResult ? `Skipped: ${text}` : text}
        </Typography>
      </Tooltip>
    ) : <Typography variant="body2" color="text.secondary">—</Typography>;
  } },
  { id: 'evidence', label: 'Evidence', minWidth: 90, render: (s) => {
    const n = (s.evidence || []).length;
    const missing = (s.evidenceReqs || []).filter((r) => r.mandatory && !r.satisfied).length;
    return (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{n}</Typography>
        {missing > 0 && <Typography variant="caption" color="warning.main">{missing} missing</Typography>}
      </Box>
    );
  } },
];

export default function ExecutionSummaryPage() {
  const { execId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const apply = useApplyExecution(execId);
  const [dialog, setDialog] = useState(null); // 'signoff' | 'pack'
  const [snack, setSnack] = useState(null);
  const [stepPage, setStepPage] = useState(0);
  const [stepSize, setStepSize] = useState(20);
  const [downloading, setDownloading] = useState(false);

  const query = useQuery({
    queryKey: executionKey(execId),
    queryFn: ({ signal }) => api.runbooks.executions.get(execId, { signal }),
  });
  const timelineQuery = useQuery({
    queryKey: executionTimelineKey(execId),
    queryFn: ({ signal }) => api.runbooks.executions.timeline(execId, { signal }),
  });

  const exec = query.data;
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

  const steps = orderedSteps(exec.steps || []);
  const allEvidence = steps.flatMap((s) => (s.evidence || []).map((ev) => ({ ...ev, _stepCode: s.stepCode })));
  const signoffs = exec.signoffs || [];
  const clauses = exec.clauses || [];
  const controls = exec.linkedControlIds || [];
  const timeline = Array.isArray(timelineQuery.data) ? timelineQuery.data : (timelineQuery.data?.content || []);
  const signoffRoles = allowedSignoffRoles(user, exec);
  const canSignoff = signoffRoles.length > 0 && SIGNOFF_STATUSES.includes(exec.status);
  const canPack = PACK_ROLES.includes(user?.role);
  const durationMs = exec.startedAt
    ? new Date(exec.completedAt || exec.closedAt || Date.now()).getTime() - new Date(exec.startedAt).getTime()
    : null;
  const toast = (msg, severity = 'success') => setSnack({ msg, severity });

  const downloadPack = async () => {
    setDownloading(true);
    try { await api.runbooks.executions.downloadPack(execId); }
    catch (e) { toast(errorMessage(e, 'Download failed'), 'error'); }
    finally { setDownloading(false); }
  };

  const pagedSteps = steps.slice(stepPage * stepSize, stepPage * stepSize + stepSize);

  return (
    <Box>
      <PageHeader
        title={`${exec.executionRef || `Execution #${exec.executionId}`} — summary`}
        subtitle={(
          <>
            <Link component={RouterLink} to={`/runbooks/${exec.runbookId}`} underline="hover">
              <Box component="span" sx={{ fontFamily: TL.mono }}>{exec.runbookCode}</Box> {exec.runbookTitle}
            </Link>
            {exec.versionNumber != null ? ` · v${exec.versionNumber}` : ''}
            {exec.operatorName ? ` · operator ${exec.operatorName}` : ''}
            {exec.triggerType ? ` · ${humanize(exec.triggerType)}` : ''}
          </>
        )}
        onBack={() => navigate('/runbooks/executions')}
        backLabel="Executions"
        actions={(
          <>
            {isActiveExecution(exec.status) && (
              <Button variant="outlined" onClick={() => navigate(`/runbooks/executions/${execId}`)}>Open console</Button>
            )}
            <Button variant="outlined" startIcon={<ExclamationCircleIcon size={16} />} onClick={() => navigate('/findings')}>
              {exec.findingId ? 'View finding' : 'Raise finding'}
            </Button>
            {canPack && (
              <Button variant="outlined" startIcon={<DocumentCheckIcon size={16} />} onClick={() => setDialog('pack')}>
                Generate evidence pack
              </Button>
            )}
            {canSignoff && (
              <Button variant="contained" startIcon={<ClipboardDocumentCheckIcon size={16} />} onClick={() => setDialog('signoff')}>
                Sign-off
              </Button>
            )}
          </>
        )}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge label={statusLabel(exec.status)} tone={execTone(exec.status)} />
          {exec.outcome && <StatusBadge label={`Outcome ${exec.outcome}`} tone={outcomeTone(exec.outcome)} />}
          {exec.overdue && <StatusBadge label="Overdue" tone="red" />}
          {exec.findingId && <StatusBadge label={`Finding #${exec.findingId}`} tone="purple" />}
        </Box>
      </PageHeader>

      <RunbooksNav />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatTile icon={<CheckCircleIcon />} label="Outcome"
          chip={exec.outcome
            ? <StatusBadge label={exec.outcome} tone={outcomeTone(exec.outcome)} />
            : <StatusBadge label={statusLabel(exec.status)} tone={execTone(exec.status)} />} />
        <StatTile icon={<ClockIcon />} label="Duration" value={durationMs != null ? formatDuration(durationMs) : 'Not started'} />
        <StatTile icon={<QueueListIcon />} label="Steps"
          value={`${exec.stepsPassed ?? 0} passed · ${exec.stepsFailed ?? 0} failed · ${exec.stepsSkipped ?? 0} skipped / ${exec.stepsTotal ?? steps.length}`} />
        <StatTile icon={<FingerPrintIcon />} label="Evidence"
          value={`${exec.evidenceCount ?? allEvidence.length} items · ${exec.evidenceCompleteness ?? 0}% complete`} />
      </Box>

      <Section icon={<ClockIcon />} title="Timings">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 2 }}>
          {[
            ['Created', exec.createdAt], ['Pre-flight', exec.preflightCompletedAt], ['Started', exec.startedAt],
            ['Due', exec.dueAt], ['Completed', exec.completedAt], ['Closed', exec.closedAt],
          ].map(([label, v]) => (
            <Box key={label}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
              <Typography variant="body2">{formatDateTime(v)}</Typography>
            </Box>
          ))}
        </Box>
        {exec.outcomeSummary && (
          <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{exec.outcomeSummary}</Typography>
        )}
      </Section>

      <Section icon={<ScaleIcon />} title="Clauses satisfied"
        subtitle={clauses.length ? `${clauses.length} framework clause${clauses.length === 1 ? '' : 's'} evidenced by this run` : undefined}>
        {clauses.length === 0
          ? <Typography variant="body2" color="text.secondary">No framework clauses are mapped to this runbook.</Typography>
          : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {clauses.map((c) => (
                <Tooltip key={c.clauseId} title={c.title || c.requirementText || ''}>
                  <Chip size="small" color={exec.outcome === 'PASS' ? 'success' : 'default'} variant="outlined"
                    label={`${c.frameworkCode || ''} ${c.clauseRef || ''}`.trim()} />
                </Tooltip>
              ))}
            </Box>
          )}
      </Section>

      <Section icon={<QueueListIcon />} title="Procedure as executed" contentSx={{ p: 0 }}
        subtitle={`${steps.length} step${steps.length === 1 ? '' : 's'}`}>
        <SectionTable
          columns={STEP_COLUMNS}
          rows={pagedSteps}
          total={steps.length}
          page={stepPage}
          size={stepSize}
          onPage={setStepPage}
          onSize={(s) => { setStepSize(s); setStepPage(0); }}
          rowKey={(s) => s.stepExecId}
          emptyMessage="No steps."
        />
      </Section>

      <Section icon={<FingerPrintIcon />} title="Evidence gallery"
        subtitle={`${allEvidence.length} item${allEvidence.length === 1 ? '' : 's'} · immutable, SHA-256 hashed`}>
        <EvidenceList execId={execId} items={allEvidence} stepLabel={(ev) => ev._stepCode || 'step'}
          onError={(m) => toast(m, 'error')} />
      </Section>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Section icon={<ClipboardDocumentCheckIcon />} title="Sign-offs" sx={{ mb: 0 }}
          subtitle={`Mandatory evidence ${exec.evidenceCompleteness ?? 0}% complete`}
          action={canSignoff ? <Button size="small" onClick={() => setDialog('signoff')}>Sign-off</Button> : null}>
          {signoffs.length === 0 && <Typography variant="body2" color="text.secondary">No sign-offs recorded yet.</Typography>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {signoffs.map((s) => (
              <Box key={s.signoffId} sx={{ borderLeft: `3px solid ${s.decision === 'ACCEPTED' ? TL.success : TL.error}`, pl: 1.25 }}>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge label={humanize(s.signoffRole)} tone="blue" />
                  <StatusBadge label={humanize(s.decision)} tone={s.decision === 'ACCEPTED' ? 'green' : 'red'} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.userName || '—'}</Typography>
                </Box>
                {s.comment && <Typography variant="body2" sx={{ mt: 0.5 }}>{s.comment}</Typography>}
                <Typography variant="caption" color="text.secondary">{formatDateTime(s.signedAt)}</Typography>
              </Box>
            ))}
          </Box>
        </Section>

        <Section icon={<DocumentCheckIcon />} title="Evidence pack" sx={{ mb: 0 }}
          action={canPack ? <Button size="small" onClick={() => setDialog('pack')}>{exec.packAvailable ? 'Regenerate' : 'Generate'}</Button> : null}>
          {exec.packAvailable ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Generated {formatDateTime(exec.packGeneratedAt)}</Typography>
              <HashText hash={exec.packHash} label="Pack SHA-256" />
              <Box sx={{ mt: 1.5 }}>
                <Button variant="contained" size="small" disabled={downloading} onClick={downloadPack}
                  startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <ArrowDownTrayIcon size={16} />}>
                  Download pack
                </Button>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No pack generated yet. A pack bundles every evidence file, a SHA-256 manifest, sign-offs and clauses.
            </Typography>
          )}
        </Section>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3, mt: 3 }}>
        <Section icon={<ShieldCheckIcon />} title="Linked controls" sx={{ mb: 0 }}
          action={<Button size="small" component={RouterLink} to="/controls">Controls register</Button>}>
          {controls.length === 0
            ? <Typography variant="body2" color="text.secondary">No controls linked to this runbook.</Typography>
            : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {controls.map((id) => (
                  <Chip key={id} size="small" icon={<LinkIcon size={14} />} label={`Control #${id}`} clickable
                    onClick={() => navigate('/controls')} />
                ))}
              </Box>
            )}
        </Section>

        <Section icon={<ClockIcon />} title="Timeline" sx={{ mb: 0 }}>
          {timelineQuery.isPending && <CircularProgress size={20} />}
          {timelineQuery.error && <Alert severity="warning">{timelineQuery.error.message}</Alert>}
          {!timelineQuery.isPending && !timelineQuery.error && timeline.length === 0 && (
            <Typography variant="body2" color="text.secondary">No events recorded.</Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 420, overflowY: 'auto' }}>
            {timeline.map((ev) => (
              <Box key={ev.eventId} sx={{ display: 'flex', gap: 1.5, borderLeft: `2px solid ${TL.gray200}`, pl: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{humanize(ev.action)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ev.actorName || 'System'} · {formatDateTime(ev.occurredAt)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Section>
      </Box>

      {dialog === 'signoff' && (
        <SignoffDialog execution={exec} roles={signoffRoles} onClose={() => setDialog(null)}
          onSubmit={async (p) => { apply(await api.runbooks.executions.signoff(execId, p)); toast('Sign-off recorded'); }} />
      )}
      {dialog === 'pack' && (
        <EvidencePackDialog execution={exec} onClose={() => setDialog(null)}
          onSubmit={async (p) => apply(await api.runbooks.executions.generatePack(execId, p))} />
      )}

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
