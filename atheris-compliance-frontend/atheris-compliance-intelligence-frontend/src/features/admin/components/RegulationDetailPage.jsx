import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import {
  DetailHeader, CoverageStrip, SectionTabs, SectionTable, EntityDrawer, TL,
  obligationColumns, sanctionColumns, returnColumns, controlColumns, instrumentColumns,
  DocumentTextIcon, ClipboardDocumentListIcon, ScaleIcon, CalendarDaysIcon, ShieldCheckIcon, LinkIcon,
} from 'shared';
import EntityDrillDrawer from './detail/EntityDrillDrawer';
import ObligationDetailView from '../ObligationDetailView';

/**
 * Act detail. Each section tab reuses the SAME register endpoint + column definition as the
 * standalone register (filtered by this act). Clicking a row opens it in a right drawer
 * (instead of navigating away), with an "Open full page" escape.
 */
const TAB_API = {
  instruments: (actId, params, signal) => api.platform.instruments.list({ regulationId: actId, ...params }, signal),
  obligations: (actId, params, signal) => api.platform.obligations.list({ actId, ...params }, signal),
  sanctions: (actId, params, signal) => api.platform.sanctions.list({ regulationId: actId, ...params }, signal),
  returns: (actId, params, signal) => api.platform.returns.list({ actId, ...params }, signal),
  controls: (actId, params, signal) => api.platform.controls.list({ actId, ...params }, signal),
};

const ROW_KEY = {
  instruments: (r) => r.instrumentId,
  obligations: (r) => r.obligationId,
  sanctions: (r) => r.sanctionId,
  returns: (r) => r.returnId,
  controls: (r) => r.complianceControlId,
};

const DRILL_KIND = {
  instruments: 'instrument',
  obligations: 'obligation',
  sanctions: 'sanction',
  returns: 'return',
  controls: 'control',
};

const DRILL_ROUTE = {
  instruments: (id) => `/admin/instruments/${id}`,
  obligations: (id) => `/admin/obligations/${id}`,
  sanctions: (id) => `/admin/sanctions/${id}`,
  returns: (id) => `/admin/returns/${id}`,
  controls: (id) => `/admin/controls/${id}`,
};

export default function RegulationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('instruments');
  const [pages, setPages] = useState({});
  const [searches, setSearches] = useState({});
  const [drill, setDrill] = useState(null); // { tab, id }

  const { data: reg, isLoading, error } = useQuery({
    queryKey: ['act', String(id)],
    queryFn: ({ signal }) => api.platform.acts.get(id, signal),
    enabled: !!id,
  });

  // All hooks run before any early return (Rules of Hooks).
  const page = pages[tab] || 0;
  const search = searches[tab] || '';
  const size = 10;
  const setPage = (p) => setPages((s) => ({ ...s, [tab]: p }));
  const setSearch = (v) => setSearches((s) => ({ ...s, [tab]: v }));
  const params = { page, size, q: search || undefined };

  const { data, isLoading: tabLoading, error: tabError } = useQuery({
    queryKey: ['act-tab', String(id), tab, page, search],
    queryFn: ({ signal }) => TAB_API[tab](id, params, signal),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (error || !reg) {
    return (
      <Box>
        <DetailHeader band title="Act" onBack={() => navigate(ROUTES.ADMIN_ACTS)} backLabel="Back to Acts" />
        <Alert severity="error">{error?.message || 'Act not found'}</Alert>
      </Box>
    );
  }

  const tabs = [
    { key: 'instruments', label: 'Instruments', count: reg.instrumentCount },
    { key: 'obligations', label: 'Obligations', count: reg.obligationCount },
    { key: 'sanctions', label: 'Sanctions', count: reg.sanctionCount },
    { key: 'returns', label: 'Returns', count: reg.returnCount },
    { key: 'controls', label: 'Controls', count: reg.controlCount },
  ];

  const coverage = [
    { key: 'instruments', label: 'Instruments', value: reg.instrumentCount ?? 0, tone: 'blue', icon: <DocumentTextIcon /> },
    { key: 'obligations', label: 'Obligations', value: reg.obligationCount ?? 0, tone: 'green', icon: <ClipboardDocumentListIcon /> },
    { key: 'sanctions', label: 'Sanctions', value: reg.sanctionCount ?? 0, tone: 'red', icon: <ScaleIcon /> },
    { key: 'returns', label: 'Returns', value: reg.returnCount ?? 0, tone: 'purple', icon: <CalendarDaysIcon /> },
    { key: 'controls', label: 'Controls', value: reg.controlCount ?? 0, tone: 'orange', icon: <ShieldCheckIcon /> },
  ];

  const regMap = reg.regulatorId ? { [reg.regulatorId]: reg.regulatorName } : {};
  const columnsByTab = {
    instruments: instrumentColumns({ regMap }),
    obligations: obligationColumns(),
    sanctions: sanctionColumns(),
    returns: returnColumns(),
    controls: controlColumns({ withAct: false }),
  };

  const tabRows = data?.content || [];
  const tabTotal = data?.totalElements ?? 0;
  const drillKind = drill ? DRILL_KIND[drill.tab] : null;
  const drillRoute = drill ? DRILL_ROUTE[drill.tab](drill.id) : undefined;

  return (
    <Box>
      <DetailHeader
        onBack={() => navigate(ROUTES.ADMIN_ACTS)}
        band
        backLabel="Back to Acts"
        title={reg.name}
        status={reg.status || 'Active'}
        statusTone={reg.status === 'Superseded' || reg.status === 'Outdated' ? 'red' : 'teal'}
        meta={(reg.regulatorName || reg.abbreviation) ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {reg.regulatorName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem' }}>
                <LinkIcon size={14} />
                {reg.regulatorName}
              </Typography>
            )}
            {reg.abbreviation && (
              <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>
                {reg.abbreviation}
              </Typography>
            )}
          </Box>
        ) : null}
        description={reg.description}
      />

      <Box sx={{ mb: 3, width: '100%' }}>
        <CoverageStrip title="Coverage" items={coverage} onTileClick={(k) => setTab(k)} />
      </Box>

      <SectionTabs tabs={tabs} value={tab} onChange={setTab} sx={{ mb: 2 }} />

      <SectionTable
        rows={tabRows}
        total={tabTotal}
        page={page}
        size={size}
        loading={tabLoading}
        error={tabError}
        onPage={setPage}
        rowKey={ROW_KEY[tab]}
        onRowClick={(r) => setDrill({ tab, id: ROW_KEY[tab](r) })}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: `Search ${tab}…` }}
        emptyMessage={`No ${tab} linked to this act.`}
        columns={columnsByTab[tab]}
      />

      {drillKind === 'obligation' ? (
        <EntityDrawer
          open={!!drill}
          onClose={() => setDrill(null)}
          title="Obligation"
          width={720}
          onOpenFull={() => drillRoute && navigate(drillRoute)}
        >
          {drill && <ObligationDetailView obligationId={drill.id} />}
        </EntityDrawer>
      ) : (
        <EntityDrillDrawer
          kind={drillKind}
          id={drill?.id}
          onClose={() => setDrill(null)}
        />
      )}
    </Box>
  );
}