import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DataCard, CardLink, StatusBadge, TL, InformationCircleIcon } from 'shared';

const RISK_LEVELS = [
  { level: 'Critical', summaryKey: 'extremeCount', rowKey: 'extreme', color: '#EF4444' },
  { level: 'High', summaryKey: 'highCount', rowKey: 'high', color: '#F97316' },
  { level: 'Moderate', summaryKey: 'mediumCount', rowKey: 'medium', color: '#EAB308' },
  { level: 'Low', summaryKey: 'lowCount', rowKey: 'low', color: '#22C55E' },
  // no likelihood/impact rating — never folded into a real band
  { level: 'Unrated', summaryKey: 'unratedCount', rowKey: 'unrated', color: '#9CA3AF' },
];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const nameSx = { fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' };

function RiskCell({ extreme, high, breakdown }) {
  const value = extreme + high;
  return (
    <Tooltip title={breakdown}>
      <span>
        <StatusBadge label={value} tone={extreme > 0 ? 'red' : high > 0 ? 'orange' : 'gray'} />
      </span>
    </Tooltip>
  );
}

function GapsBadge({ value }) {
  return <StatusBadge label={value} tone={value > 0 ? 'red' : 'gray'} />;
}

export function RiskProfileRow({ profile = {} }) {
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
  }).filter((c) => c.level !== 'Unrated' || c.count > 0);
  const slices = cards.filter((c) => c.count > 0);

  return (
    <DataCard
      title="Inherent Risk Profile"
      subtitle={`${total} applicable obligations rated by inherent risk`}
      actions={<CardLink onClick={() => navigate('/obligations?hasGap=true')}>Control gaps: {gaps}</CardLink>}
      sx={{ height: '100%' }}
    >
      <Box sx={{ position: 'relative', height: 180, mb: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.length ? slices : [{ level: 'None', count: 1, color: TL.gray200 }]}
              dataKey="count"
              nameKey="level"
              innerRadius={58}
              outerRadius={80}
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
              onClick={(d) => { if (d?.level && d.level !== 'None') navigate(`/obligations?risk=${encodeURIComponent(d.level)}`); }}
            >
              {(slices.length ? slices : [{ level: 'None', color: TL.gray200 }]).map((s) => (
                <Cell key={s.level} fill={s.color} style={{ cursor: s.level === 'None' ? 'default' : 'pointer' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: TL.gray800, lineHeight: 1.2 }}>{total}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>obligations</Typography>
        </Box>
      </Box>

      {/* legend: colour dot · level · % · right-aligned count */}
      <Box>
        {cards.map(({ level, count, pct, color }, i) => (
          <Box
            key={level}
            onClick={() => navigate(`/obligations?risk=${encodeURIComponent(level)}`)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, py: 1, cursor: 'pointer',
              borderTop: i ? `1px solid ${TL.gray100}` : 'none',
              '&:hover .tl-legend-label': { color: TL.primary },
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography className="tl-legend-label" sx={{ flex: 1, fontSize: '0.875rem', color: TL.gray700 }}>{level}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{pct}%</Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, minWidth: 32, textAlign: 'right' }}>{count}</Typography>
          </Box>
        ))}
      </Box>

      {total > 0 && (
        <Typography sx={{ mt: 1.5, fontSize: '0.75rem', color: TL.gray500 }}>
          {gaps} of {total} without a control
        </Typography>
      )}
    </DataCard>
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
    <DataCard
      title="Risk by Area of Focus"
      // "Unassigned" is a bucket, not an area
      subtitle={`${rows.filter((r) => r.areaOfFocus !== 'Unassigned').length} areas across the applicable obligation set`}
      actions={typeof overallPct === 'number'
        ? <StatusBadge label={`Control coverage ${overallPct}%`} tone="blue" />
        : null}
      noPadding
      sx={{ height: '100%' }}
    >
      {sorted.length === 0 ? (
        <Typography sx={{ p: 3, fontSize: '0.875rem', color: TL.gray500 }}>No area of focus data available.</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Area of Focus</TableCell>
                <TableCell align="right">Obligations</TableCell>
                <TableCell align="right">Critical + High</TableCell>
                <TableCell align="right">Gaps</TableCell>
                <TableCell align="right">Coverage</TableCell>
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
                    <TableCell><Typography sx={nameSx}>{area}</Typography></TableCell>
                    <TableCell align="right">{num(row.total)}</TableCell>
                    <TableCell align="right">
                      <RiskCell
                        extreme={num(row.extreme)}
                        high={num(row.high)}
                        breakdown={`Critical ${num(row.extreme)} · High ${num(row.high)} · Moderate ${num(row.medium)} · Low ${num(row.low)}${num(row.unrated) ? ` · Unrated ${num(row.unrated)}` : ''}`}
                      />
                    </TableCell>
                    <TableCell align="right"><GapsBadge value={num(row.gaps)} /></TableCell>
                    <TableCell align="right">
                      {cov && typeof cov.coveragePercentage === 'number'
                        ? `${cov.coveragePercentage}%`
                        : <Typography component="span" sx={{ fontSize: '0.75rem', color: TL.gray400 }}>—</Typography>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataCard>
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
    unrated: num(row.unrated),
    gaps: num(row.gaps),
  })).sort((a, b) => (b.extreme + b.high) - (a.extreme + a.high) || b.gaps - a.gaps);

  return (
    <DataCard
      title="Risk by Act"
      subtitle={normalized.length > 0
        // "Unassigned" is a bucket, not an act
        ? `${profile.summary?.actCount ?? normalized.filter((r) => r.name !== 'Unassigned').length} acts across the applicable obligation set`
        : 'Per-act analytics are not yet published by the dashboard service'}
      noPadding
      sx={{ height: '100%' }}
    >
      {normalized.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 3 }}>
          <InformationCircleIcon size={18} sx={{ color: TL.gray400 }} />
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Act breakdown not available. It will appear here once the risk profile returns per-act figures.
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Act</TableCell>
                <TableCell align="right">Obligations</TableCell>
                <TableCell align="right">Critical + High</TableCell>
                <TableCell align="right">Gaps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {normalized.map((row) => (
                <TableRow key={row.key} hover>
                  <TableCell><Typography sx={nameSx}>{row.name}</Typography></TableCell>
                  <TableCell align="right">{row.total}</TableCell>
                  <TableCell align="right">
                    <RiskCell
                      extreme={row.extreme}
                      high={row.high}
                      breakdown={`Critical ${row.extreme} · High ${row.high} · Moderate ${row.medium} · Low ${row.low}${row.unrated ? ` · Unrated ${row.unrated}` : ''}`}
                    />
                  </TableCell>
                  <TableCell align="right"><GapsBadge value={row.gaps} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataCard>
  );
}
