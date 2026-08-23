import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tooltip, Collapse, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Refresh, CalendarMonth, Shield, Assessment, Warning, ExpandMore, ExpandLess } from '@mui/icons-material';
import { api } from '../services/api';

const COLOR_MAP = {
  green: { bg: '#F0FFF4', border: '#38A169', text: '#276749', chip: '#38A169' },
  amber: { bg: '#FFFAF0', border: '#DD6B20', text: '#C05621', chip: '#DD6B20' },
  red: { bg: '#FFF5F5', border: '#E53E3E', text: '#C53030', chip: '#E53E3E' },
};

function colorFor(pct, greenThresh = 80, amberThresh = 60) {
  if (pct >= greenThresh) return 'green';
  if (pct >= amberThresh) return 'amber';
  return 'red';
}

function PctChip({ pct, color }) {
  const cfg = COLOR_MAP[color] || COLOR_MAP.red;
  return <Chip size="small" label={`${pct}%`} sx={{ bgcolor: cfg.chip, color: '#fff', fontWeight: 700, height: 24 }} />;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, pct, expanded, onClick }) {
  const cfg = COLOR_MAP[color] || COLOR_MAP.green;
  return (
    <Card onClick={onClick} sx={{
      cursor: 'pointer', borderLeft: `4px solid ${cfg.border}`, bgcolor: cfg.bg,
      transition: 'all .2s', '&:hover': { boxShadow: 3 },
      outline: expanded ? `2px solid ${cfg.border}` : 'none',
    }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: cfg.text }}>{title}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: cfg.text, mt: 0.5 }}>{value}</Typography>
            {subtitle && <Typography variant="body2" sx={{ color: cfg.text, opacity: 0.8, mt: 0.5 }}>{subtitle}</Typography>}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {pct != null && <PctChip pct={pct} color={color} />}
            <Icon sx={{ color: cfg.border, fontSize: 32 }} />
            {expanded ? <ExpandLess sx={{ color: cfg.text }} /> : <ExpandMore sx={{ color: cfg.text }} />}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function ReturnsPeriodTable({ data, onRowClick }) {
  if (!data?.periods?.length) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No returns in this period.</Typography>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Period</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Regulator</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Frequency</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Submitted</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Pending</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Overdue</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">On-Time %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.periods.map((row, i) => (
            <TableRow key={i} hover>
              <TableCell>{row.period}</TableCell>
              <TableCell>{row.regulator}</TableCell>
              <TableCell><Chip size="small" label={row.frequency} variant="outlined" /></TableCell>
              <TableCell align="right">{row.total}</TableCell>
              <TableCell align="right"><Chip size="small" label={row.submitted} color="success" variant="outlined" /></TableCell>
              <TableCell align="right">
                <Chip size="small" label={row.inProgress + row.notStarted}
                  color={row.inProgress + row.notStarted > 0 ? 'warning' : 'default'} variant="outlined" />
              </TableCell>
              <TableCell align="right">
                <Chip size="small" label={row.overdue}
                  color={row.overdue > 0 ? 'error' : 'default'} variant="outlined" />
              </TableCell>
              <TableCell align="right"><PctChip pct={row.onTimePercentage} color={row.color} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ControlCoverageTable({ data, onRowClick }) {
  if (!data?.rows?.length) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No obligations found.</Typography>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>{data.dimension}</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Obligations</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Covered</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Coverage %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map((row, i) => (
            <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => onRowClick?.(row)}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right">{row.totalObligations}</TableCell>
              <TableCell align="right"><Chip size="small" label={row.covered} color="success" variant="outlined" /></TableCell>
              <TableCell align="right">
                <Chip size="small" label={row.gaps} color={row.gaps > 0 ? 'error' : 'default'} variant="outlined" />
              </TableCell>
              <TableCell align="right"><PctChip pct={row.coveragePercentage} color={row.color} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function RiskProfileTable({ data, onAreaClick }) {
  if (!data?.riskLevels?.length) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No obligations found.</Typography>;
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Risk Distribution</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {data.riskLevels.map((r) => {
          const colors = { Extreme: '#E53E3E', High: '#E53E3E', Medium: '#DD6B20', Low: '#38A169' };
          return (
            <Paper key={r.level} variant="outlined" sx={{ flex: 1, p: 1.5, textAlign: 'center', borderTop: `3px solid ${colors[r.level] || '#aaa'}` }}>
              <Typography variant="caption" color="text.secondary">{r.level}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{r.count}</Typography>
              <Typography variant="caption" color="text.secondary">{r.percentage}%</Typography>
            </Paper>
          );
        })}
      </Box>
      {data.byAreaOfFocus?.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>By Area of Focus</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Extreme</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">High</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Medium</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Low</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.byAreaOfFocus.map((row, i) => (
                  <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => onAreaClick?.(row.areaOfFocus)}>
                    <TableCell>{row.areaOfFocus}</TableCell>
                    <TableCell align="right">{row.total}</TableCell>
                    <TableCell align="right">{row.extreme > 0 ? <Chip size="small" label={row.extreme} color="error" variant="outlined" /> : '-'}</TableCell>
                    <TableCell align="right">{row.high > 0 ? <Chip size="small" label={row.high} color="error" variant="outlined" /> : '-'}</TableCell>
                    <TableCell align="right">{row.medium > 0 ? <Chip size="small" label={row.medium} color="warning" variant="outlined" /> : '-'}</TableCell>
                    <TableCell align="right">{row.low > 0 ? <Chip size="small" label={row.low} color="success" variant="outlined" /> : '-'}</TableCell>
                    <TableCell align="right">{row.gaps > 0 ? <Chip size="small" label={row.gaps} color="error" variant="outlined" /> : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

export default function DashboardV2Page() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returnsData, setReturnsData] = useState(null);
  const [coverageData, setCoverageData] = useState(null);
  const [coverageBy, setCoverageBy] = useState('areaOfFocus');
  const [riskData, setRiskData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const today = new Date();
  const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const qEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
  const fmt = (d) => d.toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const from = fmt(qStart);
      const to = fmt(qEnd);
      const [returns, coverage, risk] = await Promise.allSettled([
        api.dashboard.v2.returnsByPeriod(from, to),
        api.dashboard.v2.controlCoverage(coverageBy),
        api.dashboard.v2.riskProfile(),
      ]);
      if (returns.status === 'fulfilled') setReturnsData(returns.value);
      if (coverage.status === 'fulfilled') setCoverageData(coverage.value);
      if (risk.status === 'fulfilled') setRiskData(risk.value);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [coverageBy]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggle = (section) => setExpanded(expanded === section ? null : section);

  const rSum = returnsData?.summary;
  const cSum = coverageData?.summary;
  const riskSum = riskData?.summary;

  const covPct = cSum?.overallCoveragePercentage ?? 0;
  const covColor = colorFor(covPct, 80, 60);
  const retPct = rSum?.overallOnTimePercentage ?? 0;
  const retColor = colorFor(retPct, 90, 70);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Q{Math.floor(today.getMonth() / 3) + 1} {today.getFullYear()} compliance overview
          </Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={loadData}><Refresh /></IconButton></Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard title="Returns On Time" value={rSum?.totalOnTime ?? 0}
                subtitle={`${rSum?.totalPending ?? 0} pending, ${rSum?.totalOverdue ?? 0} overdue`}
                icon={CalendarMonth} color={retColor} pct={retPct}
                expanded={expanded === 'returns'} onClick={() => toggle('returns')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard title="Control Coverage" value={`${cSum?.totalCovered ?? 0} / ${cSum?.totalObligations ?? 0}`}
                subtitle={`${cSum?.totalGaps ?? 0} gaps`}
                icon={Shield} color={covColor} pct={covPct}
                expanded={expanded === 'coverage'} onClick={() => toggle('coverage')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard title="High Risk Obligations" value={(riskSum?.extremeCount ?? 0) + (riskSum?.highCount ?? 0)}
                subtitle={`${riskSum?.totalApplicable ?? 0} total applicable`}
                icon={Warning} color={riskSum?.extremeCount > 0 ? 'red' : 'amber'}
                expanded={expanded === 'risk'} onClick={() => toggle('risk')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard title="Obligations Gaps" value={riskSum?.gapsCount ?? 0}
                subtitle="obligations with no control"
                icon={Assessment} color={riskSum?.gapsCount > 0 ? 'red' : 'green'}
                expanded={expanded === 'gaps'} onClick={() => {
                  if (riskSum?.gapsCount > 0) navigate('/obligations?hasGap=true');
                  else toggle('gaps');
                }} />
            </Grid>
          </Grid>

          {rSum?.approachingDeadlines > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {rSum.approachingDeadlines} return(s) due within 30 days
            </Alert>
          )}

          <Collapse in={expanded === 'returns'} timeout="auto">
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Rendition Periods</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {rSum?.totalSubmitted}/{rSum?.totalInstances} submitted
                  </Typography>
                  <PctChip pct={retPct} color={retColor} />
                </Box>
              </Box>
              <ReturnsPeriodTable data={returnsData} />
            </Paper>
          </Collapse>

          <Collapse in={expanded === 'coverage'} timeout="auto">
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Control Coverage</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ToggleButtonGroup size="small" value={coverageBy} exclusive
                    onChange={(_, v) => { if (v) setCoverageBy(v); }}>
                    <ToggleButton value="areaOfFocus">Area of Focus</ToggleButton>
                    <ToggleButton value="department">Department</ToggleButton>
                  </ToggleButtonGroup>
                  <PctChip pct={covPct} color={covColor} />
                </Box>
              </Box>
              <ControlCoverageTable data={coverageData}
                onRowClick={(row) => {
                  const param = coverageBy === 'department'
                    ? `&owner=${encodeURIComponent(row.name)}`
                    : `&areaOfFocus=${encodeURIComponent(row.name)}`;
                  navigate(`/obligations?${param.slice(1)}`);
                }} />
            </Paper>
          </Collapse>

          <Collapse in={expanded === 'risk'} timeout="auto">
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0' }}>
                <Typography variant="h6">Risk Profile</Typography>
              </Box>
              <RiskProfileTable data={riskData}
                onAreaClick={(area) => navigate(`/obligations?areaOfFocus=${encodeURIComponent(area)}`)} />
            </Paper>
          </Collapse>

          <Collapse in={expanded === 'gaps'} timeout="auto">
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0' }}>
                <Typography variant="h6">Obligations with No Control</Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {riskSum?.gapsCount ?? 0} obligation(s) have no linked control. Navigate to the
                  Obligations Register to assign controls and close gaps.
                </Typography>
              </Box>
            </Paper>
          </Collapse>
        </>
      )}
    </Box>
  );
}
