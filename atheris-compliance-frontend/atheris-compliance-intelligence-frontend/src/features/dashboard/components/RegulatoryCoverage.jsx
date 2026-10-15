import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Tooltip, IconButton, LinearProgress,
} from '@mui/material';
import {
  KpiCards, DataCard, CardLink, StatusBadge, TL, tone, riskTone,
  ArrowPathIcon, ScaleIcon, DocumentTextIcon, ClipboardDocumentCheckIcon, ExclamationTriangleIcon,
  CalendarDaysIcon, BanknotesIcon, UserCircleIcon, Squares2x2Icon,
} from 'shared';
import api from '../../../services/api';

const NGN = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

function riskColor(label) {
  const key = String(label).toLowerCase();
  if (key === 'extreme') return tone('red').dot;
  return tone(riskTone(label)).dot;
}

function toEntries(map) {
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map)
    .map(([label, count]) => [label, Number(count) || 0])
    .sort((a, b) => b[1] - a[1]);
}

function PanelEmpty({ loading, text }) {
  return (
    <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500, py: 3, textAlign: 'center' }}>
      {loading ? 'Loading...' : text}
    </Typography>
  );
}

/** Donut (SVG ring) + legend — used for the risk distributions. */
function DonutPanel({ title, entries, loading, colorFor, onClick, emptyText, centerLabel }) {
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const size = 132;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <DataCard
      title={title}
      actions={onClick && <CardLink onClick={onClick}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      {loading || entries.length === 0 ? (
        <PanelEmpty loading={loading} text={emptyText || 'No data available'} />
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0, mx: 'auto' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TL.gray200} strokeWidth={stroke} />
              {total > 0 && entries.map(([label, count]) => {
                const len = (count / total) * c;
                const seg = (
                  <circle
                    key={label}
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={colorFor ? colorFor(label) : TL.primary}
                    strokeWidth={stroke}
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return seg;
              })}
            </svg>
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.gray800 }}>{total}</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{centerLabel}</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
            {entries.map(([label, count]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorFor ? colorFor(label) : TL.primary, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8125rem', color: TL.gray700, flex: 1, minWidth: 0 }} noWrap>{label}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TL.gray800 }}>{count}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray400, width: 36, textAlign: 'right' }}>
                  {total ? `${Math.round((count / total) * 100)}%` : '—'}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </DataCard>
  );
}

/** Key-value list with green progress bars. */
function ListPanel({ title, entries, loading, limit = 8, onClick, emptyText }) {
  const rows = entries.slice(0, limit);
  const max = rows.reduce((m, [, v]) => Math.max(m, v), 0) || 1;
  const hidden = entries.length - rows.length;
  return (
    <DataCard
      title={title}
      actions={onClick && <CardLink onClick={onClick}>View All</CardLink>}
      sx={{ height: '100%' }}
    >
      {loading || rows.length === 0 ? (
        <PanelEmpty loading={loading} text={emptyText || 'No data available'} />
      ) : (
        <>
          {rows.map(([label, count]) => (
            <Box key={label} sx={{ mb: 1.5, '&:last-of-type': { mb: 0 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: TL.gray700 }} noWrap>{label}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TL.gray800 }}>{count}</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.round((count / max) * 100)}
                sx={{ '& .MuiLinearProgress-bar': { bgcolor: TL.success } }}
              />
            </Box>
          ))}
          {hidden > 0 && (
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, mt: 1.5 }}>+{hidden} more</Typography>
          )}
        </>
      )}
    </DataCard>
  );
}

