import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton, Paper, Snackbar,
} from '@mui/material';
import { Edit, UploadFile, Download, Link as LinkIcon, ArrowBack, Visibility, Gavel } from '@mui/icons-material';
import {
  DetailHeader, CoverageStrip, SectionTabs, SectionTable, EntityDrawer,
  controlColumns, returnColumns,
} from 'shared';
import { api, API_BASE, getToken, pdfErrorMessage } from '../services/api';
import RiskAssessmentModal from '../components/modals/RiskAssessmentModal';
import OwnerModal from '../components/modals/OwnerModal';
import LinkControlsModal from '../components/modals/LinkControlsModal';
import LinkSanctionsModal from '../components/modals/LinkSanctionsModal';
import MapReturnModal from '../components/modals/MapReturnModal';
import GapModal from '../components/modals/GapModal';
import EvidenceUploadModal from '../components/modals/EvidenceUploadModal';
import FormattedText from '../components/FormattedText';
import { Field, FieldGrid } from '../components/detailKit';

const APPLICABILITY_COLOR = { applicable: '#2D7D46', not_applicable: '#C53030', under_review: '#DD6B20' };

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABS = [
  { key: 'controls', label: 'Controls' },
  { key: 'returns', label: 'Returns' },
  { key: 'sanctions', label: 'Sanctions' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'history', label: 'History' },
];

