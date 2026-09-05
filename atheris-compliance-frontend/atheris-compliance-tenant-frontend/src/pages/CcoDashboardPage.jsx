import { Box, CircularProgress, Typography, Fade, Divider } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import AttentionSection from '../components/dashboard/AttentionSection';
import ComplianceTrendChart from '../components/dashboard/ComplianceTrendChart';
import ReturnsStatusSection from '../components/dashboard/ReturnsStatusSection';
import SanctionsExposureRow from '../components/dashboard/SanctionsExposureRow';
import ControlsRow from '../components/dashboard/ControlsRow';
import { RiskProfileRow, AreaOfFocusTable, ActBreakdownTable } from '../components/dashboard/RiskAreaActRow';

const POLL_INTERVAL = 30000;

function SectionHeader({ title, subtitle, color }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 4, height: 24, borderRadius: 2, bgcolor: color }} />
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1.75 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default function CcoDashboardPage() {
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
    queryKey: ['dashboard', 'returns-calendar', 90],
    queryFn: () => api.returns.calendar({ days: 90 }),
    refetchInterval: POLL_INTERVAL,
  });
  const sanctionsQuery = useQuery({
    queryKey: ['dashboard', 'sanctions-stats'],
    queryFn: ({ signal }) => api.sanctions.stats({ signal }),
    refetchInterval: POLL_INTERVAL,
  });
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.dashboard.summary(),
    refetchInterval: POLL_INTERVAL,
  });
  const riskProfileQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'risk-profile'],
    queryFn: () => api.dashboard.v2.riskProfile(),
    refetchInterval: POLL_INTERVAL,
  });
  const coverageQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'control-coverage', 'areaOfFocus'],
    queryFn: () => api.dashboard.v2.controlCoverage('areaOfFocus'),
    refetchInterval: POLL_INTERVAL,
  });

  const queries = [
    attentionQuery, trendQuery, returnsStatsQuery, calendarQuery,
    sanctionsQuery, summaryQuery, riskProfileQuery, coverageQuery,
  ];
  const loading = queries.some(q => q.isPending);

  const attention = attentionQuery.data || {};
  const trend = Array.isArray(trendQuery.data) ? trendQuery.data : [];
  const returnsStats = returnsStatsQuery.data || {};
  const calendar = Array.isArray(calendarQuery.data) ? calendarQuery.data : [];
  const sanctionsStats = sanctionsQuery.data || {};
  const summary = summaryQuery.data || {};
  const riskProfile = riskProfileQuery.data || {};
  const coverage = coverageQuery.data || {};

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Fade in timeout={400}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Compliance Dashboard
        </Typography>

        {/* Section 1: Attention */}
        <SectionHeader
          title="Needs Attention"
          subtitle="Items requiring immediate action"
          color="#d32f2f"
        />
        <AttentionSection items={attention} />

        <Divider sx={{ my: 3 }} />

        {/* Section 2: Returns Status */}
        <SectionHeader
          title="Regulatory Returns Status"
          subtitle="Filing progress and upcoming deadlines"
          color="#2e7d32"
        />
        <ReturnsStatusSection stats={returnsStats} calendar={calendar} />

        <Divider sx={{ my: 3 }} />

        {/* Section 3: Compliance Trend */}
        <SectionHeader
          title="Compliance Trend"
          subtitle="Score and control performance over time"
          color="#1976d2"
        />
        <ComplianceTrendChart trend={trend} />

        <Divider sx={{ my: 3 }} />

        {/* Section 4: Controls Effectiveness */}
        <SectionHeader
          title="Controls Effectiveness"
          subtitle="Control performance and remediation status"
          color="#1976d2"
        />
        <ControlsRow snapshot={summary} />

        <Divider sx={{ my: 3 }} />

        {/* Section 5: Inherent Risk Profile */}
        <SectionHeader
          title="Inherent Risk Profile"
          subtitle="Applicable obligations by inherent risk, with control gaps"
          color="#d32f2f"
        />
        <RiskProfileRow profile={riskProfile} />

        <Divider sx={{ my: 3 }} />

        {/* Section 6: Area of Focus */}
        <SectionHeader
          title="Risk by Area of Focus"
          subtitle="Where inherent risk and control gaps concentrate"
          color="#1976d2"
        />
        <AreaOfFocusTable profile={riskProfile} coverage={coverage} />

        <Divider sx={{ my: 3 }} />

        {/* Section 7: Act */}
        <SectionHeader
          title="Risk by Act"
          subtitle="Obligation risk and gaps per originating act"
          color="#9c27b0"
        />
        <ActBreakdownTable profile={riskProfile} />

        <Divider sx={{ my: 3 }} />

        {/* Section 8: Sanctions & Penalty Exposure */}
        <SectionHeader
          title="Sanctions & Penalty Exposure"
          subtitle="Regulatory penalties and enforcement status"
          color="#d32f2f"
        />
        <SanctionsExposureRow stats={sanctionsStats} />
      </Box>
    </Fade>
  );
}
