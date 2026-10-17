import { Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataCard, CardLink, StatusBadge, TL } from 'shared';

function formatNaira(val) {
  if (!val) return '₦0';
  const n = Number(val);
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `₦${(n / 1e3).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

export default function SanctionsExposureRow({ stats = {} }) {
  const navigate = useNavigate();

  const total = stats.total || 0;
  const enforced = stats.enforced || 0;
  const highSeverity = stats.highSeverity || 0;
  const exposure = stats.totalExposure || 0;

  const rows = [
    { label: 'Total Sanctions', value: total, color: '#1A365D', route: '/sanctions' },
    {
      label: 'Enforced', value: enforced, color: '#EF4444', route: '/sanctions',
      pct: total > 0 ? (enforced / total) * 100 : null, tone: 'red',
    },
    {
      label: 'High Severity', value: highSeverity, color: '#F97316', route: '/sanctions',
      pct: total > 0 ? (highSeverity / total) * 100 : null, tone: 'orange',
    },
  ];

  return (
    <DataCard
      title="Sanctions & Penalty Exposure"
      subtitle={`${total} sanctions across all regulators`}
      actions={<CardLink onClick={() => navigate('/sanctions')}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      <Box onClick={() => navigate('/sanctions')} sx={{ cursor: 'pointer', mb: 2.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Potential exposure
        </Typography>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: '#B91C1C' }}>
          {formatNaira(exposure)}
        </Typography>
        {/* the sum of maximum statutory penalties on the register — not fines actually imposed */}
        <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
          Maximum statutory penalties if breached · {enforced > 0 ? `${enforced} enforced` : 'none enforced'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {rows.map(({ label, value, color, route, pct, tone }) => (
          <Box
            key={label}
            onClick={() => navigate(route)}
            sx={{ cursor: 'pointer', '&:hover .tl-kv-label': { color: TL.primary } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: pct != null ? 0.75 : 0 }}>
              <Typography className="tl-kv-label" sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pct != null && <StatusBadge label={`${pct.toFixed(2)}%`} tone={tone} />}
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, minWidth: 28, textAlign: 'right' }}>{value}</Typography>
              </Box>
            </Box>
            {pct != null && (
              <Box sx={{ height: 8, borderRadius: 9999, bgcolor: TL.gray200, overflow: 'hidden' }}>
                <Box sx={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 9999, bgcolor: color, transition: 'width 0.5s' }} />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </DataCard>
  );
}
