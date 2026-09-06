import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Paper, Snackbar, Tooltip, Drawer, TextField, Divider,
} from '@mui/material';
import {
  Visibility, History, Download, Edit, UploadFile, Link as LinkIcon,
  CheckCircle, ArrowBack, Gavel, Close, Search,
} from '@mui/icons-material';
import { api, API_BASE, getToken } from '../services/api';
import RiskAssessmentModal from '../components/modals/RiskAssessmentModal';
import OwnerModal from '../components/modals/OwnerModal';
import LinkControlsModal from '../components/modals/LinkControlsModal';
import MapReturnModal from '../components/modals/MapReturnModal';
import GapModal from '../components/modals/GapModal';
import EvidenceUploadModal from '../components/modals/EvidenceUploadModal';
import FormattedText from '../components/FormattedText';

const RISK_CONFIG = {
  Critical: { color: 'error', bg: '#FFF5F5' },
  Extreme: { color: 'error', bg: '#FFF5F5' },
  High: { color: 'error', bg: '#FFF5F5' },
  Moderate: { color: 'warning', bg: '#FFFAF0' },
  Medium: { color: 'warning', bg: '#FFFAF0' },
  Low: { color: 'success', bg: '#F0FFF4' },
};

const STATUS_COLOR = { active: 'success', classified: 'info', unclassified: 'warning', under_review: 'default' };

const VISIBLE_CHIP_COUNT = 5;

function riskChip(rating, size = 'small') {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size={size} label="Unrated" sx={{ height: 22 }} />;
  return <Chip size={size} label={rating} color={cfg.color} sx={{ height: 22 }} />;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNaira(a) {
  if (a == null) return null;
  return '₦' + Number(a).toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

function SectionHeader({ title, action }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      {action}
    </Box>
  );
}

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
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} /> } }}
          sx={{ mb: 1, minWidth: 200, '& .MuiInputBase-root': { height: 32, fontSize: 13 } }}
        />
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {visible.map((item, i) => renderChip(item, i))}
        {!showAll && hiddenCount > 0 && (
          <Chip size="small" label={`+${hiddenCount} more`}
            onClick={() => setExpanded(true)}
            sx={{ height: 22, cursor: 'pointer', fontWeight: 600, bgcolor: '#EDF2F7' }} />
        )}
        {showAll && items.length > visibleCount && !search && (
          <Chip size="small" label="Show less"
            onClick={() => setExpanded(false)}
            sx={{ height: 22, cursor: 'pointer', fontWeight: 600, bgcolor: '#EDF2F7' }} />
        )}
      </Box>
    </Box>
  );
}