const SANCTION_TAB_COLUMNS = [
  { id: 'penaltyDetails', label: 'Penalty', minWidth: 340, truncate: true, maxWidth: 520,
    render: (r) => <Typography variant="body2" sx={{ maxWidth: 520, overflow: 'hidden',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.penaltyDetails || r.sanctionType || '—'}</Typography> },
];

const EVIDENCE_COLUMNS = [
  { id: 'originalName', label: 'File', minWidth: 260, truncate: true, maxWidth: 320 },
  { id: 'uploadedByName', label: 'Uploaded By', minWidth: 160,
    render: (r) => <Typography variant="body2">{r.uploadedByName || '—'}</Typography> },
  { id: 'createdAt', label: 'Date', minWidth: 130,
    render: (r) => <Typography variant="body2" color="text.secondary">{formatDate(r.createdAt)}</Typography> },
];

const HISTORY_COLUMNS = [
  { id: 'classificationVersion', label: 'Version', minWidth: 90,
    render: (r) => <Typography variant="body2">v{r.classificationVersion ?? '—'}</Typography> },
  { id: 'changedByName', label: 'Changed By', minWidth: 180,
    render: (r) => <Typography variant="body2">{r.changedByName || `User #${r.changedByUserId ?? '—'}`}</Typography> },
  { id: 'changedAt', label: 'Date', minWidth: 130,
    render: (r) => <Typography variant="body2" color="text.secondary">{formatDate(r.changedAt)}</Typography> },
  { id: 'applicability', label: 'Applicability', minWidth: 140,
    render: (r) => <Typography variant="body2">{r.applicability || '—'}</Typography> },
];

export default function ObligationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const obligationId = Number(id);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('controls');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [drill, setDrill] = useState(null);
  const [snack, setSnack] = useState(null);
  const size = 10;

  const { data: selected, isLoading, error } = useQuery({
    queryKey: ['obligations', 'detail', String(id)],
    queryFn: ({ signal }) => api.obligations.obligationDetail(obligationId, signal),
    enabled: !!obligationId,
  });

  const notify = (severity, message) => setSnack({ severity, message });
  const onSaved = (message) => async () => {
    await queryClient.invalidateQueries({ queryKey: ['obligations'] });
    notify('success', message);
  };

  const controls = useMemo(() => selected?.linkedControls || [], [selected]);
  const returns = useMemo(() => selected?.linkedReturns || [], [selected]);
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
      onClick={() => setActiveModal('controls')} sx={{ textTransform: 'none' }}>Link controls</Button>,
    returns: <Button size="small" variant="contained" startIcon={<Edit sx={{ fontSize: 16 }} />}
      onClick={() => setActiveModal('returns')} sx={{ textTransform: 'none' }}>Map return</Button>,
    sanctions: <Button size="small" variant="contained" startIcon={<Edit sx={{ fontSize: 16 }} />}
      onClick={() => setActiveModal('sanctions')} sx={{ textTransform: 'none' }}>Link sanctions</Button>,
    evidence: <Button size="small" variant="contained" startIcon={<UploadFile sx={{ fontSize: 16 }} />}
      onClick={() => setActiveModal('evidence')} sx={{ textTransform: 'none' }}>Upload</Button>,
  };

  const columnsByTab = {
    controls: controlColumns({ withAct: false }),
    returns: returnColumns(),
    sanctions: SANCTION_TAB_COLUMNS,
    evidence: EVIDENCE_COLUMNS,
    history: HISTORY_COLUMNS,
  };

  const drillKind = { controls: 'control', returns: 'return', sanctions: 'sanction' };
  const rowId = { controls: (r) => r.controlId, returns: (r) => r.returnId, sanctions: (r) => r.sanctionId };

  async function handleDownloadEvidence(ev) {
    try {
      const { blob, name } = await api.evidence.download(ev.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { notify('error', 'Failed to download evidence.'); }
  }

  async function handleViewPdf() {
    const instrumentId = selected?.instrumentId;
    if (!instrumentId) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${instrumentId}/pdf`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      });
      if (!res.ok) throw new Error(await pdfErrorMessage(res));
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { notify('error', e.message || 'Failed to load PDF.'); }
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error || !selected) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/obligations')} sx={{ mb: 2, textTransform: 'none' }}>
          Back to Obligations
        </Button>
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
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/obligations')} sx={{ mb: 1.5, textTransform: 'none' }}>
        Back to Obligations
      </Button>

      <DetailHeader
        title={selected.title || selected.name || 'Untitled obligation'}
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
          </Box>
        )}
        description={selected.plainEnglishStatement}
        right={(
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button size="small" variant="outlined" startIcon={<Edit sx={{ fontSize: 16 }} />}
              onClick={() => setActiveModal('risk')} sx={{ textTransform: 'none' }}>Assess Risk</Button>
            <Button size="small" variant="outlined" startIcon={<Edit sx={{ fontSize: 16 }} />}
              onClick={() => setActiveModal('owner')} sx={{ textTransform: 'none' }}>Assign Owner</Button>
            <Button size="small" variant="outlined" startIcon={<Gavel sx={{ fontSize: 16 }} />}
              onClick={() => setActiveModal('gap')} sx={{ textTransform: 'none' }}>Gap</Button>
            <Button size="small" variant="outlined" startIcon={<Visibility sx={{ fontSize: 16 }} />}
              onClick={handleViewPdf} sx={{ textTransform: 'none' }}>PDF</Button>
          </Box>
        )}
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
        onRowClick={drillKind[tab] ? (r) => setDrill({ kind: drillKind[tab], row: r }) : undefined}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: `Search ${tab}…`, action: actionFor[tab] }}
        emptyMessage={`No ${tab} recorded for this obligation.`}
        columns={columnsByTab[tab]}
        actions={tab === 'evidence' ? (ev) => (
          <IconButton size="small" title="Download" onClick={() => handleDownloadEvidence(ev)}><Download fontSize="small" /></IconButton>
        ) : undefined}
      />

      <RiskAssessmentModal open={activeModal === 'risk'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Risk assessment saved')} onError={notify} />
      <OwnerModal open={activeModal === 'owner'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Owner saved')} onError={notify} />
      <LinkControlsModal open={activeModal === 'controls'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={controls.map((c) => c.controlId) || []}
        onSaved={onSaved('Controls linked')} onError={notify} />
      <LinkSanctionsModal open={activeModal === 'sanctions'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={sanctions.map((s) => s.sanctionId) || []}
        onSaved={onSaved('Sanctions linked')} onError={notify} />
      <MapReturnModal open={activeModal === 'returns'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={returns.map((r) => r.returnId) || []}
        onSaved={onSaved('Return mapped')} onError={notify} />
      <GapModal open={activeModal === 'gap'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Gap updated')} onError={notify} />
      <EvidenceUploadModal open={activeModal === 'evidence'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} evidence={evidence}
        onSaved={onSaved('Evidence uploaded')} onError={notify} />

      <EntityDrawer
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drillTitle(drill)}
        subtitle={drillSubtitle(drill)}
        width={560}
      >
        {drill && <DrillBody kind={drill.kind} row={drill.row} />}
      </EntityDrawer>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function drillTitle(drill) {
  if (!drill) return '';
  const r = drill.row;
  if (drill.kind === 'control') return r.controlSummary || r.name || 'Control';
  if (drill.kind === 'return') return r.title || 'Return';
  if (drill.kind === 'sanction') return r.penaltyDetails || r.sanctionType || 'Sanction';
  return 'Details';
}

function drillSubtitle(drill) {
  if (!drill) return '';
  const r = drill.row;
  if (drill.kind === 'control') return r.theme || r.complianceArea || null;
  if (drill.kind === 'return') return r.frequencyType || r.frequency || null;
  return null;
}

function DrillBody({ kind, row }) {
  if (kind === 'control') {
    return (
      <FieldGrid min={150}>
        <Field label="Summary" value={row.controlSummary || row.name} />
        <Field label="Theme / Area" value={row.theme || row.complianceArea} />
        <Field label="Type" value={row.controlType} />
        <Field label="Risk" value={row.riskLevel || row.residualRisk || row.inherentRisk} />
        <Field label="Owner" value={row.controlOwnerName} />
        <Field label="Status" value={row.status} />
      </FieldGrid>
    );
  }
  if (kind === 'return') {
    return (
      <FieldGrid min={150}>
        <Field label="Return" value={row.title} />
        <Field label="Frequency" value={row.frequencyType || row.frequency} />
        <Field label="Deadline" value={row.deadline} />
        <Field label="Responsible Unit" value={row.responsibleUnit} />
        <Field label="Responsible Person" value={row.responsiblePerson} />
        <Field label="Filing Regulator" value={row.filingRegulator} />
      </FieldGrid>
    );
  }
  if (kind === 'sanction') {
    return (
      <>
        <FieldGrid min={150}>
          <Field label="Penalty" value={row.penaltyDetails || row.sanctionType} />
          <Field label="Source Section" value={row.sourceSectionReference} />
          <Field label="Responsible Party" value={(row.liableRoles || []).join(', ')} />
        </FieldGrid>
        {row.riskExplanation && (
          <Box sx={{ mt: 2 }}>
            <Field label="Risk Explanation" value={row.riskExplanation} />
          </Box>
        )}
      </>
    );
  }
  return null;
}