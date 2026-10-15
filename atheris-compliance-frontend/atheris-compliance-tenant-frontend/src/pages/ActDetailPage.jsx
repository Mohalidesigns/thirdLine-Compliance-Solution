import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import {
  DetailHeader, PageHeader, CoverageStrip, SectionTabs, SectionTable, RiskBadge, StateBadge, TL,
  formatDate, formatNaira,
  ScaleIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, BanknotesIcon,
} from 'shared';
import { api } from '../services/api';

const SIZE = 10;

const ellipsis = (w) => ({ maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
// primary entity cell: navy 14px/500
const primarySx = { color: 'primary.main', fontWeight: 500 };

const ROW_KEY = {
  obligations: (r) => r.obligationId,
  controls: (r) => r.controlId,
  returns: (r) => r.returnId,
  sanctions: (r) => r.sanctionId,
};

// Columns bound to the TENANT register DTO field names (the shared factories are intel-shaped
// and would silently render blanks here). Max 5 columns.
const COLUMNS = {
  obligations: [
    { id: 'title', label: 'Obligation', minWidth: 320, truncate: true, render: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ ...primarySx, ...ellipsis(360) }}>{r.title || r.name || '—'}</Typography>
        {r.plainEnglishStatement && (
          <Typography sx={{ display: 'block', fontSize: '0.75rem', color: TL.gray500, ...ellipsis(360) }}>{r.plainEnglishStatement}</Typography>
        )}
      </Box>) },
    { id: 'sectionReference', label: 'Section', minWidth: 110, truncate: true,
      render: (r) => <Typography variant="body2" sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{r.sectionReference || '—'}</Typography> },
    { id: 'risk', label: 'Risk', minWidth: 100, render: (r) => <RiskBadge value={r.tenantRiskRating || r.inherentRiskRating} /> },
    { id: 'controlCount', label: 'Controls', minWidth: 90, render: (r) => <Typography variant="body2">{r.controlCount ?? 0}</Typography> },
    { id: 'status', label: 'Status', minWidth: 110, render: (r) => (r.status ? <StateBadge value={r.status} /> : <Typography variant="body2">—</Typography>) },
  ],
  controls: [
    { id: 'controlNumber', label: 'Control', minWidth: 300, truncate: true, render: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ ...primarySx, ...ellipsis(320) }}>{r.name || r.controlSummary || '—'}</Typography>
      </Box>) },
    { id: 'theme', label: 'Theme / Area', minWidth: 180, truncate: true,
      render: (r) => <Typography variant="body2" color="text.secondary" sx={ellipsis(200)}>{r.theme || r.complianceArea || '—'}</Typography> },
    { id: 'risk', label: 'Risk', minWidth: 100, render: (r) => <RiskBadge value={r.residualRisk || r.residualRiskRating} /> },
    { id: 'status', label: 'Status', minWidth: 110, render: (r) => (r.status ? <StateBadge value={r.status} /> : <Typography variant="body2">—</Typography>) },
  ],
  returns: [
    { id: 'returnName', label: 'Return', minWidth: 300, truncate: true,
      render: (r) => <Typography variant="body2" sx={{ ...primarySx, ...ellipsis(320) }}>{r.returnName || '—'}</Typography> },
    { id: 'frequency', label: 'Frequency', minWidth: 120, render: (r) => <Typography variant="body2">{r.frequencyType || r.frequency || '—'}</Typography> },
    { id: 'due', label: 'Deadline', minWidth: 130, render: (r) => <Typography variant="body2">{r.currentDueDate ? formatDate(r.currentDueDate) : (r.deadlineText || '—')}</Typography> },
    { id: 'responsible', label: 'Responsible', minWidth: 160, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(180)}>{r.responsibleUnit || r.responsiblePerson || '—'}</Typography> },
  ],
  sanctions: [
    { id: 'description', label: 'Violation', minWidth: 320, truncate: true,
      render: (r) => <Typography variant="body2" sx={{ ...primarySx, ...ellipsis(340) }}>{r.description || '—'}</Typography> },
    { id: 'sanctionType', label: 'Penalty Type', minWidth: 140, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(160)}>{r.sanctionType || '—'}</Typography> },
    { id: 'penaltyDetails', label: 'Penalty', minWidth: 240, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(260)}>{r.penaltyDetails || formatNaira(r.sanctionAmountNaira, { perDay: r.sanctionAmountPerDay })}</Typography> },
    { id: 'liableRoles', label: 'Responsible Party', minWidth: 180, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(200)}>{(r.liableRoles || []).join(', ') || '—'}</Typography> },
  ],
};

