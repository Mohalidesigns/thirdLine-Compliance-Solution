import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material';
import { TL } from 'shared';
import { api } from '../../services/api';

function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function WorkflowTimeline({ subjectTypes, subjectId }) {
  const types = (subjectTypes || []).join(',');
  const list = useQuery({
    queryKey: ['audit', 'subject', types, String(subjectId)],
    queryFn: () => api.audit.register({ subjectTypes: types, subjectId, size: 50 }),
    enabled: subjectId != null && types.length > 0,
    staleTime: 15_000,
  });
  const verify = useQuery({
    queryKey: ['audit', 'verify'],
    queryFn: () => api.audit.verify(),
    staleTime: 60_000,
  });

  const events = list.data?.content || [];
  const verified = verify.data?.chainValid === true;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Workflow &amp; audit</Typography>
        {verified && (
          <Chip size="small" label="Tamper-evident ✓" sx={{ bgcolor: '#F0FFF4', color: '#276749', fontWeight: 600 }} />
        )}
      </Box>

      {list.isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>}
      {list.isError && <Alert severity="error" sx={{ mb: 1 }}>{list.error?.message || 'Could not load the workflow.'}</Alert>}
      {!list.isLoading && events.length === 0 && (
        <Typography variant="body2" color="text.secondary">No recorded activity yet.</Typography>
      )}

      {events.length > 0 && (
        <Box sx={{ position: 'relative', pl: 2.5, '&::before': {
          content: '""', position: 'absolute', left: 6, top: 6, bottom: 6,
          width: 2, bgcolor: TL.gray100,
        } }}>
          {events.map((e) => (
            <Box key={e.eventId} sx={{ position: 'relative', mb: 2, '&::before': {
              content: '""', position: 'absolute', left: -19, top: 5, width: 10, height: 10,
              borderRadius: '50%', bgcolor: TL.primary, border: '2px solid #fff',
            } }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.actionDescription || e.action}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {e.actorName || 'System'}
                {e.fromStep && e.toStep ? ` · ${e.fromStep} → ${e.toStep}` : (e.toStep ? ` · ${e.toStep}` : '')}
                {e.occurredAt ? ` · ${formatWhen(e.occurredAt)}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
