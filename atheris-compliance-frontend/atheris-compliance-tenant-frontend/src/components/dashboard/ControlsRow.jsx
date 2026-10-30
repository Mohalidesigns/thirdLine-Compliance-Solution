import { Typography, Box, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataCard, CardLink, StatusBadge, TL } from 'shared';
import { pctOrNa } from './ScoreBreakdown';

const GREEN = '#22C55E';
const ORANGE = '#F97316';
const RED = '#EF4444';
const NAVY = '#1A365D';

function RingProgress({ value, color, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value == null ? 0 : value;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={TL.gray200} strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: TL.gray800 }}>{pctOrNa(value)}</Typography>
      </Box>
    </Box>
  );
}

/**
 * Pass/fail come from each control's LATEST TEST RESULT. A control that was never tested is
 * neither passing nor failing — it is "Not yet tested". (Residual risk is not a test result.)
 */
export default function ControlsRow({ metrics = {} }) {
  const navigate = useNavigate();

  const total = metrics.controlsTotal || 0;
  const tested = metrics.controlsTested || 0;
  const passing = metrics.controlsPassing || 0;
  const failing = metrics.controlsFailing || 0;
  const untested = metrics.controlsUntested ?? Math.max(total - tested, 0);
  const otherResult = Math.max(tested - passing - failing, 0);
  const effectiveness = metrics.controlEffectivenessPct;   // passing ÷ tested, null when none tested
  const testCoverage = metrics.controlTestCompletion;      // tested ÷ total, null when no controls

  const effectColor = effectiveness == null ? TL.gray300 : effectiveness >= 90 ? GREEN : effectiveness >= 70 ? ORANGE : RED;

  const stats = [
    { label: 'Total Controls', value: total, color: NAVY, route: '/controls' },
    { label: 'Passing (latest test)', value: passing, color: GREEN, route: '/controls' },
    { label: 'Failing (latest test)', value: failing, color: RED, route: '/controls', alert: failing > 0 },
    { label: 'Not yet tested', value: untested, color: TL.gray300, route: '/controls' },
    { label: 'Tests due (30 days)', value: metrics.controlTestsDue || 0, color: ORANGE, route: '/controls',
      note: metrics.controlTestsOverdue ? `${metrics.controlTestsOverdue} overdue` : null },
  ];
  if (otherResult > 0) stats.splice(3, 0, { label: 'Other result', value: otherResult, color: TL.gray500, route: '/controls' });

  const width = (n) => (total > 0 ? `${((n / total) * 100).toFixed(2)}%` : '0%');

  return (
    <DataCard
      title="Controls Effectiveness"
      subtitle={`${total} controls · ${tested} tested`}
      actions={<CardLink onClick={() => navigate('/controls')}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2, mb: 2.5 }}>
        <Tooltip arrow title="Tested controls whose latest test passed (passing ÷ tested)">
          <Box sx={{ textAlign: 'center' }}>
            <RingProgress value={effectiveness} color={effectColor} />
            <Typography sx={{ mt: 0.75, fontSize: '0.75rem', color: TL.gray500 }}>Effectiveness (of tested)</Typography>
          </Box>
        </Tooltip>
        <Tooltip arrow title="Controls with at least one test result (tested ÷ total)">
          <Box sx={{ textAlign: 'center' }}>
            <RingProgress value={testCoverage} color={NAVY} />
            <Typography sx={{ mt: 0.75, fontSize: '0.75rem', color: TL.gray500 }}>Test Coverage</Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* legend list: colour dot · label · right-aligned count */}
      <Box>
        {stats.map(({ label, value, color, route, alert, note }, i) => (
          <Box
            key={label}
            onClick={() => navigate(route)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, py: 1, cursor: 'pointer',
              borderTop: i ? `1px solid ${TL.gray100}` : 'none',
              '&:hover .tl-legend-label': { color: TL.primary },
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography className="tl-legend-label" sx={{ flex: 1, fontSize: '0.875rem', color: TL.gray700 }}>{label}</Typography>
            {alert && <StatusBadge label="Action needed" tone="red" />}
            {note && <StatusBadge label={note} tone="orange" />}
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, minWidth: 28, textAlign: 'right' }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {total > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>Test status distribution</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
              {passing} passing / {failing} failing / {untested} untested
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', height: 8, borderRadius: 9999, overflow: 'hidden', bgcolor: TL.gray200 }}>
            <Box sx={{ width: width(passing), bgcolor: GREEN, transition: 'width 0.5s' }} />
            <Box sx={{ width: width(failing), bgcolor: RED, transition: 'width 0.5s' }} />
          </Box>
        </Box>
      )}
    </DataCard>
  );
}