export default function ActDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('obligations');
  const [pages, setPages] = useState({});
  const [searches, setSearches] = useState({});

  const { data: act, isLoading, error } = useQuery({
    queryKey: ['act', String(id)],
    queryFn: ({ signal }) => api.acts.detail(id, { signal }),
    enabled: !!id,
  });

  // All hooks run before any early return (Rules of Hooks).
  const page = pages[tab] || 0;
  const search = searches[tab] || '';
  const setPage = (p) => setPages((s) => ({ ...s, [tab]: p }));
  const setSearch = (v) => setSearches((s) => ({ ...s, [tab]: v }));

  const { data, isLoading: tabLoading, error: tabError } = useQuery({
    queryKey: ['act-tab', String(id), tab, page, search, act?.canonicalInstrumentId, act?.regulationId, act?.name],
    enabled: !!act,
    placeholderData: (prev) => prev,
    queryFn: ({ signal }) => {
      const base = { page, size: SIZE, q: search || undefined };
      switch (tab) {
        case 'obligations':
          return api.obligations.register({ ...base, instrumentId: act.canonicalInstrumentId }, { signal });
        case 'controls':
          return api.controls.register({ ...base, actId: act.regulationId });
        case 'returns':
          return api.returns.register({ ...base, act: act.name }, { signal });
        case 'sanctions':
          return api.sanctions.list({ ...base, actName: act.name }, { signal });
        default:
          return Promise.resolve({ content: [], totalElements: 0 });
      }
    },
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (error || !act) {
    return (
      <Box>
        <PageHeader title="Act" onBack={() => navigate('/acts')} backLabel="Back to Acts" />
        <Alert severity="error">{error?.message || 'Act not found'}</Alert>
      </Box>
    );
  }

  const tabs = [
    { key: 'obligations', label: 'Obligations', count: act.obligationCount },
    { key: 'controls', label: 'Controls', count: act.controlCount },
    { key: 'returns', label: 'Returns', count: act.returnCount },
    { key: 'sanctions', label: 'Sanctions', count: act.sanctionCount },
  ];

  const coverage = [
    { key: 'obligations', label: 'Obligations', value: act.obligationCount, tone: 'blue', icon: <ScaleIcon />, active: tab === 'obligations' },
    { key: 'controls', label: 'Controls', value: act.controlCount, tone: 'teal', icon: <ClipboardDocumentCheckIcon />, active: tab === 'controls' },
    { key: 'returns', label: 'Returns', value: act.returnCount, tone: 'orange', icon: <DocumentTextIcon />, active: tab === 'returns' },
    { key: 'sanctions', label: 'Sanctions', value: act.sanctionCount, tone: 'red', icon: <BanknotesIcon />, active: tab === 'sanctions' },
  ];

  const columnsByTab = COLUMNS;

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/acts')}
        backLabel="Back to Acts"
        title={act.name}
        status={undefined}
        meta={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {act.abbreviation && (
              <Chip size="small" color="primary" label={act.abbreviation} />
            )}
            {act.regulatorName && (
              <Typography variant="body2" sx={{ color: TL.gray500 }}>{act.regulatorName}</Typography>
            )}
          </Box>
        }
      />

      <CoverageStrip title="Coverage" items={coverage} onTileClick={(k) => setTab(k)} />

      <SectionTabs tabs={tabs} value={tab} onChange={setTab} sx={{ mb: 2 }} />

      <SectionTable
        rows={rows}
        total={total}
        page={page}
        size={SIZE}
        loading={tabLoading}
        error={tabError}
        onPage={setPage}
        rowKey={ROW_KEY[tab]}
        onRowClick={tab === 'obligations' ? (r) => navigate(`/obligations/${r.obligationId}`) : undefined}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: `Search ${tab}...` }}
        emptyMessage={`No ${tab} linked to this act.`}
        columns={columnsByTab[tab]}
      />
    </Box>
  );
}