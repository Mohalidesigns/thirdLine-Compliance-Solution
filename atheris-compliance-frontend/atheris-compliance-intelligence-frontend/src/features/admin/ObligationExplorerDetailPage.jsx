import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Paper, Snackbar, Tooltip, TextField,
} from '@mui/material';
import {
  DetailHeader, DataCard, CardLink, EntityDrawer, RiskBadge, StateBadge, StatusBadge, TL,
  EyeIcon, ArrowDownTrayIcon, PencilSquareIcon, ArrowUpTrayIcon, ScaleIcon,
  MagnifyingGlassIcon, DocumentTextIcon, ExclamationTriangleIcon,
} from 'shared';
import api from '../../services/api';
import RiskAssessmentModal from '../../components/modals/RiskAssessmentModal';
import OwnerModal from '../../components/modals/OwnerModal';
import LinkControlsModal from '../../components/modals/LinkControlsModal';
import MapReturnModal from '../../components/modals/MapReturnModal';
import GapModal from '../../components/modals/GapModal';
import EvidenceUploadModal from '../../components/modals/EvidenceUploadModal';
import FormattedText from '../../components/FormattedText';
import { Field, FieldGrid } from './components/detail/detailKit';

const VISIBLE_CHIP_COUNT = 5;

function riskChip(rating) {
  return <RiskBadge value={rating} />;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNaira(a) {
  if (a == null) return null;
  return '₦' + Number(a).toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

const MICRO_LABEL_SX = {
  display: 'block', fontSize: '0.625rem', fontWeight: 600, color: TL.gray400,
  textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5,
};

const EMPTY_SX = { fontSize: '0.875rem', color: TL.gray500 };

const DRAWER_TITLE = {
  controls: 'Linked Controls', returns: 'Returns Required', sanctions: 'Regulatory Sanctions',
  evidence: 'Evidence', history: 'Version History',
};

function ChipList({ items, renderChip, visibleCount = VISIBLE_CHIP_COUNT }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    return items.filter(item => {
      const label = typeof item === 'string' ? item : (item.name || item.label || '');
      return label.toLowerCase().includes(search.toLowerCase());
    });
  }, [items, search]);

  const showAll = expanded || search || filtered.length <= visibleCount;
  const visible = showAll ? filtered : filtered.slice(0, visibleCount);
  const hiddenCount = filtered.length - visible.length;

  if (!items || items.length === 0) return null;

  return (
    <Box>
      {items.length > 3 && (
        <TextField
          size="small" placeholder="Search..." value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <MagnifyingGlassIcon size={16} sx={{ mr: 1, color: TL.gray400 }} /> } }}
          sx={{ mb: 1, minWidth: 200 }}
        />
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {visible.map((item, i) => renderChip(item, i))}
        {!showAll && hiddenCount > 0 && (
          <Chip size="small" label={`+${hiddenCount} more`} onClick={() => setExpanded(true)} />
        )}
        {showAll && items.length > visibleCount && !search && (
          <Chip size="small" label="Show less" onClick={() => setExpanded(false)} />
        )}
      </Box>
    </Box>
  );
}

function controlItemStyle(i, total) {
  return {
    py: 1.25,
    px: 1,
    mx: -1,
    borderRadius: '8px',
    borderBottom: i < Math.min(total, 5) - 1 ? `1px solid ${TL.gray100}` : 'none',
    cursor: 'pointer',
    '&:hover': { bgcolor: TL.gray50 },
  };
}

