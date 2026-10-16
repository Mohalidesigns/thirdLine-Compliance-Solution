import { Box, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CardLink, DataCard, TL, TONES } from 'shared';
import { api } from '../../services/api';

function formatWhen(iso) {
  if (!iso) return '—';
  // A bare LocalDate (e.g. a schedule's next run) has no time — don't render UTC midnight as a local time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
    const [y, m, day] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Dashboard widget for Compliance Runbooks (RunbookDashboardDto). Hidden entirely when the
 * endpoint is unavailable (e.g. 404 on a backend without the runbooks module) or errors.
 * Drill-down links pass only params the target pages read:
 *   Executions → ?status= / ?overdue=true ; Library → ?needsReview=true.
 */
export default function RunbooksWidget({ sx }) {
  const navigate = useNavigate();
  const { data, isError, isLoading } = useQuery({
    queryKey: ['runbooks-dashboard'],
    queryFn: ({ signal }) => api.runbooks.dashboard({ signal }),
    retry: false,
    refetchInterval: 60_000,
  });

  if (isLoading || isError || !data) return null;

  const tiles = [
    { key: 'upcoming', label: 'Upcoming (7d)', value: data.upcoming7d ?? 0, tone: 'blue',
      to: '/runbooks/executions?status=NOT_STARTED' },
    { key: 'overdue', label: 'Overdue', value: data.overdue ?? 0, tone: 'red',
      to: '/runbooks/executions?overdue=true' },
    { key: 'escalations', label: 'Open escalations', value: data.openEscalations ?? 0, tone: 'orange',
      to: '/runbooks/executions?status=ESCALATED' },
    { key: 'review', label: 'Review backlog', value: data.reviewBacklog ?? 0, tone: 'amber',
      to: '/runbooks?needsReview=true' },
    { key: 'approvals', label: 'Pending approvals', value: data.pendingApprovals ?? 0, tone: 'purple',
      to: '/runbooks/approvals' },
  ];
  const upcoming = (data.upcoming || []).slice(0, 5);

  return (
    <DataCard
      title="Runbooks"
      subtitle={`${data.activeExecutions ?? 0} execution${data.activeExecutions === 1 ? '' : 's'} in progress`}
      actions={<CardLink onClick={() => navigate('/runbooks')}>View All</CardLink>}
      sx={{ mb: 3, ...sx }}
    >
      <Box sx={{
        display: 'grid', gap: 1.5, mb: upcoming.length ? 2.5 : 0,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
      }}>
        {tiles.map((t) => {
          const tone = TONES[t.tone];
          const hot = t.value > 0 && (t.key === 'overdue' || t.key === 'escalations');
          return (
            <Box
              key={t.key}
              component="button"
              type="button"
              onClick={() => navigate(t.to)}
              sx={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '8px', p: 1.5,
                border: `1px solid ${hot ? tone.dot : TL.gray100}`, bgcolor: tone.tile,
                '&:hover': { borderColor: tone.dot },
              }}
            >
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em' }} noWrap>
                {t.label}
              </Typography>
              <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, color: tone.value, lineHeight: 1.4 }}>{t.value}</Typography>
            </Box>
          );
        })}
      </Box>

      {upcoming.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
            Next scheduled runs
          </Typography>
          {upcoming.map((u, i) => (
            <Box
              key={`${u.runbookId}-${i}`}
              onClick={() => navigate(`/runbooks/${u.runbookId}`)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.75, cursor: 'pointer',
                borderTop: i === 0 ? 0 : `1px solid ${TL.gray100}`, '&:hover': { bgcolor: TL.gray50 },
              }}
            >
              <Chip label={u.runbookCode || '—'} size="small" variant="outlined"
                sx={{ height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' }} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={u.title}>{u.title}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{formatWhen(u.nextRunAt)}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </DataCard>
  );
}