export default function RegulatoryCoverage() {
  const navigate = useNavigate();
  const [acts, setActs] = useState(null);
  const [obligations, setObligations] = useState(null);
  const [sanctions, setSanctions] = useState(null);
  const [returns, setReturns] = useState(null);
  const [controls, setControls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(0);

  const alive = useRef(true);
  const reqId = useRef(0);
  // Re-arm on setup: under StrictMode the simulated unmount would otherwise leave it false forever.
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = async () => {
    const id = ++reqId.current;
    setLoading(true);
    const setters = [setActs, setObligations, setSanctions, setReturns, setControls];
    const results = await Promise.allSettled([
      api.platform.acts.stats(),
      api.platform.obligations.stats(),
      api.platform.sanctions.stats(),
      api.platform.returns.stats(),
      api.platform.controls.stats(),
    ]);
    if (!alive.current || id !== reqId.current) return;
    results.forEach((r, i) => { if (r.status === 'fulfilled') setters[i](r.value); });
    setFailed(results.filter(r => r.status === 'rejected').length);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const obligationRisk = toEntries(obligations?.byRiskRating);
  const controlRisk = toEntries(controls?.byRiskLevel);
  const areaOfFocus = toEntries(obligations?.byAreaOfFocus);
  const exposure = Number(sanctions?.totalExposure) || 0;
  const unassigned = Number(returns?.unassignedCount) || 0;

  const rollup = [
    { key: 'acts', label: 'Acts', value: acts?.totalActs ?? 0, tone: 'blue', icon: <ScaleIcon />, to: '/admin/acts' },
    { key: 'instruments', label: 'Instruments', value: acts?.totalInstruments ?? 0, tone: 'teal', icon: <DocumentTextIcon />, to: '/admin/acts' },
    { key: 'obligations', label: 'Obligations', value: acts?.totalObligations ?? 0, tone: 'green', icon: <ClipboardDocumentCheckIcon />, to: '/admin/obligations' },
    { key: 'sanctions', label: 'Sanctions', value: acts?.totalSanctions ?? 0, tone: 'red', icon: <ExclamationTriangleIcon />, to: '/admin/sanctions' },
    { key: 'returns', label: 'Returns', value: acts?.totalReturns ?? 0, tone: 'amber', icon: <CalendarDaysIcon />, to: '/admin/returns' },
  ];

  const signals = [
    { key: 'highRisk', label: 'High-Risk Obligations', value: obligations?.highRiskCount ?? 0, tone: 'red', icon: <ExclamationTriangleIcon />, to: '/admin/obligations' },
    { key: 'highSev', label: 'High-Severity Sanctions', value: sanctions?.highSeverity ?? 0, tone: 'red', icon: <ExclamationTriangleIcon />, to: '/admin/sanctions' },
    { key: 'exposure', label: 'Sanction Exposure', value: NGN.format(exposure), tone: 'orange', icon: <BanknotesIcon />, to: '/admin/sanctions' },
    { key: 'unassigned', label: 'Unassigned Returns', value: unassigned, tone: unassigned > 0 ? 'amber' : 'green', icon: <UserCircleIcon />, to: '/admin/returns' },
    { key: 'areas', label: 'Areas of Focus', value: obligations?.areaCount ?? 0, tone: 'purple', icon: <Squares2x2Icon />, to: '/admin/obligations' },
  ];

  const routeFor = (list) => (key) => {
    const t = list.find(x => x.key === key);
    if (t) navigate(t.to);
  };
  const asItems = (list) => list.map((k) => ({ key: k.key, label: k.label, tone: k.tone, icon: k.icon, value: loading ? '...' : k.value }));

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>Regulatory Coverage</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>
            Risk, area of focus and act-level analytics across the regulatory universe
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {failed > 0 && (
            <StatusBadge tone="amber" label={`${failed} metric${failed > 1 ? 's' : ''} unavailable`} />
          )}
          <Tooltip title="Refresh analytics">
            <IconButton size="small" onClick={load}><ArrowPathIcon size={18} /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      <KpiCards items={asItems(rollup)} onSelect={routeFor(rollup)} columns={5} />
      <KpiCards items={asItems(signals)} onSelect={routeFor(signals)} columns={5} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <DonutPanel
          title="Obligations by Risk Rating"
          entries={obligationRisk}
          loading={loading}
          colorFor={riskColor}
          centerLabel="Obligations"
          onClick={() => navigate('/admin/obligations')}
          emptyText="No obligation risk ratings recorded"
        />
        <DonutPanel
          title="Controls by Risk Level"
          entries={controlRisk}
          loading={loading}
          colorFor={riskColor}
          centerLabel="Controls"
          onClick={() => navigate('/admin/controls')}
          emptyText="No controls recorded"
        />
        <ListPanel
          title="Obligations by Area of Focus"
          entries={areaOfFocus}
          loading={loading}
          onClick={() => navigate('/admin/obligations')}
          emptyText="No areas of focus recorded"
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap', color: TL.gray500 }}>
        <ClipboardDocumentCheckIcon size={16} />
        <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
          {loading ? 'Loading coverage analytics...' : (
            `${controls?.totalControls ?? 0} controls · ${(controls?.themes || []).length} control themes · ` +
            `${obligations?.totalObligations ?? 0} obligations · ${sanctions?.total ?? 0} sanctions · ` +
            `${returns?.totalReturns ?? 0} returns across ${returns?.responsibleUnitCount ?? 0} responsible units`
          )}
        </Typography>
      </Box>
    </Box>
  );
}
