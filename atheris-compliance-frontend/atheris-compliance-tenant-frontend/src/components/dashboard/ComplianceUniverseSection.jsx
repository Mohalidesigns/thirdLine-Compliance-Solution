import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  KpiCards, DataCard, CardLink, TL,
  GlobeAltIcon, ExclamationTriangleIcon, ExclamationCircleIcon, CheckCircleIcon, InformationCircleIcon,
} from 'shared';

/**
 * Compliance Universe — the tenant's regulatory universe at a glance (mirrors the intel
 * Compliance Universe page): risk KPIs, top regulators with a nature mix, and areas of focus.
 * `stats` is UniverseStatsResponse from GET /subscriptions/instruments/universe-stats.
 *
 * Every drill-down deep-links into the Compliance Universe page (/universe), whose filters are
 * applied server-side and read from the URL.
 */
const RISK_CARDS = [
  { key: 'Critical', tone: 'red', icon: <ExclamationCircleIcon /> },
  { key: 'High', tone: 'red', icon: <ExclamationTriangleIcon /> },
  { key: 'Medium', tone: 'amber', icon: <InformationCircleIcon /> },
  { key: 'Moderate', tone: 'amber', icon: <InformationCircleIcon /> },
  { key: 'Low', tone: 'green', icon: <CheckCircleIcon /> },
  // instruments with no risk rating — shown so the risk cards add up to the total
  { key: 'Unrated', tone: 'gray', icon: <InformationCircleIcon /> },
];
const TOP_REGULATORS = 6;

export default function ComplianceUniverseSection({ stats }) {
  const navigate = useNavigate();
  const openUniverse = (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    navigate(`/universe${qs ? `?${qs}` : ''}`);
  };

  const byRisk = stats?.byRiskRating || {};
  const regulatorsByRisk = stats?.regulatorsByRisk || {};
  const byRegulator = stats?.byRegulator || {};
  const byNature = stats?.byNature || {};
  const byArea = stats?.byAreaOfFocus || {};
  const total = stats?.total ?? 0;

  // Always show High/Medium/Low (the universe's usual scale); Critical/Moderate/Unrated only when present.
  const riskCards = RISK_CARDS
    .filter((r) => ['High', 'Medium', 'Low'].includes(r.key) || byRisk[r.key] > 0)
    .map((r) => ({
      key: r.key,
      label: r.key === 'Unrated' ? 'Unrated' : `${r.key} Risk`,
      caption: r.key === 'Unrated' ? 'No risk rating on the instrument' : undefined,
      value: byRisk[r.key] ?? 0,
      tone: r.tone,
      icon: r.icon,
      breakdown: regulatorsByRisk[r.key],
    }));

  const kpis = [
    { key: 'total', label: 'Total Instruments', value: total, tone: 'blue', icon: <GlobeAltIcon />, breakdown: byRegulator },
    ...riskCards,
  ];

  const regulators = Object.entries(byRegulator).slice(0, TOP_REGULATORS);
  const maxRegulator = regulators.length ? regulators[0][1] : 0;
  const areas = Object.entries(byArea);

  return (
    <Box component="section" sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>Compliance Universe</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>
            The regulatory instruments in your register, by risk, regulator and area of focus
          </Typography>
        </Box>
        <CardLink onClick={() => openUniverse()}>View Compliance Universe</CardLink>
      </Box>

      <KpiCards
        items={kpis}
        columns={kpis.length}
        onSelect={(key) => openUniverse({ riskRating: key === 'total' ? '' : key })}
        onDrill={(key, regulator) => openUniverse({ riskRating: key === 'total' ? '' : key, regulator })}
      />

      <Box sx={{ display: 'grid', gap: 3, mb: 3, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', lg: '2fr 3fr' } }}>
        <DataCard title="Top Regulators" actions={<CardLink onClick={() => openUniverse()}>View All</CardLink>}>
          {regulators.length === 0 ? (
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No instruments in your universe yet.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {regulators.map(([name, count]) => (
                <Box
                  key={name}
                  component="button"
                  type="button"
                  onClick={() => openUniverse({ regulator: name })}
                  sx={{
                    all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%',
                    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34% 40px', alignItems: 'center', gap: 2,
                    px: 1, py: 0.5, mx: -1, borderRadius: '8px', '&:hover': { bgcolor: TL.gray50 },
                    '&:focus-visible': { outline: `2px solid ${TL.primary}`, outlineOffset: 1 },
                  }}
                >
                  <Tooltip title={name} placement="top-start">
                    <Typography noWrap sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{name}</Typography>
                  </Tooltip>
                  <Box sx={{ height: 8, borderRadius: 9999, bgcolor: TL.gray200, overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%', borderRadius: 9999, bgcolor: TL.primary,
                      width: `${Math.max(4, Math.round((count / maxRegulator) * 100))}%`,
                    }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, textAlign: 'right' }}>{count}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {Object.keys(byNature).length > 0 && (
            <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${TL.gray100}` }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.25 }}>
                Nature Mix
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(byNature).map(([nature, count]) => (
                  <Chip key={nature} label={`${nature}: ${count}`} clickable onClick={() => openUniverse({ nature })} />
                ))}
              </Box>
            </Box>
          )}
        </DataCard>

        <DataCard title="Areas of Focus" subtitle={`${areas.filter(([a]) => a !== 'Unassigned').length} areas · click an area to see its instruments`}>
          {areas.length === 0 ? (
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No areas of focus recorded yet.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {areas.map(([area, count]) => (
                <Chip
                  key={area}
                  label={`${area} (${count})`}
                  clickable
                  variant={area === 'Unassigned' ? 'outlined' : 'filled'}
                  onClick={() => openUniverse({ areaOfFocus: area })}
                />
              ))}
            </Box>
          )}
        </DataCard>
      </Box>
    </Box>
  );
}