export default function ObligationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const obligationId = Number(id);

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [drawerSection, setDrawerSection] = useState(null);
  const [drawerSearch, setDrawerSearch] = useState('');

  const [snack, setSnack] = useState(null);
  const notify = (severity, message) => setSnack({ severity, message });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.obligations.obligationDetail(obligationId)
      .then(d => { if (active) setSelected(d); })
      .catch(e => { if (active) setError(e.message || 'Failed to load obligation detail.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [obligationId]);

  async function reload() {
    try { const d = await api.obligations.obligationDetail(obligationId); setSelected(d); } catch {}
  }

  function onSaved(message) {
    return async () => { await reload(); notify('success', message); };
  }

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
      if (!res.ok) throw new Error('PDF load failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { notify('error', 'Failed to load PDF.'); }
  }

  const actionEdit = (modal, label = 'Edit') => (
    <Button size="medium" variant="contained" onClick={() => setActiveModal(modal)}
      startIcon={<Edit sx={{ fontSize: 16 }} />}
      sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{label}</Button>
  );

  const openDrawer = (section) => { setDrawerSection(section); setDrawerSearch(''); };

  const drawerFilteredItems = useMemo(() => {
    if (!selected || !drawerSection) return [];
    let items = [];
    if (drawerSection === 'controls') items = selected.linkedControls || [];
    else if (drawerSection === 'returns') items = selected.linkedReturns || [];
    else if (drawerSection === 'sanctions') items = selected.sanctions || [];
    else if (drawerSection === 'evidence') items = selected.evidence || [];
    else if (drawerSection === 'history') items = selected.history || [];
    if (!drawerSearch) return items;
    const q = drawerSearch.toLowerCase();
    return items.filter(item => JSON.stringify(item).toLowerCase().includes(q));
  }, [selected, drawerSection, drawerSearch]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error && !selected) return (
    <Box>
      <IconButton onClick={() => navigate('/obligations')} sx={{ mb: 2 }}><ArrowBack /></IconButton>
      <Alert severity="error">{error}</Alert>
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/obligations')}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1 }} />
        <Button size="medium" variant="contained" onClick={handleViewPdf} startIcon={<Visibility />}
          sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>PDF</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {selected && (
        <Box sx={{ maxWidth: 900 }}>
          {/* Header chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {riskChip(selected.tenantRiskRating || selected.inherentRiskRating)}
            {selected.regulatorAbbreviation && <Chip size="small" label={selected.regulatorAbbreviation} sx={{ height: 22 }} />}
            {selected.areaOfFocus && <Chip size="small" label={selected.areaOfFocus} sx={{ height: 22 }} />}
            {selected.actName && <Chip size="small" label={selected.actName} variant="outlined" sx={{ height: 22 }} />}
            {selected.obligationType && <Chip size="small" label={selected.obligationType} variant="outlined" sx={{ height: 22 }} />}
            {selected.recurringDeadlineType && <Chip size="small" label={selected.recurringDeadlineType} variant="outlined" sx={{ height: 22 }} />}
            <Chip size="small" label={selected.status || 'unknown'}
              color={STATUS_COLOR[selected.status] || 'default'} sx={{ height: 22 }} />
          </Box>

          {/* Title */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {selected.title || selected.name || 'Untitled obligation'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">{selected.sourceTitle}</Typography>
            {selected.sectionReference && (
              <Typography variant="body2" color="text.secondary">Section: {selected.sectionReference}</Typography>
            )}
            {selected.effectiveDate && (
              <Typography variant="body2" color="text.secondary">Effective: {formatDate(selected.effectiveDate)}</Typography>
            )}
          </Box>

          {/* Obligation Statement — verbatim + interpreted */}
          {(selected.description || selected.plainEnglishStatement) && (
            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              {selected.description && (
                <Box sx={{ mb: selected.plainEnglishStatement ? 2 : 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Source Text
                  </Typography>
                  <FormattedText text={selected.description} />
                </Box>
              )}
              {selected.plainEnglishStatement && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Plain English
                  </Typography>
                  <FormattedText text={selected.plainEnglishStatement} />
                </Box>
              )}
            </Paper>
          )}

          {/* Classification */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Your Classification" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ color: selected.applicability === 'applicable' ? '#38A169' : '#CBD5E0', fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                {selected.applicability || 'Not classified'}
              </Typography>
              {selected.classifiedByName && (
                <Typography variant="caption" color="text.secondary">— {selected.classifiedByName}</Typography>
              )}
            </Box>
            {selected.classifiedAt && (
              <Typography variant="caption" color="text.secondary">{formatDate(selected.classifiedAt)}</Typography>
            )}
            {selected.applicabilityReasoning && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{selected.applicabilityReasoning}</Typography>
            )}
          </Paper>

          {/* Risk Assessment */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Internal Risk Assessment"
              action={actionEdit('risk', 'Assess Risk')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2, mb: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Inherent</Typography>
                <Box sx={{ mt: 0.5 }}>{riskChip(selected.inherentRiskRating)}</Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Residual</Typography>
                <Box sx={{ mt: 0.5 }}>{riskChip(selected.residualRiskRating)}</Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Likelihood</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.inherentLikelihood || '-'}</Typography>
                {selected.likelihoodJustification && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{selected.likelihoodJustification}</Typography>
                )}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Impact</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.inherentImpact || '-'}</Typography>
                {selected.impactJustification && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{selected.impactJustification}</Typography>
                )}
              </Box>
            </Box>
            {selected.riskDescription && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{selected.riskDescription}</Typography>
            )}
            {selected.riskJustification && (
              <Typography variant="body2" color="text.secondary">{selected.riskJustification}</Typography>
            )}
          </Paper>

          {/* Owner */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Compliance Owner"
              action={actionEdit('owner', 'Assign Owner')} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {selected.controlOwner || selected.assignedOwnerName || 'Unassigned'}
            </Typography>
            {selected.assignedDepartment && (
              <Typography variant="caption" color="text.secondary">{selected.assignedDepartment}</Typography>
            )}
          </Paper>

          {/* Controls — chip preview */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title={`Linked Controls (${selected.linkedControls?.length || 0})`}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selected.linkedControls?.length > 0 && (
                    <Button size="small" variant="text" onClick={() => openDrawer('controls')}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13 }}>View all</Button>
                  )}
                  <Button size="medium" variant="contained" onClick={() => setActiveModal('controls')}
                    startIcon={<Edit sx={{ fontSize: 16 }} />}
                    sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Link controls</Button>
                </Box>
              } />
            {selected.linkedControls?.length > 0 ? (
              <ChipList items={selected.linkedControls}
                renderChip={(c, i) => (
                  <Chip key={c.controlId || i} size="small" label={c.name || c.controlNumber}
                    onClick={() => navigate(`/controls?controlId=${c.controlId}`)}
                    sx={{ height: 22, cursor: 'pointer', maxWidth: 300,
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }} />
                )} />
            ) : <Typography variant="body2" color="text.secondary">No controls linked</Typography>}
          </Paper>

          {/* Returns — chip preview */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title={`Return Required (${selected.linkedReturns?.length || 0})`}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selected.linkedReturns?.length > 0 && (
                    <Button size="small" variant="text" onClick={() => openDrawer('returns')}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13 }}>View all</Button>
                  )}
                  <Button size="medium" variant="contained" onClick={() => setActiveModal('returns')}
                    startIcon={<Edit sx={{ fontSize: 16 }} />}
                    sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Map return</Button>
                </Box>
              } />
            {selected.linkedReturns?.length > 0 ? (
              <ChipList items={selected.linkedReturns}
                renderChip={(r, i) => (
                  <Chip key={r.returnId || i} size="small" icon={<LinkIcon sx={{ fontSize: 14 }} />}
                    label={`${r.returnName}${r.frequency ? ` (${r.frequency})` : ''}`}
                    sx={{ height: 22, maxWidth: 300,
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }} />
                )} />
            ) : <Typography variant="body2" color="text.secondary">None mapped</Typography>}
          </Paper>

          {/* Sanctions — compact preview */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title={`Regulatory Sanctions (${selected.sanctions?.length || 0})`}
              action={selected.sanctions?.length > 0 ? (
                <Button size="small" variant="text" onClick={() => openDrawer('sanctions')}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13 }}>View all</Button>
              ) : null} />
            {selected.sanctions?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {selected.sanctions.slice(0, 3).map((s, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" icon={<Gavel sx={{ fontSize: 14 }} />}
                      label={s.sanctionType || 'Sanction'} color="error" sx={{ height: 22 }} />
                    {(s.sanctionAmountNaira != null && s.sanctionAmountNaira > 0) && (
                      <Chip size="small" label={formatNaira(s.sanctionAmountNaira)}
                        color="error" variant="outlined" sx={{ height: 22 }} />
                    )}
                    {s.actName && <Chip size="small" label={s.actName} variant="outlined" sx={{ height: 22 }} />}
                  </Box>
                ))}
                {selected.sanctions.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{selected.sanctions.length - 3} more — click "View all" for details
                  </Typography>
                )}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">No sanctions recorded</Typography>}
          </Paper>

          {/* Gap */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Control Gap"
              action={actionEdit('gap', 'Identified Gaps')} />
            {selected.hasGap ? (
              <Alert severity="warning" sx={{ mt: -1, mb: 1 }}>
                <strong>Gap identified:</strong> {selected.gapDescription || 'No control covers this obligation'}
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">No gap identified — controls cover this obligation.</Typography>
            )}
          </Paper>

          {/* Evidence — compact preview */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title={`Evidence (${selected.evidence?.length || 0})`}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selected.evidence?.length > 0 && (
                    <Button size="small" variant="text" onClick={() => openDrawer('evidence')}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13 }}>View all</Button>
                  )}
                  <Button size="medium" variant="contained" onClick={() => setActiveModal('evidence')}
                    startIcon={<UploadFile sx={{ fontSize: 16 }} />}
                    sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Upload</Button>
                </Box>
              } />
            {selected.evidence?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {selected.evidence.slice(0, 2).map(ev => (
                  <Box key={ev.fileId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>📄 {ev.originalName}</Typography>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownloadEvidence(ev)}><Download fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                ))}
                {selected.evidence.length > 2 && (
                  <Typography variant="caption" color="text.secondary">
                    +{selected.evidence.length - 2} more — click "View all" for full list
                  </Typography>
                )}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">No evidence uploaded</Typography>}
          </Paper>

          {/* History — button only */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Version History"
              action={
                <Button size="small" variant="text" onClick={() => openDrawer('history')}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13 }}>View history</Button>
              } />
            <Typography variant="body2" color="text.secondary">
              {selected.history?.length ? `${selected.history.length} version(s) recorded` : 'No version history recorded.'}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Modals */}
      <RiskAssessmentModal open={activeModal === 'risk'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Risk assessment saved')} onError={notify} />
      <OwnerModal open={activeModal === 'owner'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Owner saved')} onError={notify} />
      <LinkControlsModal open={activeModal === 'controls'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={selected?.linkedControls?.map(c => c.controlId) || []}
        onSaved={onSaved('Controls linked')} onError={notify} />
      <MapReturnModal open={activeModal === 'returns'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initialIds={selected?.linkedReturns?.map(r => r.returnId) || []}
        onSaved={onSaved('Return mapped')} onError={notify} />
      <GapModal open={activeModal === 'gap'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} initial={selected || {}} onSaved={onSaved('Gap updated')} onError={notify} />
      <EvidenceUploadModal open={activeModal === 'evidence'} onClose={() => setActiveModal(null)}
        obligationId={obligationId} evidence={selected?.evidence || []}
        onSaved={onSaved('Evidence uploaded')} onError={notify} />

      {/* Single multi-section drawer */}
      <Drawer anchor="right" open={!!drawerSection} onClose={() => setDrawerSection(null)}
        PaperProps={{ sx: { width: 480, p: 3 } }}>
        {drawerSection && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {drawerSection === 'controls' && `Linked Controls (${drawerFilteredItems.length})`}
                {drawerSection === 'returns' && `Return Required (${drawerFilteredItems.length})`}
                {drawerSection === 'sanctions' && `Regulatory Sanctions (${drawerFilteredItems.length})`}
                {drawerSection === 'evidence' && `Evidence (${drawerFilteredItems.length})`}
                {drawerSection === 'history' && `Version History (${drawerFilteredItems.length})`}
              </Typography>
              <IconButton onClick={() => setDrawerSection(null)}><Close /></IconButton>
            </Box>

            {['controls', 'returns', 'evidence'].includes(drawerSection) && drawerFilteredItems.length > 3 && (
              <TextField size="small" placeholder="Search..." value={drawerSearch}
                onChange={e => setDrawerSearch(e.target.value)} fullWidth
                slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> } }}
                sx={{ mb: 2 }} />
            )}

            {/* Controls drawer */}
            {drawerSection === 'controls' && drawerFilteredItems.map((c, i) => (
              <Paper key={c.controlId || i} variant="outlined" sx={{ p: 2, mb: 1.5, cursor: 'pointer',
                '&:hover': { bgcolor: '#F7FAFC' } }}
                onClick={() => { setDrawerSection(null); navigate(`/controls?controlId=${c.controlId}`); }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{c.name || c.controlNumber}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {c.theme && <Chip size="small" label={c.theme} sx={{ height: 20, fontSize: 11 }} />}
                  {c.controlType && <Chip size="small" label={c.controlType} variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                  {c.residualRisk && riskChip(c.residualRisk, 'small')}
                  {c.status && <Chip size="small" label={c.status} variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                </Box>
                {c.controlOwnerName && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Owner: {c.controlOwnerName}
                  </Typography>
                )}
              </Paper>
            ))}

            {/* Returns drawer */}
            {drawerSection === 'returns' && drawerFilteredItems.map((r, i) => (
              <Paper key={r.returnId || i} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.returnName}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  {r.frequency && <Chip size="small" label={r.frequency} sx={{ height: 20, fontSize: 11 }} />}
                  {r.filingRegulator && <Chip size="small" label={r.filingRegulator} variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                </Box>
              </Paper>
            ))}

            {/* Sanctions drawer */}
            {drawerSection === 'sanctions' && drawerFilteredItems.map((s, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1.5, bgcolor: '#FFF5F5', borderColor: '#FEB2B2' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Chip size="small" icon={<Gavel sx={{ fontSize: 14 }} />}
                    label={s.sanctionType || 'Sanction'} color="error" sx={{ height: 22 }} />
                  {(s.sanctionAmountNaira != null && s.sanctionAmountNaira > 0) && (
                    <Chip size="small" label={formatNaira(s.sanctionAmountNaira) + (s.sanctionAmountPerDay ? '/day' : '')}
                      color="error" sx={{ height: 22 }} />
                  )}
                  {s.actName && <Chip size="small" label={s.actName} variant="outlined" sx={{ height: 22 }} />}
                </Box>
                {s.liableRoles?.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>Liable: </Typography>
                    {s.liableRoles.map((r, j) => (
                      <Chip key={j} size="small" label={r} sx={{ height: 20 }} />
                    ))}
                  </Box>
                )}
                {s.sourceSectionReference && (
                  <Typography variant="caption" color="text.secondary">Section: {s.sourceSectionReference}</Typography>
                )}
                {s.description && <Typography variant="body2" sx={{ mt: 0.5 }}>{s.description}</Typography>}
                {s.riskExplanation && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{s.riskExplanation}</Typography>
                )}
                {s.penaltyDetails && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>{s.penaltyDetails}</Typography>
                )}
              </Paper>
            ))}

            {/* Evidence drawer */}
            {drawerSection === 'evidence' && drawerFilteredItems.map((ev, i) => (
              <Paper key={ev.fileId || i} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{ev.originalName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {ev.uploadedByName || 'Unknown'} · {ev.createdAt ? formatDate(ev.createdAt) : ''}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => handleDownloadEvidence(ev)}><Download fontSize="small" /></IconButton>
                  </Tooltip>
                </Box>
              </Paper>
            ))}

            {/* History drawer */}
            {drawerSection === 'history' && drawerFilteredItems.map((h, i) => (
              <Box key={i} sx={{ mb: 2, pb: 2, borderBottom: i < drawerFilteredItems.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Version {h.classificationVersion} — {h.changedAt ? formatDate(h.changedAt) : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {h.changedByName || `User #${h.changedByUserId}`}
                </Typography>
                {h.applicability && <Typography variant="body2">Applicability: {h.applicability}</Typography>}
                {h.tenantRiskRating && <Typography variant="body2">Risk: {h.tenantRiskRating}</Typography>}
                {h.hasGap != null && <Typography variant="body2">Has gap: {h.hasGap ? 'Yes' : 'No'}</Typography>}
                {h.changeReason && <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5 }}>Reason: {h.changeReason}</Typography>}
              </Box>
            ))}
          </Box>
        )}
      </Drawer>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
