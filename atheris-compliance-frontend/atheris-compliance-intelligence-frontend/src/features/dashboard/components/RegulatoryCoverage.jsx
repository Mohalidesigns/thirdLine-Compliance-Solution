import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Paper, Tooltip, IconButton, Chip, LinearProgress,
} from '@mui/material';
import {
  Refresh, Gavel, Description, Rule, Warning, EventRepeat,
  Payments, ReportProblem, PersonOff, Category, FactCheck,
} from '@mui/icons-material';
import api from '../../../services/api';

const NGN = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const RISK_COLOR = {
  extreme: '#9B2C2C', critical: '#9B2C2C', high: '#C53030',
  moderate: '#DD6B20', medium: '#DD6B20', low: '#2D7D46',
};

function riskColor(label) {
  return RISK_COLOR[String(label).toLowerCase()] || '#718096';
}

function toEntries(map) {
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map)
    .map(([label, count]) => [label, Number(count) || 0])
    .sort((a, b) => b[1] - a[1]);
}

function Tile({ label, value, color, icon, onClick }) {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 1.5, borderLeft: `3px solid ${color}`, cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .2s', '&:hover': onClick ? { boxShadow: 2 } : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Box sx={{ color, opacity: 0.5, display: 'flex' }}>{icon}</Box>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color }} noWrap>{value}</Typography>
    </Paper>
  );
}

function Distribution({ title, entries, loading, limit = 8, colorFor, onClick, emptyText }) {
  const rows = entries.slice(0, limit);
  const max = rows.reduce((m, [, v]) => Math.max(m, v), 0) || 1;
  const hidden = entries.length - rows.length;
  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        {onClick && (
          <Chip label="Explore" size="small" onClick={onClick}
            sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#EDF2F7', color: '#4A5568' }} />
        )}
      </Box>
      {loading ? (
        <Typography variant="caption" color="text.secondary">Loading...</Typography>
      ) : rows.length === 0 ? (
        <Typography variant="caption" color="text.secondary">{emptyText || 'No data available'}</Typography>
      ) : rows.map(([label, count]) => {
        const c = colorFor ? colorFor(label) : '#1A365D';
        return (
          <Box key={label} sx={{ mb: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#4A5568' }} noWrap>{label}</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: c }}>{count}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.round((count / max) * 100)}
              sx={{ height: 5, borderRadius: 3, bgcolor: '#EDF2F7', '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 3 } }}
            />
          </Box>
        );
      })}
      {hidden > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
          +{hidden} more
        </Typography>
      )}
    </Paper>
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
  useEffect(() => () => { alive.current = false; }, []);

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
    { key: 'acts', label: 'Acts', value: acts?.totalActs ?? 0, color: '#1A365D', icon: <Gavel sx={{ fontSize: 18 }} />, to: '/admin/acts' },
    { key: 'instruments', label: 'Instruments', value: acts?.totalInstruments ?? 0, color: '#3182CE', icon: <Description sx={{ fontSize: 18 }} />, to: '/admin/acts' },
    { key: 'obligations', label: 'Obligations', value: acts?.totalObligations ?? 0, color: '#2D7D46', icon: <Rule sx={{ fontSize: 18 }} />, to: '/admin/obligations' },
    { key: 'sanctions', label: 'Sanctions', value: acts?.totalSanctions ?? 0, color: '#C53030', icon: <Warning sx={{ fontSize: 18 }} />, to: '/admin/sanctions' },
    { key: 'returns', label: 'Returns', value: acts?.totalReturns ?? 0, color: '#D4AF37', icon: <EventRepeat sx={{ fontSize: 18 }} />, to: '/admin/returns' },
  ];

  const signals = [
    { key: 'highRisk', label: 'High-Risk Obligations', value: obligations?.highRiskCount ?? 0, color: '#C53030', icon: <ReportProblem sx={{ fontSize: 18 }} />, to: '/admin/obligations' },
    { key: 'highSev', label: 'High-Severity Sanctions', value: sanctions?.highSeverity ?? 0, color: '#9B2C2C', icon: <Warning sx={{ fontSize: 18 }} />, to: '/admin/sanctions' },
    { key: 'exposure', label: 'Sanction Exposure', value: NGN.format(exposure), color: '#DD6B20', icon: <Payments sx={{ fontSize: 18 }} />, to: '/admin/sanctions' },
    { key: 'unassigned', label: 'Unassigned Returns', value: unassigned, color: unassigned > 0 ? '#D4AF37' : '#2D7D46', icon: <PersonOff sx={{ fontSize: 18 }} />, to: '/admin/returns' },
    { key: 'areas', label: 'Areas of Focus', value: obligations?.areaCount ?? 0, color: '#805AD5', icon: <Category sx={{ fontSize: 18 }} />, to: '/admin/obligations' },
  ];

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Regulatory Coverage</Typography>
            <Typography variant="body2" color="text.secondary">
              Risk, area of focus and act-level analytics across the regulatory universe
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {failed > 0 && (
              <Chip size="small" label={`${failed} metric${failed > 1 ? 's' : ''} unavailable`}
                sx={{ height: 20, fontSize: '0.6rem', bgcolor: '#FEF9E7', color: '#B7791F' }} />
            )}
            <Tooltip title="Refresh analytics">
              <IconButton size="small" onClick={load}><Refresh sx={{ fontSize: 18 }} /></IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 1.5 }}>
          {rollup.map(t => (
            <Tile key={t.key} label={t.label} value={loading ? '...' : t.value} color={t.color} icon={t.icon}
              onClick={() => navigate(t.to)} />
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 1.5 }}>
          {signals.map(t => (
            <Tile key={t.key} label={t.label} value={loading ? '...' : t.value} color={t.color} icon={t.icon}
              onClick={() => navigate(t.to)} />
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          <Distribution
            title="Obligations by Risk Rating"
            entries={obligationRisk}
            loading={loading}
            colorFor={riskColor}
            onClick={() => navigate('/admin/obligations')}
            emptyText="No obligation risk ratings recorded"
          />
          <Distribution
            title="Controls by Risk Level"
            entries={controlRisk}
            loading={loading}
            colorFor={riskColor}
            onClick={() => navigate('/admin/controls')}
            emptyText="No controls recorded"
          />
          <Distribution
            title="Obligations by Area of Focus"
            entries={areaOfFocus}
            loading={loading}
            onClick={() => navigate('/admin/obligations')}
            emptyText="No areas of focus recorded"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <FactCheck sx={{ fontSize: 16, color: '#718096' }} />
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Loading coverage analytics...' : (
              `${controls?.totalControls ?? 0} controls · ${(controls?.themes || []).length} control themes · ` +
              `${obligations?.totalObligations ?? 0} obligations · ${sanctions?.total ?? 0} sanctions · ` +
              `${returns?.totalReturns ?? 0} returns across ${returns?.responsibleUnitCount ?? 0} responsible units`
            )}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
