import { Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataCard, CardLink, StatusBadge, TL, tone } from 'shared';

/** Key-value row with an 8px rounded progress bar on a gray-200 track. */
function ProgressRow({ label, count, total, toneName, onClick }) {
  const pct = total > 0 ? ((count / total) * 100) : 0;
  const badgeTone = pct >= 90 ? 'green' : pct >= 70 ? 'orange' : 'red';
  return (
    <Box
      onClick={onClick}
      sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover .tl-kv-label': onClick ? { color: TL.primary } : undefined }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Typography className="tl-kv-label" sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {total > 0 && <StatusBadge label={`${pct.toFixed(2)}%`} tone={badgeTone} />}
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, minWidth: 28, textAlign: 'right' }}>
            {count}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ height: 8, borderRadius: 9999, bgcolor: TL.gray200, overflow: 'hidden' }}>
        <Box sx={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 9999, bgcolor: tone(toneName).dot, transition: 'width 0.5s' }} />
      </Box>
    </Box>
  );
}

export default function ReturnsStatusSection({ stats = {}, calendar = [] }) {
  const navigate = useNavigate();
  const overdue = stats.overdue || 0;
  const submitted = stats.submitted || 0;
  const total = stats.total || 1;

  const upcoming = calendar
    .filter(c => c.status === 'NOT_STARTED' || c.status === 'IN_PROGRESS')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  const toReturns = () => navigate('/returns');

  return (
    <DataCard
      title="Regulatory Returns Status"
      subtitle="Filing progress and upcoming deadlines"
      actions={<CardLink onClick={toReturns}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <ProgressRow label="Overdue" count={overdue} total={total} toneName="red" onClick={toReturns} />
        <ProgressRow label="On Time" count={submitted} total={total} toneName="green" onClick={toReturns} />
        <ProgressRow label="Coming Soon" count={upcoming.length} total={total} toneName="orange" onClick={toReturns} />
      </Box>

      {upcoming.length > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${TL.gray100}` }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em', mb: 1 }}>
            Upcoming deadlines
          </Typography>
          {upcoming.map((item, i) => (
            <Box
              key={i}
              onClick={toReturns}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, py: 1, cursor: 'pointer', borderTop: i ? `1px solid ${TL.gray100}` : 'none' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main', maxWidth: 240 }}>
                  {item.title || item.name || `Return #${item.returnId || ''}`}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{item.regulator || ''}</Typography>
              </Box>
              {item.dueDate && (
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, whiteSpace: 'nowrap' }}>
                  Due {new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </DataCard>
  );
}
