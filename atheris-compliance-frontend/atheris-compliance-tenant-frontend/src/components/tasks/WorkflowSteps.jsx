import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, Typography } from '@mui/material';
import { TL, ChevronRightIcon, CheckCircleIcon } from 'shared';
import { api } from '../../services/api';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function returnSteps(detail) {
  return (detail?.stages || []).map((s) => ({
    label: s.name,
    done: !!s.completed && !(s.current ?? s.isCurrent),
    current: !!(s.current ?? s.isCurrent),
    who: s.completedByName,
    when: s.completedAt,
  }));
}

function controlSteps(d) {
  if (!d) return [];
  const review = d.lastTestReviewStatus;
  const inactive = (d.status || '').toLowerCase() !== 'active';
  const hasTest = !!d.lastTestDate;
  return [
    { label: inactive ? 'Inactive' : 'Active', done: hasTest, current: !hasTest,
      hint: inactive ? 'not active' : (hasTest ? null : 'untested') },
    { label: 'Tested', done: hasTest, hint: d.lastTestResult, who: d.testHistory?.[0]?.testedByName, when: d.lastTestDate },
    { label: 'Reviewed', done: review === 'Accepted', current: hasTest && review === 'Pending', hint: review },
    { label: 'Outcome', done: !!d.effectivenessState, current: review === 'Accepted' && !d.effectivenessState, hint: d.effectivenessState },
  ];
}

function findingSteps(d) {
  if (!d) return [];
  const s = d.status;
  return [
    { label: 'Raised', done: true, when: d.createdAt },
    { label: 'Assigned', done: !!d.assignedAt, who: d.assignedToName, when: d.assignedAt, current: s === 'Open' && !d.assignedAt },
    { label: 'Remediation', done: !!d.remediationSubmittedAt, when: d.remediationSubmittedAt, current: s === 'In Remediation' || (s === 'Open' && !!d.assignedAt) },
    { label: 'Review', done: !!d.signedOffAt, when: d.signedOffAt, current: s === 'Remediated' },
    { label: 'Closed', done: !!d.closedAt, when: d.closedAt },
  ];
}

function StepPill({ step }) {
  const bg = step.done ? TL.primary : 'transparent';
  const border = step.done || step.current ? TL.primary : '#E2E8F0';
  const color = step.done ? '#fff' : (step.current ? TL.primary : 'text.secondary');
  return (
    <Box sx={{ minWidth: 92, flex: '0 0 auto', textAlign: 'center' }}>
      <Box sx={{
        px: 1.25, py: 0.4, borderRadius: '999px', border: '1.5px solid', borderColor: border, bgcolor: bg,
        display: 'inline-flex', alignItems: 'center', gap: 0.5, color, fontWeight: step.current ? 700 : 600, fontSize: '0.8125rem',
      }}>
        {step.done && <CheckCircleIcon size={14} />}
        {step.label}
      </Box>
      {(step.who || step.hint || step.when) && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
          {[step.who, step.hint, step.when ? fmtDate(step.when) : ''].filter(Boolean).join(' · ')}
        </Typography>
      )}
    </Box>
  );
}

export default function WorkflowSteps({ subjectType, subjectId, sourceRef }) {
  const instanceId = sourceRef?.instanceId ?? (subjectType === 'RETURN' ? subjectId : null);

  const q = useQuery({
    queryKey: ['workflow', subjectType, String(subjectId)],
    enabled: subjectId != null && ['RETURN', 'CONTROL', 'FINDING'].includes(subjectType),
    staleTime: 15_000,
    queryFn: ({ signal }) => {
      if (subjectType === 'RETURN') return api.returns.detail(instanceId, { signal });
      if (subjectType === 'CONTROL') return api.controls.detail(subjectId);
      if (subjectType === 'FINDING') return api.findings.detail(subjectId);
      return Promise.resolve(null);
    },
  });

  if (subjectType === 'OBLIGATION') {
    return <Typography variant="body2" color="text.secondary">Obligations have no step workflow — see the activity log.</Typography>;
  }
  if (q.isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>;
  if (q.isError) return <Typography variant="body2" color="text.secondary">Could not load the workflow.</Typography>;

  const steps = (subjectType === 'RETURN' ? returnSteps(q.data)
    : subjectType === 'CONTROL' ? controlSteps(q.data)
      : findingSteps(q.data)).filter((s) => s.label);
  if (!steps.length) return <Typography variant="body2" color="text.secondary">No workflow yet.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Workflow</Typography>
        <Typography variant="caption" color="text.secondary">the progression, each step once</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
        {steps.map((s, i) => (
          <Fragment key={`${s.label}-${i}`}>
            {i > 0 && (
              <Box sx={{ flex: '1 1 auto', minWidth: 56, display: 'flex', alignItems: 'center', mt: '11px',
                color: steps[i - 1].done ? TL.primary : '#CBD5E0' }}>
                <Box sx={{ flex: 1, height: 2, borderRadius: 1, bgcolor: 'currentColor', opacity: 0.5 }} />
                <ChevronRightIcon size={18} />
              </Box>
            )}
            <StepPill step={s} />
          </Fragment>
        ))}
      </Box>
    </Box>
  );
}
