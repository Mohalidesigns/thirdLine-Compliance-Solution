import { useState, useEffect, useCallback } from 'react';
import { Box, Grid, CircularProgress, Typography, Fade, Divider } from '@mui/material';
import { api } from '../services/api';
import AttentionSection from '../components/dashboard/AttentionSection';
import ComplianceTrendChart from '../components/dashboard/ComplianceTrendChart';
import ReturnsStatusSection from '../components/dashboard/ReturnsStatusSection';
import SanctionsExposureRow from '../components/dashboard/SanctionsExposureRow';
import ControlsRow from '../components/dashboard/ControlsRow';

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
  const [attention, setAttention] = useState({});
  const [trend, setTrend] = useState([]);
  const [returnsStats, setReturnsStats] = useState({});
  const [calendar, setCalendar] = useState([]);
  const [sanctionsStats, setSanctionsStats] = useState({});
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [att, trnd, rStats, cal, sanc, summ] = await Promise.allSettled([
        api.dashboard.attentionItems(),
        api.dashboard.trends(),
        api.returns.stats(),
        api.returns.calendar({ days: 90 }),
        api.sanctions.stats(),
        api.dashboard.summary(),
      ]);
      if (att.status === 'fulfilled') setAttention(att.value || {});
      if (trnd.status === 'fulfilled') setTrend(Array.isArray(trnd.value) ? trnd.value : []);
      if (rStats.status === 'fulfilled') setReturnsStats(rStats.value || {});
      if (cal.status === 'fulfilled') setCalendar(Array.isArray(cal.value) ? cal.value : []);
      if (sanc.status === 'fulfilled') setSanctionsStats(sanc.value || {});
      if (summ.status === 'fulfilled') setSummary(summ.value || {});
    } catch {
      // partial loads are fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

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

        {/* Section 2: Compliance Trend */}
        <SectionHeader
          title="Compliance Trend"
          subtitle="Score and control performance over time"
          color="#1976d2"
        />
        <ComplianceTrendChart trend={trend} />

        <Divider sx={{ my: 3 }} />

        {/* Section 3: Controls Effectiveness */}
        <SectionHeader
          title="Controls Effectiveness"
          subtitle="Control performance and remediation status"
          color="#1976d2"
        />
        <ControlsRow snapshot={summary} />

        <Divider sx={{ my: 3 }} />

        {/* Section 4: Sanctions & Penalty Exposure */}
        <SectionHeader
          title="Sanctions & Penalty Exposure"
          subtitle="Regulatory penalties and enforcement status"
          color="#d32f2f"
        />
        <SanctionsExposureRow stats={sanctionsStats} />

        <Divider sx={{ my: 3 }} />

        {/* Section 5: Returns Status */}
        <SectionHeader
          title="Regulatory Returns Status"
          subtitle="Filing progress and upcoming deadlines"
          color="#2e7d32"
        />
        <ReturnsStatusSection stats={returnsStats} calendar={calendar} />
      </Box>
    </Fade>
  );
}
