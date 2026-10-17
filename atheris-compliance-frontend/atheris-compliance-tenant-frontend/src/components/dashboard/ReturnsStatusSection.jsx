import { Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataCard, CardLink, StatusBadge, TL, tone } from 'shared';
import { pctOrNa } from './ScoreBreakdown';

/** Key-value row with an 8px rounded progress bar on a gray-200 track. */
function ProgressRow({ label, count, total, toneName, onClick }) {
  const pct = total > 0 ? ((count / total) * 100) : 0;
  return (
    <Box
      onClick={onClick}
      sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover .tl-kv-label': onClick ? { color: TL.primary } : undefined }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Typography className="tl-kv-label" sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {total > 0 && <StatusBadge label={`${pct.toFixed(1)}%`} tone={toneName} />}
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

const OPEN_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'Not Started', 'In Progress'];

/**
 * Every tracked filing period sits in exactly one status, so the rows add up to the total and
 * their percentages to 100%. "Returns on time" is filed-on-time ÷ (filed + overdue) — N/A until
 * something has been due.
 */
export default function ReturnsStatusSection({ stats = {}, calendar = [], onTimePct }) {
  const navigate = useNavigate();
  const b = stats.buckets || {};
  const total = b.tracked || 0;

  const upcoming = calendar
    .filter(c => OPEN_STATUSES.includes(c.status) && c.dueDate && new Date(c.dueDate) >= new Date(new Date().toDateString()))
    .sort((a, b2) => new Date(a.dueDate) - new Date(b2.dueDate))
    .slice(0, 3);

  const toReturns = () => navigate('/returns');
  const rows = [
    { label: 'Overdue', count: b.overdue || 0, tone: 'red' },
    { label: 'Filed on time', count: b.filedOnTime || 0, tone: 'green' },
    { label: 'Filed late', count: b.filedLate || 0, tone: 'orange' },
    { label: 'In progress (not yet due)', count: b.inProgressNotDue || 0, tone: 'blue' },
    { label: 'Not yet due', count: b.notYetDue || 0, tone: 'gray' },
  ];

  return (
    <DataCard
      title="Regulatory Returns Status"
      subtitle={`${total} filing periods tracked · ${b.dueSoon || 0} due in the next 30 days`}
      actions={<CardLink onClick={toReturns}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Returns on time
        </Typography>
        <Typography title="Filed on time ÷ (filed + overdue)" sx={{ fontSize: '1.25rem', fontWeight: 700, color: TL.gray800 }}>
          {pctOrNa(onTimePct)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map(r => (
          <ProgressRow key={r.label} label={r.label} count={r.count} total={total} toneName={r.tone} onClick={toReturns} />
        ))}
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
                  {item.title || item.returnName || item.name || `Return #${item.returnId || ''}`}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{item.regulator || item.filingRegulator || ''}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, whiteSpace: 'nowrap' }}>
                Due {new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </DataCard>
  );
}
