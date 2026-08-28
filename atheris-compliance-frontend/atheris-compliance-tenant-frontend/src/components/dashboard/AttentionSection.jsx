import { Paper, Typography, Box, Chip, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  WarningAmber as OverdueIcon,
  BugReport as FailingIcon,
  Block as NoControlIcon,
  FindInPage as HighRiskIcon,
} from '@mui/icons-material';

const ITEMS = [
  { key: 'overdue_returns', label: 'Overdue Returns', icon: OverdueIcon, color: '#d32f2f', route: '/returns' },
  { key: 'controls_failing', label: 'Controls Failing', icon: FailingIcon, color: '#ed6c02', route: '/controls' },
  { key: 'obligations_no_control', label: 'Obligations Without Controls', icon: NoControlIcon, color: '#9c27b0', route: '/obligations?hasGap=true' },
  { key: 'high_risk_findings', label: 'High-Risk Findings', icon: HighRiskIcon, color: '#d32f2f', route: '/findings' },
];

export default function AttentionSection({ items = {} }) {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom fontWeight={600}>
        Needs Attention
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
        {ITEMS.map(({ key, label, icon: Icon, color, route }) => {
          const count = items[key] || 0;
          return (
            <Paper
              key={key}
              elevation={0}
              onClick={() => navigate(route)}
              sx={{
                p: 2,
                cursor: 'pointer',
                borderLeft: `4px solid ${color}`,
                border: '1px solid',
                borderColor: theme.palette.divider,
                borderLeftWidth: 4,
                borderLeftColor: color,
                transition: 'all 0.15s',
                '&:hover': { bgcolor: theme.palette.action.hover, transform: 'translateY(-1px)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Icon sx={{ color, fontSize: 28 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontSize={12}>
                      {label}
                    </Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                      {count}
                    </Typography>
                  </Box>
                </Box>
                {count > 0 && (
                  <Chip
                    label="Action needed"
                    size="small"
                    sx={{ bgcolor: `${color}14`, color, fontWeight: 600, fontSize: 11 }}
                  />
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Paper>
  );
}
