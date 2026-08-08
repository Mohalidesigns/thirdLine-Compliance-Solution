import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Paper, Snackbar, Tooltip, List, ListItem, ListItemText,
} from '@mui/material';
import {
  Visibility, History, Download, Edit, UploadFile, Link as LinkIcon, CheckCircle, ArrowBack,
} from '@mui/icons-material';
import { api, API_BASE, getToken } from '../services/api';
import RiskAssessmentModal from '../components/modals/RiskAssessmentModal';
import OwnerModal from '../components/modals/OwnerModal';
import LinkControlsModal from '../components/modals/LinkControlsModal';
import MapReturnModal from '../components/modals/MapReturnModal';
import GapModal from '../components/modals/GapModal';
import EvidenceUploadModal from '../components/modals/EvidenceUploadModal';

const RISK_CONFIG = {
  Extreme: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

const STATUS_COLOR = { active: 'success', classified: 'info', unclassified: 'warning', under_review: 'default' };

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22 }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22 }} />;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SectionHeader({ title, action }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      {action}
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
    try {
      const d = await api.obligations.obligationDetail(obligationId);
      setSelected(d);
    } catch { /* keep current */ }
  }

  function onSaved(message) {
    return async () => {
      await reload();
      notify('success', message);
    };
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

  function scrollToHistory() {
    document.getElementById('obligation-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleViewPdf() {
    const instrumentId = selected?.instrumentId;
    if (!instrumentId) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${instrumentId}/pdf`, {
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      });
      if (!res.ok) throw new Error('PDF load failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { notify('error', 'Failed to load PDF.'); }
  }

  const actionEdit = setActiveModal => (
    <Button size="small" variant="text" onClick={() => setActiveModal(true)} startIcon={<Edit sx={{ fontSize: 16 }} />}>Edit</Button>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  if (error && !selected) {
    return (
      <Box>
        <IconButton onClick={() => navigate('/obligations')} sx={{ mb: 2 }}><ArrowBack /></IconButton>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/obligations')}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1 }} />
        <Button size="medium" variant="contained" onClick={handleViewPdf} startIcon={<Visibility />}
          sx={{ height: 40, bgcolor: '#616161', color: '#fff', '&:hover': { bgcolor: '#424242' } }}>PDF</Button>
        <Button size="medium" variant="outlined" onClick={scrollToHistory} startIcon={<History />}
          sx={{ height: 40 }}>View History</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {selected && (
        <Box sx={{ maxWidth: 900 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            {riskChip(selected.tenantRiskRating || selected.inherentRiskRating)}
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {selected.regulatorAbbreviation || selected.regulatorName}
            </Typography>
            <Chip size="small" label={selected.status || 'unknown'}
              color={STATUS_COLOR[selected.status] || 'default'} sx={{ height: 22 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            {selected.description || 'Untitled obligation'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{selected.sourceTitle}</Typography>

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
              action={actionEdit(() => setActiveModal('risk'))} />
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
                <Typography variant="caption" color="text.secondary">Impact / Likelihood</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.impactRating || '-'} / {selected.likelihoodRating || '-'}</Typography>
              </Box>
            </Box>
            {selected.riskJustification && (
              <Typography variant="body2" color="text.secondary">{selected.riskJustification}</Typography>
            )}
          </Paper>

          {/* Owner */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Compliance Owner"
              action={actionEdit(() => setActiveModal('owner'))} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {selected.assignedOwnerName || 'Unassigned'}
            </Typography>
            {selected.assignedDepartment && (
              <Typography variant="caption" color="text.secondary">{selected.assignedDepartment}</Typography>
            )}
          </Paper>

          {/* Controls */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Linked Controls"
              action={<Button size="small" variant="text" onClick={() => setActiveModal('controls')}
                startIcon={<Edit sx={{ fontSize: 16 }} />}>Link controls</Button>} />
            {selected.linkedControls?.length > 0 ? (
              <List dense disablePadding>
                {selected.linkedControls.map(c => (
                  <ListItem key={c.controlId} disableGutters sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={<Typography variant="body2">{c.controlNumber} — {c.name}</Typography>}
                      secondary={<Typography variant="caption" color="text.secondary">
                        {c.theme || ''}{c.controlType ? ` · ${c.controlType}` : ''}{c.inherentRisk ? ` · Inherent: ${c.inherentRisk}` : ''}
                      </Typography>} />
                  </ListItem>
                ))}
              </List>
            ) : <Typography variant="body2" color="text.secondary">No controls linked</Typography>}
          </Paper>

          {/* Returns */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Return Required"
              action={<Button size="small" variant="text" onClick={() => setActiveModal('returns')}
                startIcon={<Edit sx={{ fontSize: 16 }} />}>Map return</Button>} />
            {selected.linkedReturns?.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.linkedReturns.map(r => (
                  <Chip key={r.returnId} size="small" icon={<LinkIcon sx={{ fontSize: 14 }} />}
                    label={`${r.returnName}${r.frequency ? ` (${r.frequency})` : ''}`} variant="outlined" sx={{ height: 22 }} />
                ))}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">None mapped</Typography>}
          </Paper>

          {/* Gap */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Control Gap"
              action={actionEdit(() => setActiveModal('gap'))} />
            {selected.hasGap ? (
              <Alert severity="warning" sx={{ mt: -1, mb: 1 }}>
                <strong>Gap identified:</strong> {selected.gapDescription || 'No control covers this obligation'}
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">No gap identified — controls cover this obligation.</Typography>
            )}
          </Paper>

          {/* Evidence */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Evidence"
              action={<Button size="small" variant="outlined" onClick={() => setActiveModal('evidence')}
                startIcon={<UploadFile sx={{ fontSize: 16 }} />}>Upload</Button>} />
            {selected.evidence?.length > 0 ? (
              <List dense disablePadding>
                {selected.evidence.map(ev => (
                  <ListItem key={ev.fileId} disableGutters
                    secondaryAction={
                      <Tooltip title="Download"><IconButton size="small" onClick={() => handleDownloadEvidence(ev)}><Download fontSize="small" /></IconButton></Tooltip>
                    }>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{ev.originalName}</Typography>}
                      secondary={<Typography variant="caption" color="text.secondary">
                        {ev.uploadedByName || 'Unknown'} · {ev.createdAt ? formatDate(ev.createdAt) : ''}
                      </Typography>} />
                  </ListItem>
                ))}
              </List>
            ) : <Typography variant="body2" color="text.secondary">No evidence uploaded</Typography>}
          </Paper>

          {/* History */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }} id="obligation-history">
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Version History</Typography>
            {selected.history?.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No version history recorded.</Typography>
            ) : selected.history.map((h, i) => (
              <Box key={i} sx={{ mb: 1.5, pb: 1.5, borderBottom: i < selected.history.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
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
          </Paper>
        </Box>
      )}

      {/* Section modals */}
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

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
