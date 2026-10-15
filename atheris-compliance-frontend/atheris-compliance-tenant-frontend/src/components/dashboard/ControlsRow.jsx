import { Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataCard, CardLink, StatusBadge, TL } from 'shared';

const GREEN = '#22C55E';
const ORANGE = '#F97316';
const RED = '#EF4444';
const NAVY = '#1A365D';

function RingProgress({ value, color, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

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
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: TL.gray800 }}>{value.toFixed(2)}%</Typography>
      </Box>
    </Box>
  );
}

export default function ControlsRow({ snapshot = {} }) {
  const navigate = useNavigate();

  const total = snapshot.controlsTotal || 0;
  const passing = snapshot.controlsPassing || 0;
  const failing = snapshot.controlsFailing || 0;
  const testRate = snapshot.controlsTestCompletionRate || 0;

  const effectivenessPct = total > 0 ? ((passing / total) * 100) : 0;
  const effectColor = effectivenessPct >= 90 ? GREEN : effectivenessPct >= 70 ? ORANGE : RED;

  const stats = [
    { label: 'Total Controls', value: total, color: NAVY, route: '/controls' },
    { label: 'Passing', value: passing, color: GREEN, route: '/controls' },
    { label: 'Failing (High Risk)', value: failing, color: RED, route: '/controls?residualRisk=High' },
    { label: 'Tests Due', value: snapshot.findingsOverdueRemediation || 0, color: ORANGE, route: '/controls' },
  ];

  return (
    <DataCard
      title="Controls Effectiveness"
      subtitle={`${total} controls monitored across all themes`}
      actions={<CardLink onClick={() => navigate('/controls')}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2, mb: 2.5 }}>
        <Box sx={{ textAlign: 'center' }}>
          <RingProgress value={effectivenessPct} color={effectColor} />
          <Typography sx={{ mt: 0.75, fontSize: '0.75rem', color: TL.gray500 }}>Effectiveness</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <RingProgress value={testRate} color={NAVY} />
          <Typography sx={{ mt: 0.75, fontSize: '0.75rem', color: TL.gray500 }}>Test Coverage</Typography>
        </Box>
      </Box>

      {/* legend list: colour dot · label · right-aligned count */}
      <Box>
        {stats.map(({ label, value, color, route }, i) => (
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
            {label === 'Failing (High Risk)' && value > 0 && <StatusBadge label="Action needed" tone="red" />}
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, minWidth: 28, textAlign: 'right' }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {total > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>Effectiveness distribution</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
              {passing} passing / {failing} failing
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', height: 8, borderRadius: 9999, overflow: 'hidden', bgcolor: TL.gray200 }}>
            <Box sx={{ width: `${effectivenessPct}%`, bgcolor: GREEN, transition: 'width 0.5s' }} />
            {failing > 0 && (
              <Box sx={{ width: `${((failing / total) * 100).toFixed(2)}%`, bgcolor: RED, transition: 'width 0.5s' }} />
            )}
          </Box>
        </Box>
      )}
    </DataCard>
  );
}
