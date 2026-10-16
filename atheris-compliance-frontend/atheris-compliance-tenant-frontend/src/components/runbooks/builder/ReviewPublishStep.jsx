import { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  List, ListItemButton, ListItemText, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  DataCard, StatusBadge, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon,
  ShieldCheckIcon, DocumentCheckIcon, TL,
} from 'shared';
import { SECTION_TYPES, formatMinutes, humanize, label as labelOf } from '../../../pages/runbooks/runbookConstants';

const MONO_BLOCK = {
  fontFamily: TL.mono, fontSize: '0.75rem', bgcolor: TL.gray800, color: '#F9FAFB', p: 1.5, borderRadius: '6px',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 1,
};

function IssueGroup({ title, issues, severity, onJump }) {
  if (!issues.length) return null;
  const err = severity === 'ERROR';
  const Icon = err ? ExclamationCircleIcon : ExclamationTriangleIcon;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: err ? TL.error : TL.warning, textTransform: 'uppercase', mb: 0.5 }}>
        {title} ({issues.length})
      </Typography>
      <List dense disablePadding sx={{ border: `1px solid ${TL.gray100}`, borderRadius: '8px' }}>
        {issues.map((i, n) => (
          <ListItemButton key={`${i.rule}-${n}`} divider={n < issues.length - 1} onClick={() => onJump(i)}>
            <Box sx={{ color: err ? TL.error : TL.warning, mr: 1.5, display: 'flex' }}><Icon size={16} /></Box>
            <ListItemText
              primary={<><b>{i.rule}</b> · {i.message}</>}
              secondary={i.stepCode ? `Step ${i.stepCode} — jump to step` : 'Jump to section'}
              slotProps={{ primary: { sx: { fontSize: '0.8125rem' } }, secondary: { sx: { fontSize: '0.75rem' } } }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

function OperatorPreview({ meta, tree }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{meta.title}</Typography>
      {meta.objective && <Typography sx={{ fontSize: '0.8125rem', color: TL.gray600, mt: 0.5, whiteSpace: 'pre-wrap' }}>{meta.objective}</Typography>}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        <StatusBadge label={meta.criticality} tone={meta.criticality === 'LOW' ? 'green' : meta.criticality === 'MEDIUM' ? 'yellow' : 'red'} dot />
        <StatusBadge label={humanize(meta.frequency)} tone="gray" />
        {meta.slaMinutes ? <StatusBadge label={`SLA ${formatMinutes(Number(meta.slaMinutes))}`} tone="blue" /> : null}
      </Box>

      {tree.prerequisites.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: TL.gray500, textTransform: 'uppercase', mb: 1 }}>Pre-flight checklist</Typography>
          {tree.prerequisites.map((p) => (
            <Typography key={p._key} sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
              ☐ <b>{humanize(p.prereqType)}</b>: {p.label}{p.detail ? ` — ${p.detail}` : ''}{p.mandatory ? '' : ' (optional)'}
            </Typography>
          ))}
        </>
      )}

      {tree.sections.map((s) => (
        <Box key={s._key}>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: TL.gray500, textTransform: 'uppercase' }}>
            {labelOf(SECTION_TYPES, s.sectionType)}{s.title ? ` · ${s.title}` : ''}
          </Typography>
          {s.steps.map((st) => (
            <Box key={st._key} sx={{ mt: 1.5, pl: 1.5, borderLeft: `3px solid ${st.blocking ? TL.primary : TL.gray200}` }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                <Box component="span" sx={{ fontFamily: TL.mono, color: TL.gray500, mr: 1 }}>{st.stepCode}</Box>{st.title}
                {st.assignedRole && <Box component="span" sx={{ ml: 1, fontWeight: 400, color: TL.gray500, fontSize: '0.75rem' }}>· {humanize(st.assignedRole)}</Box>}
                {st.durationEstimateMin != null && <Box component="span" sx={{ ml: 1, fontWeight: 400, color: TL.gray500, fontSize: '0.75rem' }}>· ~{st.durationEstimateMin} min</Box>}
              </Typography>
              {st.safetyNote && <Alert severity="warning" sx={{ mt: 0.75, py: 0 }}>{st.safetyNote}</Alert>}
              <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', mt: 0.5 }}>{st.instructionMd}</Typography>
              {st.commandBlock && <Box sx={MONO_BLOCK}>{st.commandBlock}</Box>}
              {st.expectedResult && (
                <Typography sx={{ fontSize: '0.8125rem', mt: 0.75 }}><b>Expected:</b> {st.expectedResult}</Typography>
              )}
              {st.evidenceReqs.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                  {st.evidenceReqs.map((e) => (
                    <StatusBadge key={e._key || e.label} tone={e.mandatory ? 'green' : 'gray'}
                      label={`${humanize(e.evidenceType)}: ${e.label || '—'}${e.mandatory ? ' *' : ''}`} />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
                {st.dualControl && <StatusBadge label="Requires second-person verification" tone="purple" />}
                {st.allowSkip && <StatusBadge label="May be skipped with reason" tone="gray" />}
              </Box>
            </Box>
          ))}
        </Box>
      ))}

      {tree.escalations.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: TL.gray500, textTransform: 'uppercase', mb: 1 }}>Escalation</Typography>
          {tree.escalations.map((e) => (
            <Typography key={e._key} sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
              L{e.level} · on {humanize(e.triggerType)} → {humanize(e.notifyRole)} via {humanize(e.notifyChannel)}
              {e.waitMinutes ? ` after ${e.waitMinutes} min` : ''}{e.instructions ? ` — ${e.instructions}` : ''}
            </Typography>
          ))}
        </>
      )}
      {tree.rollbackSteps.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: TL.gray500, textTransform: 'uppercase', mb: 1 }}>Rollback</Typography>
          {tree.rollbackSteps.map((r) => (
            <Box key={r._key} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                {r.reversesStepCode ? `Reverses ${r.reversesStepCode} · ` : ''}{r.title}
              </Typography>
              {r.instructionMd && <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>{r.instructionMd}</Typography>}
              {r.commandBlock && <Box sx={MONO_BLOCK}>{r.commandBlock}</Box>}
              {r.verification && <Typography sx={{ fontSize: '0.8125rem', mt: 0.5 }}><b>Verify:</b> {r.verification}</Typography>}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

/** Step 5 — lint report (M29), operator preview, Save draft / Submit / Publish. */
export default function ReviewPublishStep({
  meta, tree, lint, linting, onRelint, onJump, readOnly, saving, dirty,
  onSaveDraft, onSubmit, submitting, canPublishRole, onPublish, publishing,
}) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const issues = lint?.issues || [];
  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warns = issues.filter((i) => i.severity !== 'ERROR');
  const errorCount = lint ? (lint.errors ?? errors.length) : null;
  const lintClean = errorCount === 0;
  const lowCrit = meta.criticality === 'LOW' || meta.criticality === 'MEDIUM';
  const showPublish = canPublishRole && lowCrit;
  const busy = saving || submitting || publishing || linting;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DataCard
        title="Lint report"
        subtitle="Server-side checks (L1–L10). Errors block submission and publishing."
        actions={(
          <Button size="small" startIcon={linting ? <CircularProgress size={14} /> : <ArrowPathIcon size={14} />}
            disabled={linting} onClick={onRelint}>
            Re-run lint
          </Button>
        )}
      >
        {!lint && !linting && <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>Lint has not run yet.</Typography>}
        {linting && !lint && <CircularProgress size={22} />}
        {lint && issues.length === 0 && (
          <Alert icon={<CheckCircleIcon size={18} />} severity="success">No issues — this version is lint clean.</Alert>
        )}
        <IssueGroup title="Errors" severity="ERROR" issues={errors} onJump={onJump} />
        <IssueGroup title="Warnings" severity="WARN" issues={warns} onJump={onJump} />
      </DataCard>

      {!readOnly && (
        <DataCard title="Submit or publish">
          {dirty && <Alert severity="info" sx={{ mb: 2 }}>You have unsaved changes — they are saved automatically before submitting.</Alert>}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="outlined" disabled={busy} onClick={onSaveDraft}
              startIcon={saving ? <CircularProgress size={14} /> : <DocumentCheckIcon size={16} />}>
              Save draft
            </Button>
            <Tooltip title={errorCount > 0 ? 'Resolve lint errors first' : lint ? '' : 'Run lint first'}>
              <span>
                <Button variant="contained" disabled={busy || !lintClean} onClick={onSubmit}
                  startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <ShieldCheckIcon size={16} />}>
                  Submit for approval
                </Button>
              </span>
            </Tooltip>
            {showPublish && (
              <Tooltip title={errorCount > 0 ? 'Resolve lint errors first' : ''}>
                <span>
                  <Button variant="contained" color="success" disabled={busy || !lintClean}
                    onClick={() => { setSummary(''); setPublishOpen(true); }}>
                    Publish
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, mt: 1.5 }}>
            {lowCrit
              ? (canPublishRole
                ? 'LOW/MEDIUM runbooks may be published directly by a CCO or Tenant Admin, or submitted for approval.'
                : 'Submit for approval — a CCO or Tenant Admin publishes it.')
              : `${meta.criticality} runbooks must be approved by a CCO/Tenant Admin other than the author before publishing.`}
          </Typography>
        </DataCard>
      )}

      <DataCard title="Operator preview" subtitle="What the operator sees in the execution console.">
        <OperatorPreview meta={meta} tree={tree} />
      </DataCard>

      <Dialog open={publishOpen} onClose={() => !publishing && setPublishOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Publish version</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: '0.875rem', mb: 2 }}>
            Publishing makes this version executable and supersedes the current published version
            (running executions continue on their version).
          </Typography>
          <TextField fullWidth multiline minRows={3} size="small" label="Change summary" required autoFocus
            value={summary} onChange={(e) => setSummary(e.target.value)}
            error={summary.length > 0 && summary.trim().length < 10}
            helperText={`${summary.trim().length}/10 characters minimum`} />
        </DialogContent>
        <DialogActions>
          <Button disabled={publishing} onClick={() => setPublishOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" disabled={publishing || summary.trim().length < 10}
            onClick={() => onPublish(summary.trim())}
            startIcon={publishing ? <CircularProgress size={14} color="inherit" /> : null}>
            Publish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
