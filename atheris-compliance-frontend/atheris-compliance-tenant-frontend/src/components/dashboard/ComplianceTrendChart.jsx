import { useMemo } from 'react';
import { Paper, Typography, Box, useTheme } from '@mui/material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart,
} from 'recharts';

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function MiniStat({ label, value, color }) {
  const theme = useTheme();
  return (
    <Box sx={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
      <Typography variant="h5" fontWeight={700} color={color || 'text.primary'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export default function ComplianceTrendChart({ trend = [] }) {
  const theme = useTheme();

  const data = useMemo(() => {
    return [...trend]
      .reverse()
      .map(s => ({
        date: s.snapshotDate,
        score: s.complianceScore ?? 0,
        returnsOnTime: s.returnsTotal > 0
          ? (s.returnsSubmittedOnTime / s.returnsTotal) * 100
          : 0,
        controlsPassing: s.controlsTotal > 0
          ? (s.controlsPassing / s.controlsTotal) * 100
          : 0,
      }));
  }, [trend]);

  const latest = data.length > 0 ? data[data.length - 1] : null;

  return (
    <Paper sx={{ p: 3 }}>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Not enough data for trend chart. Snapshots are computed daily at 2 AM.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ height: 280, mt: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1976d2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1976d2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name === 'score' ? 'Compliance Score' : name === 'returnsOnTime' ? 'Returns On Time' : 'Controls Passing']}
                  labelFormatter={d => formatDate(d)}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: theme.shadows[2] }}
                />
                <ReferenceLine y={90} stroke="#4caf50" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Target 90%', position: 'right', fontSize: 10, fill: '#4caf50' }} />
                <ReferenceLine y={70} stroke="#ed6c02" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Warning 70%', position: 'right', fontSize: 10, fill: '#ed6c02' }} />
                <Area
                  type="monotone" dataKey="score" name="score"
                  stroke="#1976d2" strokeWidth={2.5}
                  fill="url(#scoreGrad)"
                />
                <Line
                  type="monotone" dataKey="returnsOnTime" name="returnsOnTime"
                  stroke="#4caf50" strokeWidth={1.5} strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone" dataKey="controlsPassing" name="controlsPassing"
                  stroke="#9c27b0" strokeWidth={1} strokeDasharray="2 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
          {latest && (
            <Box sx={{ display: 'flex', gap: 3, mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <MiniStat label="Current Score" value={`${Number(latest.score).toFixed(2)}%`} color={latest.score >= 90 ? '#4caf50' : latest.score >= 70 ? '#ed6c02' : '#d32f2f'} />
              <MiniStat label="Returns On Time" value={`${latest.returnsOnTime.toFixed(2)}%`} color="#4caf50" />
              <MiniStat label="Controls Passing" value={`${latest.controlsPassing.toFixed(2)}%`} color="#9c27b0" />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
