import { useMemo } from 'react';
import { Typography, Box } from '@mui/material';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart,
} from 'recharts';
import { DataCard, TL } from 'shared';

const NAVY = '#1A365D';
const GREEN = '#22C55E';
const ORANGE = '#F97316';
const RED = '#EF4444';
const YELLOW = '#EAB308';

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function MiniStat({ label, value, color, dot }) {
  return (
    <Box sx={{ flex: 1, minWidth: 100 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: color || TL.gray800 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function ComplianceTrendChart({ trend = [] }) {
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
    <DataCard title="Compliance Trend" subtitle="Score and control performance over time" sx={{ height: '100%' }}>
      {data.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Not enough data for trend chart. Snapshots are computed daily at 2 AM.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={TL.gray100} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: TL.gray500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: TL.gray500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name === 'score' ? 'Compliance Score' : name === 'returnsOnTime' ? 'Returns On Time' : 'Controls Passing']}
                  labelFormatter={d => formatDate(d)}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${TL.gray100}`, boxShadow: TL.cardShadow, fontSize: 12 }}
                />
                <ReferenceLine y={90} stroke={GREEN} strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Target 90%', position: 'right', fontSize: 10, fill: GREEN }} />
                <ReferenceLine y={70} stroke={ORANGE} strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Warning 70%', position: 'right', fontSize: 10, fill: ORANGE }} />
                <Area
                  type="monotone" dataKey="score" name="score"
                  stroke={NAVY} strokeWidth={2.5}
                  fill={NAVY} fillOpacity={0.08}
                />
                <Line
                  type="monotone" dataKey="returnsOnTime" name="returnsOnTime"
                  stroke={GREEN} strokeWidth={1.5} strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone" dataKey="controlsPassing" name="controlsPassing"
                  stroke={YELLOW} strokeWidth={1.5} strokeDasharray="2 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
          {latest && (
            <Box sx={{ display: 'flex', gap: 3, mt: 2, pt: 2, borderTop: `1px solid ${TL.gray100}`, flexWrap: 'wrap' }}>
              <MiniStat label="Current Score" dot={NAVY} value={`${Number(latest.score).toFixed(2)}%`} color={latest.score >= 90 ? GREEN : latest.score >= 70 ? ORANGE : RED} />
              <MiniStat label="Returns On Time" dot={GREEN} value={`${latest.returnsOnTime.toFixed(2)}%`} />
              <MiniStat label="Controls Passing" dot={YELLOW} value={`${latest.controlsPassing.toFixed(2)}%`} />
            </Box>
          )}
        </>
      )}
    </DataCard>
  );
}
