import { useState } from 'react';
import {
  Alert, Box, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { StatusBadge, TL } from 'shared';
import { CARD_SX } from '../detailKit';
import {
  SECTION_TYPES, humanize, label, formatMinutes,
} from '../../pages/runbooks/runbookConstants';
import { CodeChip } from './LibraryBadges';

/**
 * Read-only renderers for a RunbookVersionTreeDto (sections → steps, prerequisites,
 * escalations, rollback steps). Used by the runbook detail page tabs.
 */

const SMALL_LABEL = {
  fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export function CommandBlock({ command, lang }) {
  const [copied, setCopied] = useState(false);
  if (!command) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — ignore */ }
  };
  return (
    <Box sx={{ mt: 1.5, borderRadius: '8px', overflow: 'hidden', border: `1px solid ${TL.gray200}` }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.5,
        bgcolor: TL.gray100, borderBottom: `1px solid ${TL.gray200}`,
      }}>
        <Typography sx={{ ...SMALL_LABEL, color: TL.gray500 }}>{lang && lang !== 'none' ? lang : 'command'}</Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy command'}>
          <IconButton size="small" onClick={copy} aria-label="Copy command">
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="pre" sx={{
        m: 0, p: 1.5, bgcolor: '#0F172A', color: '#E2E8F0', fontFamily: TL.mono, fontSize: '0.75rem',
        lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre',
      }}>
        {command}
      </Box>
    </Box>
  );
}

