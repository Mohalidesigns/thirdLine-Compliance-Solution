import { Box, Button, CircularProgress, Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PageHeader, KpiCards, ArrowPathIcon, ScaleIcon, PlusIcon,
  ChartBarIcon, CheckCircleIcon, ExclamationTriangleIcon, ShieldCheckIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AttentionSection from '../components/dashboard/AttentionSection';
import ComplianceUniverseSection from '../components/dashboard/ComplianceUniverseSection';
import ComplianceTrendChart from '../components/dashboard/ComplianceTrendChart';
import ReturnsStatusSection from '../components/dashboard/ReturnsStatusSection';
import SanctionsExposureRow from '../components/dashboard/SanctionsExposureRow';
import ControlsRow from '../components/dashboard/ControlsRow';
import { RiskProfileRow, AreaOfFocusTable, ActBreakdownTable } from '../components/dashboard/RiskAreaActRow';
import RunbooksWidget from '../components/dashboard/RunbooksWidget';
import ScoreBreakdown, { pctOrNa } from '../components/dashboard/ScoreBreakdown';

const POLL_INTERVAL = 30000;

const row = (cols) => ({
  display: 'grid',
  gap: 3,
  mb: 3,
  alignItems: 'stretch',
  gridTemplateColumns: { xs: '1fr', lg: cols },
});

export default function CcoDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canGenerate = ['CCO', 'TENANT_ADMIN'].includes(user?.role);
  // each section fetches independently — one failing endpoint must never blank the page
  const attentionQuery = useQuery({
    queryKey: ['dashboard', 'attention-items'],
    queryFn: () => api.dashboard.attentionItems(),
    refetchInterval: POLL_INTERVAL,
  });
  const trendQuery = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: () => api.dashboard.trends(),
    refetchInterval: POLL_INTERVAL,
  });
  const returnsStatsQuery = useQuery({
    queryKey: ['dashboard', 'returns-stats'],
    queryFn: ({ signal }) => api.returns.stats({ signal }),
    refetchInterval: POLL_INTERVAL,
  });
  const calendarQuery = useQuery({
    queryKey: ['dashboard', 'returns-calendar'],
    // a Spring page of filing periods; the card keeps the next three that are still open
    queryFn: () => api.returns.calendar({ size: 500 }),
    refetchInterval: POLL_INTERVAL,
  });
  const sanctionsQuery = useQuery({
    queryKey: ['dashboard', 'sanctions-stats'],
    queryFn: ({ signal }) => api.sanctions.stats({ signal }),
    refetchInterval: POLL_INTERVAL,
  });
  const riskProfileQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'risk-profile'],
    queryFn: () => api.dashboard.v2.riskProfile(),
    refetchInterval: POLL_INTERVAL,
  });
  const universeQuery = useQuery({
    queryKey: ['dashboard', 'universe-stats'],
    queryFn: ({ signal }) => api.instruments.universeStats({ signal }),
    refetchInterval: POLL_INTERVAL,
  });
  const coverageQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'control-coverage', 'areaOfFocus'],
    queryFn: () => api.dashboard.v2.controlCoverage('areaOfFocus'),
    refetchInterval: POLL_INTERVAL,
  });
  const metricsQuery = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: ({ signal }) => api.dashboard.metrics(undefined, undefined, { signal }),
    refetchInterval: POLL_INTERVAL,
  });

  const queries = [
    attentionQuery, trendQuery, returnsStatsQuery, calendarQuery,
    sanctionsQuery, riskProfileQuery, coverageQuery, universeQuery, metricsQuery,
  ];
  const loading = queries.some(q => q.isPending);
  const refreshing = queries.some(q => q.isFetching);

  const attention = attentionQuery.data || {};
  const trend = Array.isArray(trendQuery.data) ? trendQuery.data : [];
  const returnsStats = returnsStatsQuery.data || {};
  const calendar = Array.isArray(calendarQuery.data) ? calendarQuery.data : (calendarQuery.data?.content || []);
  const sanctionsStats = sanctionsQuery.data || {};
  const riskProfile = riskProfileQuery.data || {};
  const coverage = coverageQuery.data || {};
  const metrics = metricsQuery.data || {};

  const scoreBreakdown = metrics.scoreBreakdown || [];
  const kpis = [
    { key: 'score', label: 'Compliance Score', tone: 'blue', icon: <ChartBarIcon size={16} />,
      value: metrics.complianceScore != null ? pctOrNa(metrics.complianceScore) : 'N/A',
      caption: 'Hover for how it is calculated',
      tooltip: <ScoreBreakdown breakdown={scoreBreakdown} score={metrics.complianceScore} />,
      breakdown: Object.fromEntries(scoreBreakdown.map(c => [`${c.label} (×${c.weight})`, pctOrNa(c.value)])) },
    { key: 'coverage', label: 'Control Coverage', tone: 'green', icon: <CheckCircleIcon size={16} />,
      value: pctOrNa(metrics.controlCoverage),
      caption: 'Applicable obligations with a linked control' },
    { key: 'highRisk', label: 'Critical/High Obligations', tone: 'red', icon: <ExclamationTriangleIcon size={16} />,
      value: metrics.obligationsHighRisk ?? 0, breakdown: metrics.obligationsByRisk || {},
      caption: `of ${metrics.obligationsApplicable ?? 0} applicable obligations` },
    { key: 'gaps', label: 'No Control', tone: 'orange', icon: <ShieldCheckIcon size={16} />,
      value: metrics.obligationsWithGaps ?? 0 },
  ];

  function onKpiDrill(key, label) {
    if (key === 'score') return;
    if (key === 'highRisk') navigate(`/obligations?risk=${encodeURIComponent(label)}`);
    else if (key === 'gaps') navigate('/obligations?hasGap=true');
    else if (key === 'coverage') navigate('/controls');
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Compliance posture across returns, controls, obligations and sanctions"
        actions={(
          <>
            <Button
              variant="outlined"
              startIcon={<ArrowPathIcon size={16} />}
              disabled={refreshing}
              onClick={() => queries.forEach(q => q.refetch())}
            >
              Refresh
            </Button>
            <Button variant="contained" startIcon={<ScaleIcon size={16} />} onClick={() => navigate('/obligations')}>
              Obligations Register
            </Button>
            {canGenerate && (
              <Tooltip title="Generate a board-ready PDF report">
                <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => navigate('/reports')}>
                  Generate Board Pack
                </Button>
              </Tooltip>
            )}
          </>
        )}
      />

      {/* Compliance universe — first thing users see */}
      <ComplianceUniverseSection stats={universeQuery.data} />

      {/* KPI row — every card has a breakdown dropdown */}
      <KpiCards items={kpis} columns={4} onDrill={onKpiDrill} />

      {/* Needs attention — stat cards */}
      <AttentionSection items={attention} />

      {/* Compliance runbooks — hidden when the runbooks API is unavailable */}
      <RunbooksWidget />

      {/* Returns · Controls · Sanctions */}
      <Box sx={row('repeat(3, 1fr)')}>
        <ReturnsStatusSection stats={returnsStats} calendar={calendar} onTimePct={metrics.returnsOnTimePct} />
        <ControlsRow metrics={metrics} />
        <SanctionsExposureRow stats={sanctionsStats} />
      </Box>

      {/* Compliance trend · inherent risk donut */}
      <Box sx={row('2fr 1fr')}>
        <ComplianceTrendChart trend={trend} metrics={metrics} />
        <RiskProfileRow profile={riskProfile} />
      </Box>

      {/* Area of focus · act tables */}
      <Box sx={row('1fr 1fr')}>
        <AreaOfFocusTable profile={riskProfile} coverage={coverage} />
        <ActBreakdownTable profile={riskProfile} />
      </Box>
    </Box>
  );
}
