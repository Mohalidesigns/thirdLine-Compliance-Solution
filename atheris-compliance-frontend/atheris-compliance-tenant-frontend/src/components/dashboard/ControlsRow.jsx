import { Paper, Typography, Box, LinearProgress, Chip, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Settings as TotalIcon,
  CheckCircle as PassingIcon,
  Cancel as FailingIcon,
  AssignmentLate as DueIcon,
} from '@mui/icons-material';

function RingProgress({ value, color, size = 64 }) {
  const theme = useTheme();
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={theme.palette.divider} strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography variant="body2" fontWeight={700}>{Math.round(value)}%</Typography>
      </Box>
    </Box>
  );
}

export default function ControlsRow({ snapshot = {} }) {
  const theme = useTheme();
  const navigate = useNavigate();

  const total = snapshot.controlsTotal || 0;
  const passing = snapshot.controlsPassing || 0;
  const failing = snapshot.controlsFailing || 0;
  const testRate = snapshot.controlsTestCompletionRate || 0;

  const effectivenessPct = total > 0 ? Math.round((passing / total) * 100) : 0;
  const effectColor = effectivenessPct >= 90 ? '#4caf50' : effectivenessPct >= 70 ? '#ed6c02' : '#d32f2f';

  const stats = [
    { label: 'Total Controls', value: total, icon: TotalIcon, color: '#1976d2', route: '/controls' },
    { label: 'Passing', value: passing, icon: PassingIcon, color: '#4caf50', route: '/controls' },
    { label: 'Failing (High Risk)', value: failing, icon: FailingIcon, color: '#d32f2f', route: '/controls?residualRisk=High' },
    { label: 'Tests Due', value: snapshot.findingsOverdueRemediation || 0, icon: DueIcon, color: '#ed6c02', route: '/controls' },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: '1px solid',
        borderColor: theme.palette.divider,
        borderLeftWidth: 4,
        borderLeftColor: '#1976d2',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <TotalIcon sx={{ color: '#1976d2', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Controls Effectiveness</Typography>
            <Typography variant="body2" color="text.secondary">
              {total} controls monitored across all themes
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <RingProgress value={effectivenessPct} color={effectColor} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Effectiveness
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <RingProgress value={testRate} color="#9c27b0" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Test Coverage
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
        {stats.map(({ label, value, icon: Icon, color, route }) => (
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
            {label === 'Failing (High Risk)' && value > 0 && (
              <Chip label="Action needed" size="small" sx={{ mt: 0.5, bgcolor: '#d32f2f14', color: '#d32f2f', fontWeight: 600, fontSize: 11 }} />
            )}
          </Paper>
        ))}
      </Box>

      {total > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Effectiveness distribution</Typography>
            <Typography variant="caption" color="text.secondary">
              {passing} passing / {failing} failing
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <Box sx={{ width: `${effectivenessPct}%`, bgcolor: '#4caf50', transition: 'width 0.5s' }} />
            {failing > 0 && (
              <Box sx={{ width: `${Math.round((failing / total) * 100)}%`, bgcolor: '#d32f2f', transition: 'width 0.5s' }} />
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
