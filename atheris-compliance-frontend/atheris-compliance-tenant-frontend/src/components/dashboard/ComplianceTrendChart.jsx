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

/** Days between two ISO dates. */
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/**
 * One point per daily snapshot; a day with no snapshot is a gap (null), never an invented value —
 * the metrics are point-in-time and cannot be reconstructed for past days. The "current" stats
 * come from the live metrics so they always match the KPI strip.
 */
export default function ComplianceTrendChart({ trend = [], metrics = {} }) {
  const data = useMemo(() => {
    const points = [...trend]
      .reverse()
      .map(s => ({
        date: s.snapshotDate,
        score: s.complianceScore ?? null,
        // returns_total = filings due, so this is on time ÷ due; null when nothing was due
        returnsOnTime: s.returnsTotal > 0 ? (s.returnsSubmittedOnTime / s.returnsTotal) * 100 : null,
        controlsPassing: s.controlsTotal > 0 ? (s.controlsPassing / s.controlsTotal) * 100 : null,
      }));
    const out = [];
    points.forEach((p, i) => {
      if (i > 0) {
        const gap = daysBetween(points[i - 1].date, p.date);
        for (let d = 1; d < gap; d++) {
          const day = new Date(points[i - 1].date);
          day.setDate(day.getDate() + d);
          out.push({ date: day.toISOString().slice(0, 10), score: null, returnsOnTime: null, controlsPassing: null });
        }
      }
      out.push(p);
    });
    return out;
  }, [trend]);

  const missingDays = data.filter(d => d.score == null).length;
  const latest = data.length > 0 ? {
    score: metrics.complianceScore ?? null,
    returnsOnTime: metrics.returnsOnTimePct ?? null,
    controlsPassing: metrics.controlsTotal > 0 ? (metrics.controlsPassing / metrics.controlsTotal) * 100 : null,
  } : null;
  const fmt = v => (v == null ? 'N/A' : `${Number(v).toFixed(1)}%`);

  return (
    <DataCard
      title="Compliance Trend"
      subtitle={`Daily snapshots · last ${data.length} days${missingDays ? ` · ${missingDays} day${missingDays > 1 ? 's' : ''} without a snapshot` : ''}`}
      sx={{ height: '100%' }}
    >
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
                  formatter={(value, name) => [fmt(value), name === 'score' ? 'Compliance Score' : name === 'returnsOnTime' ? 'Returns On Time' : 'Controls Passing (of all controls)']}
                  labelFormatter={d => formatDate(d)}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${TL.gray100}`, boxShadow: TL.cardShadow, fontSize: 12 }}
                />
                <ReferenceLine y={90} stroke={GREEN} strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Target 90%', position: 'right', fontSize: 10, fill: GREEN }} />
                <ReferenceLine y={70} stroke={ORANGE} strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Warning 70%', position: 'right', fontSize: 10, fill: ORANGE }} />
                <Area
                  type="monotone" dataKey="score" name="score"
                  stroke={NAVY} strokeWidth={2.5}
                  fill={NAVY} fillOpacity={0.08}
                  dot={{ r: 3, fill: NAVY }}
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
              <MiniStat label="Current Score" dot={NAVY} value={fmt(latest.score)} color={latest.score == null ? TL.gray500 : latest.score >= 90 ? GREEN : latest.score >= 70 ? ORANGE : RED} />
              <MiniStat label="Returns On Time" dot={GREEN} value={fmt(latest.returnsOnTime)} />
              <MiniStat label="Controls Passing (of all)" dot={YELLOW} value={fmt(latest.controlsPassing)} />
            </Box>
          )}
        </>
      )}
    </DataCard>
  );
}
