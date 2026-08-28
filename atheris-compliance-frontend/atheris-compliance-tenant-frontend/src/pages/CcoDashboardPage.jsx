import { useState, useEffect, useCallback } from 'react';
import { Box, Grid, CircularProgress, Typography, Fade } from '@mui/material';
import { api } from '../services/api';
import AttentionSection from '../components/dashboard/AttentionSection';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import ComplianceTrendChart from '../components/dashboard/ComplianceTrendChart';
import ReturnsStatusSection from '../components/dashboard/ReturnsStatusSection';

const POLL_INTERVAL = 30000;

export default function CcoDashboardPage() {
  const [attention, setAttention] = useState({});
  const [events, setEvents] = useState([]);
  const [trend, setTrend] = useState([]);
  const [returnsStats, setReturnsStats] = useState({});
  const [calendar, setCalendar] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [att, evts, trnd, rStats, cal] = await Promise.allSettled([
        api.dashboard.attentionItems(),
        api.audit.register({ size: 10, sort: 'occurredAt,desc' }),
        api.dashboard.trends(),
        api.returns.stats(),
        api.returns.calendar({ days: 90 }),
      ]);
      if (att.status === 'fulfilled') setAttention(att.value || {});
      if (evts.status === 'fulfilled') {
        const d = evts.value;
        setEvents(Array.isArray(d) ? d : d?.content || []);
      }
      if (trnd.status === 'fulfilled') setTrend(Array.isArray(trnd.value) ? trnd.value : []);
      if (rStats.status === 'fulfilled') setReturnsStats(rStats.value || {});
      if (cal.status === 'fulfilled') setCalendar(Array.isArray(cal.value) ? cal.value : []);
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

        <Grid container spacing={2.5}>
          {/* Row 1: Attention + Activity Feed */}
          <Grid size={{ xs: 12, md: 6 }}>
            <AttentionSection items={attention} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ActivityFeed events={events} />
          </Grid>

          {/* Row 2: Compliance Trend (full width) */}
          <Grid size={{ xs: 12 }}>
            <ComplianceTrendChart trend={trend} />
          </Grid>

          {/* Row 3: Returns Status (3 equal columns) */}
          <Grid size={{ xs: 12 }}>
            <ReturnsStatusSection stats={returnsStats} calendar={calendar} />
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
}
