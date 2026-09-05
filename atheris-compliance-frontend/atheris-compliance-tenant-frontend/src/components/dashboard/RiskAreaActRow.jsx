import { useNavigate } from 'react-router-dom';
import {
  Paper, Typography, Box, Chip, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, useTheme,
} from '@mui/material';
import {
  Whatshot as CriticalIcon,
  PriorityHigh as HighIcon,
  ReportProblem as ModerateIcon,
  CheckCircle as LowIcon,
  Block as GapIcon,
  Category as AreaIcon,
  MenuBook as ActIcon,
} from '@mui/icons-material';

const RISK_LEVELS = [
  { level: 'Critical', summaryKey: 'extremeCount', rowKey: 'extreme', icon: CriticalIcon, color: '#d32f2f' },
  { level: 'High', summaryKey: 'highCount', rowKey: 'high', icon: HighIcon, color: '#ed6c02' },
  { level: 'Moderate', summaryKey: 'mediumCount', rowKey: 'medium', icon: ModerateIcon, color: '#1976d2' },
  { level: 'Low', summaryKey: 'lowCount', rowKey: 'low', icon: LowIcon, color: '#4caf50' },
];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function CardShell({ icon: Icon, color, title, subtitle, right, children }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: '1px solid',
        borderColor: theme.palette.divider,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Icon sx={{ color, fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          </Box>
        </Box>
        {right}
      </Box>
      {children}
    </Paper>
  );
}

function RiskCell({ extreme, high, breakdown }) {
  const value = extreme + high;
  return (
    <Tooltip title={breakdown}>
      <Chip
        size="small"
        label={value}
        variant="outlined"
        sx={{
          height: 22,
          borderRadius: '4px',
          fontWeight: 600,
          color: extreme > 0 ? '#d32f2f' : high > 0 ? '#ed6c02' : 'text.secondary',
          borderColor: extreme > 0 ? '#d32f2f60' : high > 0 ? '#ed6c0260' : 'divider',
        }}
      />
    </Tooltip>
  );
}

export function RiskProfileRow({ profile = {} }) {
  const theme = useTheme();
  const navigate = useNavigate();

  const summary = profile.summary || {};
  const levels = Array.isArray(profile.riskLevels) ? profile.riskLevels : [];
  const total = num(summary.totalApplicable);
  const gaps = num(summary.gapsCount);

  const cards = RISK_LEVELS.map((cfg) => {
    const row = levels.find((r) => r.level === cfg.level);
    const count = row ? num(row.count) : num(summary[cfg.summaryKey]);
    const pct = row && typeof row.percentage === 'number'
      ? row.percentage
      : (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
    return { ...cfg, count, pct };
  });

  return (
    <CardShell
      icon={CriticalIcon}
      color="#d32f2f"
      title="Inherent Risk Profile"
      subtitle={`${total} applicable obligations rated by inherent risk`}
      right={
        <Paper
          elevation={0}
          onClick={() => navigate('/obligations?hasGap=true')}
          sx={{
            px: 3, py: 1.5, cursor: 'pointer', textAlign: 'center',
            bgcolor: '#9c27b008', border: '1px solid', borderColor: '#9c27b030', borderRadius: 2,
            '&:hover': { bgcolor: '#9c27b014' },
          }}
        >
          <Typography variant="caption" color="text.secondary">Control gaps</Typography>
          <Typography variant="h5" fontWeight={700} color="#9c27b0">{gaps}</Typography>
        </Paper>
      }
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
        {cards.map(({ level, count, pct, icon: Icon, color }) => (
          <Paper
            key={level}
            elevation={0}
            onClick={() => navigate(`/obligations?risk=${encodeURIComponent(level)}`)}
            sx={{
              p: 2, cursor: 'pointer', textAlign: 'center',
              border: '1px solid', borderColor: theme.palette.divider,
              borderRadius: 2, transition: 'all 0.15s',
              '&:hover': { bgcolor: theme.palette.action.hover, transform: 'translateY(-1px)' },
            }}
          >
            <Icon sx={{ color, fontSize: 28, mb: 0.5 }} />
            <Typography variant="h4" fontWeight={700}>{count}</Typography>
            <Typography variant="caption" color="text.secondary">{level}</Typography>
            <Chip label={`${pct}%`} size="small" sx={{ mt: 0.5, bgcolor: `${color}14`, color, fontWeight: 600, fontSize: 11 }} />
          </Paper>
        ))}
      </Box>

      {total > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Inherent risk distribution</Typography>
            <Typography variant="caption" color="text.secondary">
              {gaps} of {total} without a control
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: theme.palette.divider }}>
            {cards.filter(c => c.count > 0).map(({ level, count, color }) => (
              <Box key={level} sx={{ width: `${((count / total) * 100).toFixed(2)}%`, bgcolor: color, transition: 'width 0.5s' }} />
            ))}
          </Box>
        </Box>
      )}
    </CardShell>
  );
}

