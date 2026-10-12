import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton, Paper, Snackbar,
} from '@mui/material';
import { Edit, UploadFile, Download, Link as LinkIcon, ArrowBack } from '@mui/icons-material';
import {
  DetailHeader, CoverageStrip, SectionTabs, SectionTable,
  controlColumns, returnColumns, sanctionColumns,
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

const APPLICABILITY_COLOR = { applicable: '#2D7D46', not_applicable: '#C53030', under_review: '#DD6B20' };
const STATUS_COLOR = { applicable: 'success', not_applicable: 'error', under_review: 'warning' };

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
    controls: <Button size="small" variant="contained" startIcon={<Edit sx={{ fontSize: 16 }} />}
      onClick={() => setModal('controls')} sx={{ textTransform: 'none' }}>Link controls</Button>,
    returns: <Button size="small" variant="contained" startIcon={<Edit sx={{ fontSize: 16 }} />}
      onClick={() => setModal('returns')} sx={{ textTransform: 'none' }}>Map return</Button>,
    evidence: <Button size="small" variant="contained" startIcon={<UploadFile sx={{ fontSize: 16 }} />}
      onClick={() => setModal('evidence')} sx={{ textTransform: 'none' }}>Upload</Button>,
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
        render: (r) => <Typography variant="body2" color="text.secondary">{formatDate(r.createdAt)}</Typography> },
    ],
    history: [
      { id: 'classificationVersion', label: 'Version', minWidth: 90,
        render: (r) => <Typography variant="body2">v{r.classificationVersion ?? '—'}</Typography> },
      { id: 'changedByName', label: 'Changed By', minWidth: 180,
        render: (r) => <Typography variant="body2">{r.changedByName || `User #${r.changedByUserId ?? '—'}`}</Typography> },
      { id: 'changedAt', label: 'Date', minWidth: 130,
        render: (r) => <Typography variant="body2" color="text.secondary">{formatDate(r.changedAt)}</Typography> },
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
        {onBack && <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 2 }}>Back</Button>}
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
      {onBack && (
        <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 1.5, textTransform: 'none' }}>Back to Obligations</Button>
      )}

      <DetailHeader
        title={selected.title || 'Untitled obligation'}
        status={selected.applicability}
        statusColor={APPLICABILITY_COLOR[selected.applicability]}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {selected.actName && (
              <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, mr: 0.5 }}>
                <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                {selected.actName}
              </Typography>
            )}
            {chips.map((c) => (
              <Chip key={c} size="small" variant="outlined" label={c}
                sx={{ height: 22, borderRadius: '4px', fontFamily: c === selected.sectionReference ? 'Roboto Mono, monospace' : undefined, fontSize: '0.7rem' }} />
            ))}
            <Chip size="small" label={selected.hasPoints ? 'With Points' : 'Without Points'}
              color={selected.hasPoints ? 'success' : 'default'} sx={{ height: 22, borderRadius: '4px' }} />
          </Box>
        )}
        description={selected.plainEnglishStatement}
      />

      {(selected.description || selected.plainEnglishStatement) && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
          {selected.description && (
            <Box sx={{ mb: selected.plainEnglishStatement ? 2 : 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Source Text
              </Typography>
              <FormattedText text={selected.description} points={selected.points} pointType="verbatim" />
            </Box>
          )}
          {selected.plainEnglishStatement && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Plain English
              </Typography>
              <FormattedText text={selected.plainEnglishStatement} points={selected.points} pointType="interpreted" />
            </Box>
          )}
        </Paper>
      )}

      <Box sx={{ mb: 3, width: '100%' }}>
        <CoverageStrip
          title="Coverage"
          items={[
            { key: 'controls', label: 'Controls', value: counts.controls, color: '#DD6B20' },
            { key: 'returns', label: 'Returns', value: counts.returns, color: '#6B46C1' },
            { key: 'sanctions', label: 'Sanctions', value: counts.sanctions, color: '#C53030' },
            { key: 'evidence', label: 'Evidence', value: counts.evidence, color: '#2B6CB0' },
            { key: 'history', label: 'History', value: counts.history, color: '#2C7A7B' },
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
          <IconButton size="small" title="Download" onClick={() => handleDownload(ev)}><Download fontSize="small" /></IconButton>
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