/** Primary line of a preview list item (navy, medium weight). */
const ITEM_TITLE_SX = { fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' };
/** Secondary caption of a preview list item. */
const ITEM_CAPTION_SX = { fontSize: '0.75rem', color: TL.gray500, lineHeight: 1.6 };

export default function ObligationExplorerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const obligationId = Number(id);

  const queryClient = useQueryClient();
  const { data: selected, isLoading, error } = useQuery({
    queryKey: ['obligation', obligationId],
    queryFn: ({ signal }) => api.platform.obligations.get(obligationId, signal),
    enabled: !!obligationId,
  });

  const [activeModal, setActiveModal] = useState(null);
  const [drawerSection, setDrawerSection] = useState(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerSingleId, setDrawerSingleId] = useState(null);
  const [drawerControlDetail, setDrawerControlDetail] = useState(null);
  const [snack, setSnack] = useState(null);

  const notify = (severity, message) => setSnack({ severity, message });

  function onSaved(message) {
    return async () => {
      await queryClient.invalidateQueries({ queryKey: ['obligation', obligationId] });
      notify('success', message);
    };
  }

  async function handleDownloadEvidence(ev) {
    try {
      const { blob, name } = await api.platform.evidence.download(ev.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { notify('error', 'Failed to download evidence.'); }
  }

  async function handleViewPdf() {
    if (!selected?.instrumentId) return;
    try {
      const blob = await api.platform.obligations.pdf(obligationId);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { notify('error', e.message || 'Failed to load PDF.'); }
  }

  const actionEdit = (modal, label = 'Edit') => (
    <Button size="small" variant="contained" onClick={() => setActiveModal(modal)}
      startIcon={<PencilSquareIcon size={16} />}>
      {label}
    </Button>
  );

  const openDrawer = (section, singleId = null) => {
    setDrawerSection(section); setDrawerSearch(''); setDrawerSingleId(singleId);
    if (section === 'controls' && singleId) {
      setDrawerControlDetail(null);
      api.platform.controls.detail(singleId).then(d => setDrawerControlDetail(d)).catch(() => {});
    } else {
      setDrawerControlDetail(null);
    }
  };

  const drawerFilteredItems = useMemo(() => {
    if (!selected || !drawerSection) return [];
    let items = [];
    if (drawerSection === 'controls') items = selected.linkedControls || [];
    else if (drawerSection === 'returns') items = selected.linkedReturns || [];
    else if (drawerSection === 'sanctions') items = selected.sanctions || [];
    else if (drawerSection === 'evidence') items = selected.evidence || [];
    else if (drawerSection === 'history') items = selected.history || [];
    if (drawerSingleId && drawerSection === 'controls') {
      items = items.filter(c => c.controlId === drawerSingleId);
    }
    if (!drawerSearch) return items;
    const q = drawerSearch.toLowerCase();
    return items.filter(item => JSON.stringify(item).toLowerCase().includes(q));
  }, [selected, drawerSection, drawerSearch, drawerSingleId]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error && !selected) return (
    <Box>
      <DetailHeader band title="Obligation" onBack={() => navigate('/admin/obligations')} backLabel="Back to Obligations" />
      <Alert severity="error">{error?.message || 'Failed to load obligation detail.'}</Alert>
    </Box>
  );

  const linkedControls = selected?.linkedControls || [];
  const linkedReturns = selected?.linkedReturns || [];
  const sanctionList = selected?.sanctions || [];
  const evidenceList = selected?.evidence || [];

  return (
    <Box>
      {/* Header */}
      <DetailHeader
        band
        onBack={() => navigate('/admin/obligations')}
        backLabel="Back to Obligations"
        title={selected?.title || 'Untitled obligation'}
        description={selected?.instrumentTitle}
        meta={selected ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {riskChip(selected.riskRating || selected.inherentRiskRating)}
            {selected.regulatorAbbreviation && <Chip size="small" label={selected.regulatorAbbreviation} />}
            {selected.areaOfFocus && <Chip size="small" label={selected.areaOfFocus} />}
            {selected.recurringDeadlineType && <Chip size="small" label={selected.recurringDeadlineType} variant="outlined" />}
            <StateBadge value={selected.status || 'unknown'} />
            <StatusBadge label={selected.hasPoints ? 'With Points' : 'Without Points'} tone={selected.hasPoints ? 'green' : 'gray'} />
          </Box>
        ) : null}
        right={(
          <Button variant="outlined" onClick={handleViewPdf} startIcon={<EyeIcon size={16} />}>PDF</Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error?.message}</Alert>}

      {selected && (
        <Box sx={{ maxWidth: 900 }}>
          {/* Metadata */}
          <DataCard title="Details" sx={{ mb: 3 }}>
            <FieldGrid min={180}>
              {[
                ['Applicability', selected.applicability ? <StateBadge key="a" value={selected.applicability} /> : '-'],
                ['Owner', selected.controlOwner || selected.assignedOwnerName || 'Unassigned'],
                ['Department', selected.assignedDepartment || '-'],
                ['Section', selected.sectionReference || '-'],
                ['Obligation Type', selected.obligationType || '-'],
                ['Effective Date', selected.effectiveDate ? formatDate(selected.effectiveDate) : '-'],
                ['Classified By', selected.classifiedByName || '-'],
                ['Classified Date', selected.classifiedAt ? formatDate(selected.classifiedAt) : '-'],
              ].filter(([, val]) => val && val !== '-').map(([label, value]) => (
                typeof value === 'string'
                  ? <Field key={label} label={label} value={value} mono={label === 'Section'} />
                  : <Field key={label} label={label}>{value}</Field>
              ))}
            </FieldGrid>
            {selected.applicabilityReasoning && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${TL.gray100}` }}>
                <Typography component="span" sx={MICRO_LABEL_SX}>Reasoning</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray600 }}>{selected.applicabilityReasoning}</Typography>
              </Box>
            )}
          </DataCard>

          {/* Obligation Statement — verbatim + interpreted */}
          {(selected.description || selected.plainEnglishStatement) && (
            <DataCard title="Obligation Statement" sx={{ mb: 3 }}>
              {selected.description && (
                <Box sx={{ mb: selected.plainEnglishStatement ? 2.5 : 0 }}>
                  <Typography component="span" sx={MICRO_LABEL_SX}>Source Text</Typography>
                  <FormattedText text={selected.description} points={selected.points} pointType="verbatim" />
                </Box>
              )}
              {selected.plainEnglishStatement && (
                <Box>
                  <Typography component="span" sx={MICRO_LABEL_SX}>Plain English</Typography>
                  <FormattedText text={selected.plainEnglishStatement} points={selected.points} pointType="interpreted" />
                </Box>
              )}
            </DataCard>
          )}

          {/* Controls — name-only list */}
          <DataCard
            title={`Linked Controls (${linkedControls.length})`}
            sx={{ mb: 3 }}
            actions={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {linkedControls.length > 0 && <CardLink onClick={() => openDrawer('controls')}>View all</CardLink>}
                <Button size="small" variant="contained" onClick={() => setActiveModal('controls')}
                  startIcon={<PencilSquareIcon size={16} />}>Link controls</Button>
              </Box>
            )}
          >
            {linkedControls.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {linkedControls.slice(0, 5).map((c, i) => (
                  <Box key={c.controlId || i}
                    onClick={() => openDrawer('controls', c.controlId)}
                    sx={controlItemStyle(i, Math.min(linkedControls.length, 5))}>
                    <Typography sx={ITEM_TITLE_SX}>
                      {(c.name || 'Untitled').replace(/^[\s\-"]+/, '')}
                    </Typography>
                    {c.description && (
                      <Typography sx={ITEM_CAPTION_SX}>
                        {c.description.replace(/^[\s\-"]+/, '')}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                      {c.testFrequency && <Chip size="small" label={c.testFrequency} />}
                      {c.controlOwnerName && <Chip size="small" label={c.controlOwnerName} variant="outlined" />}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : <Typography sx={EMPTY_SX}>No controls linked</Typography>}
          </DataCard>

          {/* Returns — chip preview */}
          <DataCard
            title={`Return Required (${linkedReturns.length})`}
            sx={{ mb: 3 }}
            actions={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {linkedReturns.length > 0 && <CardLink onClick={() => openDrawer('returns')}>View all</CardLink>}
                <Button size="small" variant="contained" onClick={() => setActiveModal('returns')}
                  startIcon={<PencilSquareIcon size={16} />}>Map return</Button>
              </Box>
            )}
          >
            {linkedReturns.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {linkedReturns.slice(0, 5).map((r, i) => (
                  <Box key={r.returnId || i}
                    onClick={() => openDrawer('returns')}
                    sx={controlItemStyle(i, Math.min(linkedReturns.length, 5))}>
                    <Typography sx={ITEM_TITLE_SX}>
                      {(r.returnName || 'Untitled').replace(/^[\s\-"]+/, '')}
                    </Typography>
                    {r.frequency && <Typography sx={ITEM_CAPTION_SX}>{r.frequency}</Typography>}
                  </Box>
                ))}
                {linkedReturns.length > 5 && (
                  <Typography sx={{ ...ITEM_CAPTION_SX, mt: 1 }}>
                    +{linkedReturns.length - 5} more — click "View all" for details
                  </Typography>
                )}
              </Box>
            ) : <Typography sx={EMPTY_SX}>None mapped</Typography>}
          </DataCard>

          {/* Sanctions — compact preview */}
          <DataCard
            title={`Regulatory Sanctions (${sanctionList.length})`}
            sx={{ mb: 3 }}
            actions={sanctionList.length > 0 ? <CardLink onClick={() => openDrawer('sanctions')}>View all</CardLink> : null}
          >
            {sanctionList.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {sanctionList.slice(0, 5).map((s, i) => (
                  <Box key={i}
                    onClick={() => openDrawer('sanctions')}
                    sx={controlItemStyle(i, Math.min(sanctionList.length, 5))}>
                    <Typography sx={ITEM_TITLE_SX}>
                      {(s.sanctionType || 'Sanction').replace(/^[\s\-"]+/, '')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
                      {(s.sanctionAmountNaira != null && s.sanctionAmountNaira > 0) && (
                        <Typography sx={{ ...ITEM_CAPTION_SX, color: TL.error, fontWeight: 600 }}>
                          {formatNaira(s.sanctionAmountNaira)}
                        </Typography>
                      )}
                      {s.actName && <Typography sx={ITEM_CAPTION_SX}>{s.actName}</Typography>}
                    </Box>
                  </Box>
                ))}
                {sanctionList.length > 5 && (
                  <Typography sx={{ ...ITEM_CAPTION_SX, mt: 1 }}>
                    +{sanctionList.length - 5} more — click "View all" for details
                  </Typography>
                )}
              </Box>
            ) : <Typography sx={EMPTY_SX}>No sanctions recorded</Typography>}
          </DataCard>

          {/* Gap */}
          <DataCard title="Control Gap" sx={{ mb: 3 }} actions={actionEdit('gap', 'Identified Gaps')}>
            {selected.hasGap ? (
              <Alert severity="warning" icon={<ExclamationTriangleIcon size={20} />}>
                <strong>Gap identified:</strong> {selected.gapDescription || 'No control covers this obligation'}
              </Alert>
            ) : (
              <Typography sx={EMPTY_SX}>No gap identified — controls cover this obligation.</Typography>
            )}
          </DataCard>

          {/* Evidence — compact preview */}
          <DataCard
            title={`Evidence (${evidenceList.length})`}
            sx={{ mb: 3 }}
            actions={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {evidenceList.length > 0 && <CardLink onClick={() => openDrawer('evidence')}>View all</CardLink>}
                <Button size="small" variant="contained" onClick={() => setActiveModal('evidence')}
                  startIcon={<ArrowUpTrayIcon size={16} />}>Upload</Button>
              </Box>
            )}
          >
            {evidenceList.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {evidenceList.slice(0, 2).map(ev => (
                  <Box key={ev.fileId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <DocumentTextIcon size={16} sx={{ color: TL.gray400, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }} noWrap>{ev.originalName}</Typography>
                    </Box>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownloadEvidence(ev)}><ArrowDownTrayIcon size={16} /></IconButton>
                    </Tooltip>
                  </Box>
                ))}
                {evidenceList.length > 2 && (
                  <Typography sx={ITEM_CAPTION_SX}>
                    +{evidenceList.length - 2} more — click "View all" for full list
                  </Typography>
                )}
              </Box>
            ) : <Typography sx={EMPTY_SX}>No evidence uploaded</Typography>}
          </DataCard>

          {/* History — button only */}
          <DataCard
            title="Version History"
            sx={{ mb: 3 }}
            actions={<CardLink onClick={() => openDrawer('history')}>View history</CardLink>}
          >
            <Typography sx={EMPTY_SX}>
              {(selected.history || []).length ? `${(selected.history || []).length} version(s) recorded` : 'No version history recorded.'}
            </Typography>
          </DataCard>
        </Box>
      )}

      {/* Modals */}
      <RiskAssessmentModal open={activeModal === 'risk'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Risk assessment saved')} onError={notify} />
      <OwnerModal open={activeModal === 'owner'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Owner saved')} onError={notify} />
      <LinkControlsModal open={activeModal === 'controls'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={(selected?.linkedControls || []).map(c => c.controlId) || []}
        onSaved={onSaved('Controls linked')} onError={notify} />
      <MapReturnModal open={activeModal === 'returns'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={(selected?.linkedReturns || []).map(r => r.returnId) || []}
        onSaved={onSaved('Return mapped')} onError={notify} />
      <GapModal open={activeModal === 'gap'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Gap updated')} onError={notify} />
      <EvidenceUploadModal open={activeModal === 'evidence'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} evidence={selected?.evidence || []}
        onSaved={onSaved('Evidence uploaded')} onError={notify} />

      {/* Single multi-section drawer */}
      <EntityDrawer
        open={!!drawerSection}
        onClose={() => setDrawerSection(null)}
        title={drawerSection ? DRAWER_TITLE[drawerSection] : ''}
        subtitle={selected?.title}
        width={480}
      >
        {drawerSection && (
          <Box>
            {['controls', 'returns', 'evidence'].includes(drawerSection) && drawerFilteredItems.length > 3 && !drawerSingleId && (
              <TextField size="small" placeholder="Search..." value={drawerSearch}
                onChange={e => setDrawerSearch(e.target.value)} fullWidth
                slotProps={{ input: { startAdornment: <MagnifyingGlassIcon size={18} sx={{ mr: 1, color: TL.gray400 }} /> } }}
                sx={{ mb: 2, bgcolor: '#FFFFFF' }} />
            )}

            {/* Controls drawer — full detail when single, list when multiple */}
            {drawerSection === 'controls' && drawerSingleId && drawerControlDetail ? (
              <DataCard>
                {drawerControlDetail.controlNumber && (
                  <Typography sx={{ display: 'block', mb: 0.5, fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{drawerControlDetail.controlNumber}</Typography>
                )}
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: TL.textPrimary, mb: 1.5 }}>{drawerControlDetail.name || 'Untitled Control'}</Typography>
                {[
                  ['Description', drawerControlDetail.description],
                  ['What It Does', drawerControlDetail.whatItDoes],
                  ['How Tested', drawerControlDetail.howTested],
                  ['Regulatory Requirement', drawerControlDetail.regulatoryRequirement],
                  ['Compliance Area', drawerControlDetail.complianceArea],
                  ['Monitoring Activity', drawerControlDetail.monitoringActivity],
                  ['Effectiveness Measure', drawerControlDetail.controlEffectivenessMeasure],
                ].filter(([, v]) => v).map(([label, v]) => (
                  <Box key={label} sx={{ mb: 1.5 }}>
                    <Typography component="span" sx={MICRO_LABEL_SX}>{label}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{v}</Typography>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                  {drawerControlDetail.controlType && <Chip size="small" label={drawerControlDetail.controlType} />}
                  {drawerControlDetail.theme && <Chip size="small" label={drawerControlDetail.theme} variant="outlined" />}
                  {drawerControlDetail.testFrequency && <Chip size="small" label={drawerControlDetail.testFrequency} />}
                  {drawerControlDetail.status && <StateBadge value={drawerControlDetail.status} />}
                </Box>
                <Box sx={{ mb: 1.5 }}>
                  <FieldGrid min={140} gap={2}>
                    {drawerControlDetail.controlOwnerName && <Field label="Owner" value={drawerControlDetail.controlOwnerName} />}
                    {drawerControlDetail.inherentRisk && <Field label="Inherent Risk" value={drawerControlDetail.inherentRisk} />}
                    {drawerControlDetail.residualRiskRating && <Field label="Residual Risk" value={drawerControlDetail.residualRiskRating} />}
                    {drawerControlDetail.actName && <Field label="Act/Regulation" value={drawerControlDetail.actName} />}
                    {drawerControlDetail.dueDate && <Field label="Due Date" value={drawerControlDetail.dueDate} />}
                    {drawerControlDetail.nextTestDueDate && <Field label="Next Test Due" value={drawerControlDetail.nextTestDueDate} />}
                  </FieldGrid>
                </Box>
                {drawerControlDetail.linkedObligations?.length > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography component="span" sx={MICRO_LABEL_SX}>Linked Obligations</Typography>
                    {drawerControlDetail.linkedObligations.map((o, i) => (
                      <Typography key={i} sx={{ mt: 0.5, fontSize: '0.875rem', color: TL.gray700 }}>{o.name || o.title || o.description || `Obligation #${o.obligationId}`}</Typography>
                    ))}
                  </Box>
                )}
                {drawerControlDetail.testHistory?.length > 0 && (
                  <Box>
                    <Typography component="span" sx={MICRO_LABEL_SX}>Test History</Typography>
                    {drawerControlDetail.testHistory.slice(0, 5).map((t, i) => (
                      <Box key={i} sx={{ py: 1, borderBottom: `1px solid ${TL.gray100}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray700 }}>{t.testDate}</Typography>
                          <StatusBadge label={t.result} tone={t.result === 'Pass' ? 'green' : t.result === 'Fail' ? 'red' : 'gray'} />
                        </Box>
                        {t.resultDescription && <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>{t.resultDescription}</Typography>}
                      </Box>
                    ))}
                  </Box>
                )}
              </DataCard>
            ) : drawerSection === 'controls' && drawerFilteredItems.map((c, i) => (
              <Paper key={c.controlId || i}
                onClick={() => openDrawer('controls', c.controlId)}
                sx={{ p: 2, mb: 1.5, cursor: 'pointer', '&:hover': { borderColor: TL.gray200 } }}>
                <Typography sx={ITEM_TITLE_SX}>{c.name || 'Untitled'}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                  {c.controlType && <Chip size="small" label={c.controlType} />}
                  {c.controlOwnerName && <Chip size="small" label={c.controlOwnerName} variant="outlined" />}
                  {c.status && <StateBadge value={c.status} />}
                </Box>
              </Paper>
            ))}

            {/* Returns drawer */}
            {drawerSection === 'returns' && drawerFilteredItems.map((r, i) => (
              <Paper key={r.returnId || i} sx={{ p: 2, mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>{r.returnName}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
                  {r.frequency && <Chip size="small" label={r.frequency} />}
                  {r.filingRegulator && <Chip size="small" label={r.filingRegulator} variant="outlined" />}
                </Box>
              </Paper>
            ))}

            {/* Sanctions drawer */}
            {drawerSection === 'sanctions' && drawerFilteredItems.map((s, i) => (
              <Paper key={i} sx={{ p: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <ScaleIcon size={16} sx={{ color: TL.error }} />
                  <StatusBadge label={s.sanctionType || 'Sanction'} tone="red" />
                  {(s.sanctionAmountNaira != null && s.sanctionAmountNaira > 0) && (
                    <StatusBadge label={formatNaira(s.sanctionAmountNaira) + (s.sanctionAmountPerDay ? '/day' : '')} tone="red" />
                  )}
                  {s.actName && <Chip size="small" label={s.actName} variant="outlined" />}
                </Box>
                {s.liableRoles?.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
                    <Typography sx={{ alignSelf: 'center', fontSize: '0.75rem', color: TL.gray500 }}>Liable: </Typography>
                    {s.liableRoles.map((r, j) => (
                      <Chip key={j} size="small" label={r} />
                    ))}
                  </Box>
                )}
                {s.sourceSectionReference && (
                  <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                    Section: <Box component="span" sx={{ fontFamily: TL.mono }}>{s.sourceSectionReference}</Box>
                  </Typography>
                )}
                {s.description && <Typography sx={{ mt: 0.75, fontSize: '0.875rem', color: TL.gray700 }}>{s.description}</Typography>}
                {s.riskExplanation && (
                  <Typography sx={{ mt: 0.5, fontSize: '0.875rem', color: TL.gray500 }}>{s.riskExplanation}</Typography>
                )}
                {s.penaltyDetails && (
                  <Typography sx={{ mt: 0.5, fontSize: '0.875rem', color: TL.gray500, fontStyle: 'italic' }}>{s.penaltyDetails}</Typography>
                )}
              </Paper>
            ))}

            {/* Evidence drawer */}
            {drawerSection === 'evidence' && drawerFilteredItems.map((ev, i) => (
              <Paper key={ev.fileId || i} sx={{ p: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray800 }}>{ev.originalName}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                      {ev.uploadedByName || 'Unknown'} · {ev.createdAt ? formatDate(ev.createdAt) : ''}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => handleDownloadEvidence(ev)}><ArrowDownTrayIcon size={16} /></IconButton>
                  </Tooltip>
                </Box>
              </Paper>
            ))}

            {/* History drawer */}
            {drawerSection === 'history' && drawerFilteredItems.map((h, i) => (
              <Paper key={i} sx={{ p: 2, mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TL.gray800 }}>
                  Version {h.classificationVersion} — {h.changedAt ? formatDate(h.changedAt) : '-'}
                </Typography>
                <Typography sx={{ display: 'block', fontSize: '0.75rem', color: TL.gray500, mb: 0.5 }}>
                  {h.changedByName || `User #${h.changedByUserId}`}
                </Typography>
                {h.applicability && <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>Applicability: {h.applicability}</Typography>}
                {h.tenantRiskRating && <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>Risk: {h.tenantRiskRating}</Typography>}
                {h.hasGap != null && <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>Has gap: {h.hasGap ? 'Yes' : 'No'}</Typography>}
                {h.changeReason && <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, fontStyle: 'italic', mt: 0.5 }}>Reason: {h.changeReason}</Typography>}
              </Paper>
            ))}
          </Box>
        )}
      </EntityDrawer>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