export function AreaOfFocusTable({ profile = {}, coverage = {} }) {
  const navigate = useNavigate();

  const rows = Array.isArray(profile.byAreaOfFocus) ? profile.byAreaOfFocus : [];
  const coverageRows = Array.isArray(coverage.rows) ? coverage.rows : [];
  const coverageByName = new Map(coverageRows.map((r) => [r.name, r]));
  const overallPct = coverage.summary ? coverage.summary.overallCoveragePercentage : null;

  const sorted = [...rows].sort((a, b) =>
    (num(b.extreme) + num(b.high)) - (num(a.extreme) + num(a.high)) || num(b.gaps) - num(a.gaps));

  return (
    <CardShell
      icon={AreaIcon}
      color="#1976d2"
      title="Risk by Area of Focus"
      subtitle={`${rows.length} areas across the applicable obligation set`}
      right={typeof overallPct === 'number' ? (
        <Paper
          elevation={0}
          sx={{
            px: 3, py: 1.5, textAlign: 'center',
            bgcolor: '#1976d208', border: '1px solid', borderColor: '#1976d230', borderRadius: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary">Control coverage</Typography>
          <Typography variant="h5" fontWeight={700} color="#1976d2">{overallPct}%</Typography>
        </Paper>
      ) : null}
    >
      {sorted.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No area of focus data available.</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Area of Focus</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Obligations</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Critical + High</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Coverage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((row, i) => {
                const area = row.areaOfFocus || 'Unassigned';
                const cov = coverageByName.get(row.areaOfFocus);
                return (
                  <TableRow
                    key={`${area}-${i}`}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/obligations?areaOfFocus=${encodeURIComponent(area)}`)}
                  >
                    <TableCell>{area}</TableCell>
                    <TableCell align="right">{num(row.total)}</TableCell>
                    <TableCell align="right">
                      <RiskCell
                        extreme={num(row.extreme)}
                        high={num(row.high)}
                        breakdown={`Critical ${num(row.extreme)} · High ${num(row.high)} · Moderate ${num(row.medium)} · Low ${num(row.low)}`}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={num(row.gaps)} variant="outlined"
                        color={num(row.gaps) > 0 ? 'error' : 'default'} sx={{ height: 22, borderRadius: '4px' }} />
                    </TableCell>
                    <TableCell align="right">
                      {cov && typeof cov.coveragePercentage === 'number'
                        ? `${cov.coveragePercentage}%`
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </CardShell>
  );
}

export function ActBreakdownTable({ profile = {} }) {
  const rows = Array.isArray(profile.byAct) ? profile.byAct : [];

  const normalized = rows.map((row, i) => ({
    key: i,
    name: row.act ?? row.actName ?? row.name ?? (row.actId != null ? `Act #${row.actId}` : 'Unattributed'),
    total: num(row.total ?? row.totalObligations),
    extreme: num(row.extreme ?? row.critical),
    high: num(row.high),
    medium: num(row.medium),
    low: num(row.low),
    gaps: num(row.gaps),
  })).sort((a, b) => (b.extreme + b.high) - (a.extreme + a.high) || b.gaps - a.gaps);

  return (
    <CardShell
      icon={ActIcon}
      color="#9c27b0"
      title="Risk by Act"
      subtitle={normalized.length > 0
        ? `${normalized.length} acts across the applicable obligation set`
        : 'Per-act analytics are not yet published by the dashboard service'}
    >
      {normalized.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GapIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
          <Typography variant="body2" color="text.secondary">
            Act breakdown not available. It will appear here once the risk profile returns per-act figures.
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Act</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Obligations</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Critical + High</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {normalized.map((row) => (
                <TableRow key={row.key} hover>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{row.total}</TableCell>
                  <TableCell align="right">
                    <RiskCell
                      extreme={row.extreme}
                      high={row.high}
                      breakdown={`Critical ${row.extreme} · High ${row.high} · Moderate ${row.medium} · Low ${row.low}`}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Chip size="small" label={row.gaps} variant="outlined"
                      color={row.gaps > 0 ? 'error' : 'default'} sx={{ height: 22, borderRadius: '4px' }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </CardShell>
  );
}
