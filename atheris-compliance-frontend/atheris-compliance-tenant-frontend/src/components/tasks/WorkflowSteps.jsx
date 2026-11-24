import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, Typography } from '@mui/material';
import { TL } from 'shared';
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
  return [
    { label: 'Control active', done: (d.status || '').toLowerCase() === 'active' },
    { label: 'Test scheduled', done: !!d.lastTestDate, current: !d.lastTestDate, hint: d.nextTestDueDate ? `due ${fmtDate(d.nextTestDueDate)}` : null },
    { label: 'Test recorded', done: !!d.lastTestDate, current: !!d.lastTestDate && review === 'Pending', hint: d.lastTestResult, who: d.testHistory?.[0]?.testedByName, when: d.lastTestDate },
    { label: 'Reviewed', done: review === 'Accepted', current: review === 'Pending', hint: review },
    { label: 'Outcome', done: !!d.effectivenessState, current: review === 'Accepted' && !d.effectivenessState, hint: d.effectivenessState },
  ];
}

function findingSteps(d) {
  if (!d) return [];
  const s = d.status;
  return [
    { label: 'Finding raised', done: true, when: d.createdAt },
    { label: 'Assigned', done: !!d.assignedAt, who: d.assignedToName, when: d.assignedAt, current: s === 'Open' && !d.assignedAt },
    { label: 'In remediation', done: !!d.remediationSubmittedAt, when: d.remediationSubmittedAt, current: s === 'In Remediation' || (s === 'Open' && !!d.assignedAt) },
    { label: 'Review & sign off', done: !!d.signedOffAt, when: d.signedOffAt, current: s === 'Remediated' },
    { label: 'Closed', done: !!d.closedAt, when: d.closedAt },
  ];
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

  const steps = subjectType === 'RETURN' ? returnSteps(q.data)
    : subjectType === 'CONTROL' ? controlSteps(q.data)
      : findingSteps(q.data);
  const shown = steps.filter((s) => s.label);
  if (!shown.length) return <Typography variant="body2" color="text.secondary">No workflow yet.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Workflow</Typography>
        <Typography variant="caption" color="text.secondary">the {shown.length} steps, each once</Typography>
      </Box>
      <Box sx={{ position: 'relative', pl: 3, '&::before': { content: '""', position: 'absolute', left: 9, top: 8, bottom: 8, width: 2, bgcolor: TL.gray100 } }}>
        {shown.map((s, i) => {
          const active = s.done;
          return (
            <Box key={`${s.label}-${i}`} sx={{ position: 'relative', mb: 2, '&::before': {
              content: '""', position: 'absolute', left: -22, top: 3, width: 14, height: 14, borderRadius: '50%',
              bgcolor: active ? TL.primary : (s.current ? '#fff' : '#fff'),
              border: `2px solid ${active ? TL.primary : (s.current ? TL.primary : '#CBD5E0')}`,
              boxSizing: 'border-box',
            } }}>
              <Typography variant="body2" sx={{ fontWeight: s.current ? 700 : 600, color: s.current ? 'primary.main' : 'text.primary' }}>
                {s.label}
                {s.current ? ' · current' : ''}
              </Typography>
              {(s.who || s.when || s.hint) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {[s.who, s.hint, s.when ? fmtDate(s.when) : ''].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
