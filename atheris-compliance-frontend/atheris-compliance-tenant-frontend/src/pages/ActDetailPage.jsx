import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Button, Chip, CircularProgress, Alert } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import {
  DetailHeader, CoverageStrip, SectionTabs, SectionTable,
  formatDate, formatNaira, riskChip,
} from 'shared';
import { api } from '../services/api';

const SIZE = 10;

const ellipsis = (w) => ({ maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

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
        <Typography variant="body2" sx={{ fontWeight: 600, ...ellipsis(360) }}>{r.title || r.name || '—'}</Typography>
        {r.plainEnglishStatement && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ...ellipsis(360) }}>{r.plainEnglishStatement}</Typography>
        )}
      </Box>) },
    { id: 'sectionReference', label: 'Section', minWidth: 110, truncate: true,
      render: (r) => <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>{r.sectionReference || '—'}</Typography> },
    { id: 'risk', label: 'Risk', minWidth: 100, render: (r) => riskChip(r.tenantRiskRating || r.inherentRiskRating) },
    { id: 'controlCount', label: 'Controls', minWidth: 90, render: (r) => <Typography variant="body2">{r.controlCount ?? 0}</Typography> },
    { id: 'status', label: 'Status', minWidth: 110, render: (r) => <Typography variant="body2">{r.status || '—'}</Typography> },
  ],
  controls: [
    { id: 'controlNumber', label: 'Control', minWidth: 300, truncate: true, render: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, ...ellipsis(320) }}>{r.name || r.controlSummary || '—'}</Typography>
      </Box>) },
    { id: 'theme', label: 'Theme / Area', minWidth: 180, truncate: true,
      render: (r) => <Typography variant="body2" color="text.secondary" sx={ellipsis(200)}>{r.theme || r.complianceArea || '—'}</Typography> },
    { id: 'risk', label: 'Risk', minWidth: 100, render: (r) => riskChip(r.residualRisk || r.residualRiskRating) },
    { id: 'status', label: 'Status', minWidth: 110, render: (r) => <Typography variant="body2">{r.status || '—'}</Typography> },
  ],
  returns: [
    { id: 'returnName', label: 'Return', minWidth: 300, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(320)}>{r.returnName || '—'}</Typography> },
    { id: 'frequency', label: 'Frequency', minWidth: 120, render: (r) => <Typography variant="body2">{r.frequencyType || r.frequency || '—'}</Typography> },
    { id: 'due', label: 'Deadline', minWidth: 130, render: (r) => <Typography variant="body2">{r.currentDueDate ? formatDate(r.currentDueDate) : (r.deadlineText || '—')}</Typography> },
    { id: 'responsible', label: 'Responsible', minWidth: 160, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(180)}>{r.responsibleUnit || r.responsiblePerson || '—'}</Typography> },
  ],
  sanctions: [
    { id: 'description', label: 'Violation', minWidth: 320, truncate: true,
      render: (r) => <Typography variant="body2" sx={ellipsis(340)}>{r.description || '—'}</Typography> },
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
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/acts')} sx={{ mb: 2 }}>Back to Acts</Button>
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
    { key: 'obligations', label: 'Obligations', value: act.obligationCount, color: '#2D7D46' },
    { key: 'controls', label: 'Controls', value: act.controlCount, color: '#DD6B20' },
    { key: 'returns', label: 'Returns', value: act.returnCount, color: '#6B46C1' },
    { key: 'sanctions', label: 'Sanctions', value: act.sanctionCount, color: '#C53030' },
  ];

  const columnsByTab = COLUMNS;

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;

  return (
    <Box>
      <DetailHeader
        onBack={() => navigate('/acts')}
        backLabel="Back to Acts"
        backIcon={<ArrowBack />}
        title={act.name}
        status={undefined}
        meta={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {act.abbreviation && (
              <Chip size="small" label={act.abbreviation}
                sx={{ height: 22, borderRadius: '4px', fontWeight: 600, bgcolor: '#1A365D', color: '#fff' }} />
            )}
            {act.regulatorName && (
              <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600 }}>{act.regulatorName}</Typography>
            )}
          </Box>
        }
      />

      <Box sx={{ mb: 3, width: '100%' }}>
        <CoverageStrip title="Coverage" items={coverage} onTileClick={(k) => setTab(k)} />
      </Box>

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