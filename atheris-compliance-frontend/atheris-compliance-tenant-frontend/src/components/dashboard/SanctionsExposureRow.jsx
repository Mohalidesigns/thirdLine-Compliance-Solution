import { Paper, Typography, Box, Chip, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Gavel as SanctionIcon,
  Warning as EnforcedIcon,
  Security as HighSevIcon,
} from '@mui/icons-material';

function formatNaira(val) {
  if (!val) return '\u20A60';
  const n = Number(val);
  if (n >= 1e9) return `\u20A6${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `\u20A6${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `\u20A6${(n / 1e3).toFixed(1)}K`;
  return `\u20A6${n.toLocaleString()}`;
}

export default function SanctionsExposureRow({ stats = {} }) {
  const theme = useTheme();
  const navigate = useNavigate();

  const total = stats.total || 0;
  const enforced = stats.enforced || 0;
  const highSeverity = stats.highSeverity || 0;
  const exposure = stats.totalExposure || 0;

  const cards = [
    {
      label: 'Total Sanctions',
      value: total,
      icon: SanctionIcon,
      color: '#1976d2',
      route: '/sanctions',
    },
    {
      label: 'Enforced',
      value: enforced,
      icon: EnforcedIcon,
      color: '#d32f2f',
      route: '/sanctions',
      chip: total > 0 ? `${Math.round((enforced / total) * 100)}%` : null,
    },
    {
      label: 'High Severity',
      value: highSeverity,
      icon: HighSevIcon,
      color: '#ed6c02',
      route: '/sanctions',
      chip: total > 0 ? `${Math.round((highSeverity / total) * 100)}%` : null,
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: '1px solid',
        borderColor: theme.palette.divider,
        borderLeftWidth: 4,
        borderLeftColor: '#d32f2f',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SanctionIcon sx={{ color: '#d32f2f', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Sanctions & Penalty Exposure</Typography>
            <Typography variant="body2" color="text.secondary">
              {total} sanctions across all regulators
            </Typography>
          </Box>
        </Box>
        <Paper
          elevation={0}
          onClick={() => navigate('/sanctions')}
          sx={{
            px: 3, py: 1.5, cursor: 'pointer', textAlign: 'center',
            bgcolor: '#d32f2f08', border: '1px solid', borderColor: '#d32f2f30', borderRadius: 2,
            '&:hover': { bgcolor: '#d32f2f14' },
          }}
        >
          <Typography variant="caption" color="text.secondary">Exposure</Typography>
          <Typography variant="h5" fontWeight={700} color="#d32f2f">
            {formatNaira(exposure)}
          </Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
        {cards.map(({ label, value, icon: Icon, color, route, chip }) => (
          <Paper
            key={label}
            elevation={0}
            onClick={() => navigate(route)}
            sx={{
              p: 2, cursor: 'pointer', textAlign: 'center',
              border: '1px solid', borderColor: theme.palette.divider,
              borderRadius: 2, transition: 'all 0.15s',
              '&:hover': { bgcolor: theme.palette.action.hover, transform: 'translateY(-1px)' },
            }}
          >
            <Icon sx={{ color, fontSize: 28, mb: 0.5 }} />
            <Typography variant="h4" fontWeight={700}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            {chip && (
              <Chip label={chip} size="small" sx={{ mt: 0.5, bgcolor: `${color}14`, color, fontWeight: 600, fontSize: 11 }} />
            )}
          </Paper>
        ))}
      </Box>
    </Paper>
  );
}
