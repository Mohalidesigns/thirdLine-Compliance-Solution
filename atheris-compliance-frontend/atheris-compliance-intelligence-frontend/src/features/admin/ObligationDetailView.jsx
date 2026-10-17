import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton, Snackbar,
} from '@mui/material';
import {
  DetailHeader, CoverageStrip, SectionTabs, SectionTable, DataCard, StatusBadge, TL,
  controlColumns, returnColumns, sanctionColumns,
  PencilSquareIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, LinkIcon,
  ShieldCheckIcon, CalendarDaysIcon, ScaleIcon, FolderIcon, ClockIcon,
} from 'shared';
import api from '../../services/api';
import RiskAssessmentModal from '../../components/modals/RiskAssessmentModal';
import OwnerModal from '../../components/modals/OwnerModal';
import LinkControlsModal from '../../components/modals/LinkControlsModal';
import MapReturnModal from '../../components/modals/MapReturnModal';
import GapModal from '../../components/modals/GapModal';
import EvidenceUploadModal from '../../components/modals/EvidenceUploadModal';
import FormattedText from '../../components/FormattedText';
import EntityDrillDrawer from './components/detail/EntityDrillDrawer';

const APPLICABILITY_TONE = { applicable: 'green', not_applicable: 'red', under_review: 'amber' };