function StepCard({ step, clausesById }) {
  const clauses = (step.clauseIds || []).map((id) => clausesById?.get(id)).filter(Boolean);
  return (
    <Box sx={{ ...CARD_SX, p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, flexWrap: 'wrap' }}>
        <CodeChip label={step.stepCode} />
        <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: TL.gray800, flex: '1 1 240px' }}>
          {step.title || 'Untitled step'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {step.assignedRole && <Chip size="small" label={humanize(step.assignedRole)} sx={{ height: 22 }} />}
          {step.blocking && <StatusBadge label="Blocking" tone="red" />}
          {step.dualControl && <StatusBadge label="Dual control" tone="purple" />}
          {step.allowSkip && <StatusBadge label="Skippable" tone="gray" />}
          {step.durationEstimateMin != null && (
            <StatusBadge label={`~${formatMinutes(step.durationEstimateMin)}`} tone="blue" />
          )}
        </Box>
      </Box>

      {step.instructionMd && (
        <Typography sx={{ mt: 1.5, fontSize: '0.875rem', color: TL.gray700, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
          {step.instructionMd}
        </Typography>
      )}

      <CommandBlock command={step.commandBlock} lang={step.commandLang} />

      {step.expectedResult && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={SMALL_LABEL}>Expected result</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, whiteSpace: 'pre-wrap', mt: 0.25 }}>
            {step.expectedResult}
          </Typography>
        </Box>
      )}

      {step.safetyNote && (
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.25 }}>{step.safetyNote}</Alert>
      )}

      {(step.evidenceReqs?.length > 0 || clauses.length > 0) && (
        <Box sx={{ mt: 1.5, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {step.evidenceReqs?.length > 0 && (
            <Box>
              <Typography sx={SMALL_LABEL}>Evidence</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {step.evidenceReqs.map((r, i) => (
                  <Tooltip key={r.reqId ?? i}
                    title={`${humanize(r.evidenceType)}${r.retentionYears ? ` · keep ${r.retentionYears}y` : ''}`}>
                    <Chip size="small" variant={r.mandatory ? 'filled' : 'outlined'} color={r.mandatory ? 'primary' : 'default'}
                      label={`${r.label || humanize(r.evidenceType)}${r.mandatory ? ' *' : ''}`} sx={{ height: 22 }} />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}
          {clauses.length > 0 && (
            <Box>
              <Typography sx={SMALL_LABEL}>Clauses</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {clauses.map((c) => (
                  <Tooltip key={c.clauseId} title={c.title || ''}>
                    <Chip size="small" variant="outlined" label={`${c.frameworkCode} ${c.clauseRef}`} sx={{ height: 22 }} />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export function StepsView({ tree, clausesById }) {
  const sections = [...(tree?.sections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!sections.length) {
    return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No steps defined yet.</Typography>;
  }
  return sections.map((s, i) => {
    const steps = [...(s.steps || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return (
      <Box key={s.sectionId ?? i} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <StatusBadge label={label(SECTION_TYPES, s.sectionType)} tone="blue" />
          <Typography sx={{ fontWeight: 600, color: TL.gray800 }}>{s.title || label(SECTION_TYPES, s.sectionType)}</Typography>
          <Typography variant="caption" sx={{ color: TL.gray500 }}>{steps.length} step{steps.length !== 1 ? 's' : ''}</Typography>
        </Box>
        {s.description && (
          <Typography variant="body2" sx={{ color: TL.gray500, mb: 1.5, whiteSpace: 'pre-wrap' }}>{s.description}</Typography>
        )}
        {steps.length === 0
          ? <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No steps in this section.</Typography>
          : steps.map((st, j) => <StepCard key={st.stepId ?? j} step={st} clausesById={clausesById} />)}
      </Box>
    );
  });
}

export function PrerequisitesView({ tree }) {
  const items = tree?.prerequisites || [];
  if (!items.length) {
    return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No prerequisites defined.</Typography>;
  }
  return (
    <Box sx={{ ...CARD_SX, overflow: 'hidden' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 140 }}>Type</TableCell>
            <TableCell>Prerequisite</TableCell>
            <TableCell sx={{ width: 120 }}>Mandatory</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((p, i) => (
            <TableRow key={p.prereqId ?? i}>
              <TableCell><Chip size="small" label={humanize(p.prereqType)} sx={{ height: 22 }} /></TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.label || '—'}</Typography>
                {p.detail && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{p.detail}</Typography>}
              </TableCell>
              <TableCell>
                {p.mandatory ? <StatusBadge label="Mandatory" tone="red" /> : <StatusBadge label="Optional" tone="gray" />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function EscalationRollbackView({ tree }) {
  const escalations = [...(tree?.escalations || [])].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const rollback = [...(tree?.rollbackSteps || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return (
    <>
      <Typography sx={{ fontWeight: 600, color: TL.gray800, mb: 1.5 }}>Escalation matrix</Typography>
      {escalations.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>No escalation levels defined.</Typography>
      ) : (
        <Box sx={{ ...CARD_SX, overflow: 'hidden', mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 70 }}>Level</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Notify</TableCell>
                <TableCell>Wait</TableCell>
                <TableCell>Instructions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {escalations.map((e, i) => (
                <TableRow key={e.escalationId ?? i}>
                  <TableCell><StatusBadge label={`L${e.level}`} tone={e.level >= 3 ? 'red' : e.level === 2 ? 'orange' : 'amber'} /></TableCell>
                  <TableCell><Typography variant="body2">{humanize(e.triggerType)}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2">{humanize(e.notifyRole)}</Typography>
                    <Typography variant="caption" color="text.secondary">{humanize(e.notifyChannel)}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2">{e.waitMinutes ? formatMinutes(e.waitMinutes) : 'Immediate'}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{e.instructions || '—'}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Typography sx={{ fontWeight: 600, color: TL.gray800, mb: 1.5 }}>Rollback plan</Typography>
      {rollback.length === 0 ? (
        <Typography color="text.secondary">No rollback steps defined.</Typography>
      ) : rollback.map((r, i) => (
        <Box key={r.rollbackId ?? i} sx={{ ...CARD_SX, p: 2.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <StatusBadge label={`R${i + 1}`} tone="orange" />
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: TL.gray800 }}>{r.title || 'Rollback step'}</Typography>
            {r.reversesStepCode && (
              <Typography variant="caption" sx={{ color: TL.gray500 }}>reverses step <CodeChip label={r.reversesStepCode} /></Typography>
            )}
          </Box>
          {r.instructionMd && (
            <Typography sx={{ mt: 1.5, fontSize: '0.875rem', color: TL.gray700, whiteSpace: 'pre-wrap' }}>{r.instructionMd}</Typography>
          )}
          <CommandBlock command={r.commandBlock} />
          {r.verification && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={SMALL_LABEL}>Verification</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, whiteSpace: 'pre-wrap', mt: 0.25 }}>{r.verification}</Typography>
            </Box>
          )}
        </Box>
      ))}
    </>
  );
}