const MICRO_LABEL_SX = {
  display: 'block', fontSize: '0.625rem', fontWeight: 600, color: TL.gray400,
  textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5,
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABS = [
  { key: 'controls', label: 'Controls' },
  { key: 'returns', label: 'Returns' },
  { key: 'sanctions', label: 'Sanctions' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'history', label: 'History' },
];

/**
 * The obligation detail, laid out like the Act detail: header → clickable coverage strip →
 * tabs → a table per tab. Rows drill into a right drawer (control/return/sanction) instead
 * of navigating. Rendered both as a full page (ObligationExplorerDetailPage) and inside the
 * Act-detail drawer.
 */
export default function ObligationDetailView({ obligationId, onBack }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('controls');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [drill, setDrill] = useState(null);
  const [snack, setSnack] = useState(null);
  const size = 10;

  const { data: selected, isLoading, error } = useQuery({
    queryKey: ['obligation', String(obligationId)],
    queryFn: ({ signal }) => api.platform.obligations.get(obligationId, signal),
    enabled: !!obligationId,
  });

  const notify = (severity, message) => setSnack({ severity, message });
  const onSaved = (message) => async () => {
    await queryClient.invalidateQueries({ queryKey: ['obligation', String(obligationId)] });
    notify('success', message);
  };

  const controls = useMemo(() => selected?.controls || [], [selected]);
  const returns = useMemo(() => selected?.linkedReturns || selected?.returns || [], [selected]);
  const sanctions = useMemo(() => selected?.sanctions || [], [selected]);
  const evidence = useMemo(() => selected?.evidence || [], [selected]);
  const history = useMemo(() => selected?.history || [], [selected]);

  const counts = {
    controls: controls.length, returns: returns.length, sanctions: sanctions.length,
    evidence: evidence.length, history: history.length,
  };

  const switchTab = (k) => { setTab(k); setPage(0); setSearch(''); };

  const rowsByTab = { controls, returns, sanctions, evidence, history };
  const rawRows = rowsByTab[tab] || [];
  const filtered = search
    ? rawRows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rawRows;
  const pageRows = filtered.slice(page * size, (page + 1) * size);

  const actionFor = {
    controls: <Button size="small" variant="contained" startIcon={<PencilSquareIcon size={16} />}
      onClick={() => setModal('controls')}>Link controls</Button>,
    returns: <Button size="small" variant="contained" startIcon={<PencilSquareIcon size={16} />}
      onClick={() => setModal('returns')}>Map return</Button>,
    evidence: <Button size="small" variant="contained" startIcon={<ArrowUpTrayIcon size={16} />}
      onClick={() => setModal('evidence')}>Upload</Button>,
  };

  const columnsByTab = {
    controls: controlColumns({ withAct: false }),
    returns: returnColumns(),
    sanctions: sanctionColumns(),
    evidence: [
      { id: 'originalName', label: 'File', minWidth: 260, truncate: true, maxWidth: 320 },
      { id: 'uploadedByName', label: 'Uploaded By', minWidth: 160,
        render: (r) => <Typography variant="body2">{r.uploadedByName || '—'}</Typography> },
      { id: 'createdAt', label: 'Date', minWidth: 130,
        render: (r) => <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{formatDate(r.createdAt)}</Typography> },
    ],
    history: [
      { id: 'classificationVersion', label: 'Version', minWidth: 90,
        render: (r) => <Typography variant="body2">v{r.classificationVersion ?? '—'}</Typography> },
      { id: 'changedByName', label: 'Changed By', minWidth: 180,
        render: (r) => <Typography variant="body2">{r.changedByName || `User #${r.changedByUserId ?? '—'}`}</Typography> },
      { id: 'changedAt', label: 'Date', minWidth: 130,
        render: (r) => <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{formatDate(r.changedAt)}</Typography> },
      { id: 'applicability', label: 'Applicability', minWidth: 140,
        render: (r) => <Typography variant="body2">{r.applicability || '—'}</Typography> },
    ],
  };

  const drillKind = { controls: 'control', returns: 'return', sanctions: 'sanction' };
  const rowId = { controls: (r) => r.complianceControlId, returns: (r) => r.returnId, sanctions: (r) => r.sanctionId };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error || !selected) {
    return (
      <Box>
        {onBack && <DetailHeader title="Obligation" onBack={onBack} />}
        <Alert severity="error">{error?.message || 'Failed to load obligation detail.'}</Alert>
      </Box>
    );
  }

  const chips = [
    selected.regulatorAbbreviation,
    selected.areaOfFocus,
    selected.sectionReference,
    selected.obligationType,
    selected.recurringDeadlineType,
  ].filter(Boolean);

  return (
    <Box>
      <DetailHeader
        onBack={onBack}
        backLabel="Back to Obligations"
        title={selected.title || 'Untitled obligation'}
        status={selected.applicability}
        statusTone={APPLICABILITY_TONE[selected.applicability]}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {selected.actName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem', mr: 0.5 }}>
                <LinkIcon size={14} />
                {selected.actName}
              </Typography>
            )}
            {chips.map((c) => (
              <Chip key={c} size="small" variant="outlined" label={c}
                sx={c === selected.sectionReference ? { fontFamily: TL.mono, fontSize: '0.7rem' } : undefined} />
            ))}
            <StatusBadge label={selected.hasPoints ? 'With Points' : 'Without Points'} tone={selected.hasPoints ? 'green' : 'gray'} />
          </Box>
        )}
        description={selected.plainEnglishStatement}
      />

      {(selected.description || selected.plainEnglishStatement) && (
        <DataCard title="Obligation Statement" sx={{ mb: 3 }}>
          {selected.description && (
            <Box sx={{ mb: selected.plainEnglishStatement ? 2.5 : 0 }}>
              <Typography component="span" sx={MICRO_LABEL_SX}>
                Source Text
              </Typography>
              <FormattedText text={selected.description} points={selected.points} pointType="verbatim" />
            </Box>
          )}
          {selected.plainEnglishStatement && (
            <Box>
              <Typography component="span" sx={MICRO_LABEL_SX}>
                Plain English
              </Typography>
              <FormattedText text={selected.plainEnglishStatement} points={selected.points} pointType="interpreted" />
            </Box>
          )}
        </DataCard>
      )}

      <Box sx={{ mb: 3, width: '100%' }}>
        <CoverageStrip
          title="Coverage"
          items={[
            { key: 'controls', label: 'Controls', value: counts.controls, tone: 'orange', icon: <ShieldCheckIcon /> },
            { key: 'returns', label: 'Returns', value: counts.returns, tone: 'purple', icon: <CalendarDaysIcon /> },
            { key: 'sanctions', label: 'Sanctions', value: counts.sanctions, tone: 'red', icon: <ScaleIcon /> },
            { key: 'evidence', label: 'Evidence', value: counts.evidence, tone: 'blue', icon: <FolderIcon /> },
            { key: 'history', label: 'History', value: counts.history, tone: 'teal', icon: <ClockIcon /> },
          ]}
          onTileClick={switchTab}
        />
      </Box>

      <SectionTabs
        tabs={TABS.map((t) => ({ ...t, count: counts[t.key] }))}
        value={tab}
        onChange={switchTab}
        sx={{ mb: 2 }}
      />

      <SectionTable
        rows={pageRows}
        total={filtered.length}
        page={page}
        size={size}
        onPage={setPage}
        rowKey={(r) => rowId[tab] ? rowId[tab](r) : `${tab}-${pageRows.indexOf(r)}`}
        onRowClick={drillKind[tab] ? (r) => setDrill({ kind: drillKind[tab], id: rowId[tab](r) }) : undefined}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: `Search ${tab}…`, action: actionFor[tab] }}
        emptyMessage={`No ${tab} recorded for this obligation.`}
        columns={columnsByTab[tab]}
        actions={tab === 'evidence' ? (ev) => (
          <IconButton size="small" title="Download" onClick={() => handleDownload(ev)}><ArrowDownTrayIcon size={16} /></IconButton>
        ) : undefined}
      />

      {/* Edit modals (per-tab actions) */}
      <RiskAssessmentModal open={modal === 'risk'} onClose={() => setModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Risk assessment saved')} onError={notify} />
      <OwnerModal open={modal === 'owner'} onClose={() => setModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Owner saved')} onError={notify} />
      <LinkControlsModal open={modal === 'controls'} onClose={() => setModal(null)}
        obligationId={obligationId} initialIds={(selected?.linkedControls || []).map(c => c.controlId) || []}
        onSaved={onSaved('Controls linked')} onError={notify} />
      <MapReturnModal open={modal === 'returns'} onClose={() => setModal(null)}
        obligationId={obligationId} initialIds={(selected?.linkedReturns || []).map(r => r.returnId) || []}
        onSaved={onSaved('Return mapped')} onError={notify} />
      <GapModal open={modal === 'gap'} onClose={() => setModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Gap updated')} onError={notify} />
      <EvidenceUploadModal open={modal === 'evidence'} onClose={() => setModal(null)}
        obligationId={obligationId} evidence={selected?.evidence || []}
        onSaved={onSaved('Evidence uploaded')} onError={notify} />

      <EntityDrillDrawer kind={drill?.kind} id={drill?.id} onClose={() => setDrill(null)} />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );

  async function handleDownload(ev) {
    try {
      const { blob, name } = await api.platform.evidence.download(ev.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { notify('error', 'Failed to download evidence.'); }
  }
}