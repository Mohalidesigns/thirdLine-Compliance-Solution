import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Paper, Snackbar, Tooltip, List, ListItem, ListItemText,
} from '@mui/material';
import {
  Visibility, History, Download, Edit, UploadFile, Link as LinkIcon, CheckCircle, ArrowBack, Gavel,
  InfoOutlined,
} from '@mui/icons-material';
import { api, API_BASE, getToken } from '../services/api';
import RiskAssessmentModal from '../components/modals/RiskAssessmentModal';
import OwnerModal from '../components/modals/OwnerModal';
import LinkControlsModal from '../components/modals/LinkControlsModal';
import MapReturnModal from '../components/modals/MapReturnModal';
import GapModal from '../components/modals/GapModal';
import EvidenceUploadModal from '../components/modals/EvidenceUploadModal';
import FormattedText from '../components/FormattedText';

const STATUS_COLOR = { active: 'success', classified: 'info', unclassified: 'warning', under_review: 'default' };

// harmonized with ReviewEditPage / ReviewInboxPage
const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

function prettify(v) {
  return v ? String(v).replace(/_/g, ' ') : '';
}

function MetaField({ title, value, mono }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{title}</Typography>
      <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 500, wordBreak: 'break-word',
        fontFamily: mono ? 'Roboto Mono, monospace' : 'inherit', fontSize: mono ? '0.8rem' : undefined }}>
        {value || '-'}
      </Typography>
    </Box>
  );
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

export default function ObligationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const obligationId = Number(id);
  const queryClient = useQueryClient();

  const [activeModal, setActiveModal] = useState(null);

  const [snack, setSnack] = useState(null);
  const notify = (severity, message) => setSnack({ severity, message });

  const detailQuery = useQuery({
    queryKey: ['obligations', 'detail', String(id)],
    queryFn: ({ signal }) => api.obligations.obligationDetail(obligationId, { signal }),
  });

  const selected = detailQuery.data;
  const loading = detailQuery.isPending;
  const error = detailQuery.error?.message || '';

  function onSaved(message) {
    return async () => {
      await queryClient.invalidateQueries({ queryKey: ['obligations'] });
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

  const actionEdit = (setActiveModal, label = 'Edit') => (
    <Button size="medium" variant="contained" onClick={() => setActiveModal(true)}
      startIcon={<Edit sx={{ fontSize: 16 }} />}
      sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{label}</Button>
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
          sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>PDF</Button>
        <Button size="medium" variant="contained" onClick={scrollToHistory} startIcon={<History />}
          sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>View History</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {selected && (
        <Box sx={{ maxWidth: 900 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
            {inherentRiskChip(selected.tenantRiskRating || selected.inherentRiskRating,
              selected.inherentLikelihood || selected.likelihoodRating,
              selected.inherentImpact || selected.impactRating)}
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {selected.regulatorAbbreviation || selected.regulatorName}
            </Typography>
            {selected.areaOfFocus && (
              <Chip size="small" label={selected.areaOfFocus} sx={{ height: 22 }} />
            )}
            {selected.sectionReference && (
              <Chip size="small" variant="outlined" label={selected.sectionReference}
                sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
            )}
            <Chip size="small" label={selected.status || 'unknown'}
              color={STATUS_COLOR[selected.status] || 'default'} sx={{ height: 22 }} />
            {selected.obligationNumber != null && (
              <Typography variant="caption" sx={{ color: '#A0AEC0', fontFamily: 'Roboto Mono, monospace' }}>
                #{selected.obligationNumber}
              </Typography>
            )}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {selected.title || selected.name || 'Untitled obligation'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{selected.sourceTitle}</Typography>

          {/* Verbatim vs Interpreted - side by side on md+ */}
          {(selected.description || selected.plainEnglishStatement) && (
            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <SectionHeader title={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoOutlined sx={{ fontSize: 16 }} /> Obligation Texts (harmonized)
                </Box>
              } />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Verbatim (from document)
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    {selected.description
                      ? <FormattedText text={selected.description} />
                      : <Typography variant="body2" sx={{ color: '#CBD5E0' }}>No verbatim text</Typography>}
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Interpreted (plain English)
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    {selected.plainEnglishStatement
                      ? <Typography variant="body2">{selected.plainEnglishStatement}</Typography>
                      : <Typography variant="body2" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>}
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {/* Obligation Metadata */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Obligation Metadata" />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
              <MetaField title="Obligation No." value={selected.obligationNumber != null ? `#${selected.obligationNumber}` : null} mono />
              <MetaField title="Section" value={selected.sectionReference} mono />
              <MetaField title="Area of Focus" value={selected.areaOfFocus} />
              <MetaField title="Obligation Type" value={prettify(selected.obligationType)} />
              <MetaField title="Deadline" value={prettify(selected.recurringDeadlineType)} />
              <MetaField title="Act / Regulation"
                value={selected.actName || (selected.regulationId ? `Reg #${selected.regulationId}` : null)} />
              <MetaField title="Effective Date" value={selected.effectiveDate ? formatDate(selected.effectiveDate) : null} />
              <MetaField title="Classification Version"
                value={selected.classificationVersion != null ? `v${selected.classificationVersion}` : null} />
            </Box>
          </Paper>

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
              action={actionEdit(() => setActiveModal('risk'), 'Assess Risk')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2, mb: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Inherent</Typography>
                <Box sx={{ mt: 0.5 }}>
                  {inherentRiskChip(selected.inherentRiskRating, selected.inherentLikelihood, selected.inherentImpact)}
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Residual</Typography>
                <Box sx={{ mt: 0.5 }}>{inherentRiskChip(selected.residualRiskRating)}</Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Likelihood</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.inherentLikelihood || selected.likelihoodRating || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Impact</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.inherentImpact || selected.impactRating || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Risk Type</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{prettify(selected.riskType) || '-'}</Typography>
              </Box>
            </Box>
            {selected.riskDescription && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{selected.riskDescription}</Typography>
            )}
            {selected.riskJustification && (
              <Typography variant="body2" color="text.secondary">{selected.riskJustification}</Typography>
            )}
            {selected.likelihoodJustification && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <strong>Likelihood:</strong> {selected.likelihoodJustification}
              </Typography>
            )}
            {selected.impactJustification && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                <strong>Impact:</strong> {selected.impactJustification}
              </Typography>
            )}
          </Paper>

          {/* Owner */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Compliance Owner"
              action={actionEdit(() => setActiveModal('owner'), 'Assign Owner')} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {selected.controlOwner || selected.assignedOwnerName || 'Unassigned'}
            </Typography>
            {selected.assignedDepartment && (
              <Typography variant="caption" color="text.secondary">{selected.assignedDepartment}</Typography>
            )}
          </Paper>

          {/* Controls */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Linked Controls"
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="text" onClick={() => navigate(`/controls?obligationId=${obligationId}`)}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13 }}>View controls</Button>
                  <Button size="medium" variant="contained" onClick={() => setActiveModal('controls')}
                    startIcon={<Edit sx={{ fontSize: 16 }} />}
                    sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Link controls</Button>
                </Box>
              } />
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
              action={<Button size="medium" variant="contained" onClick={() => setActiveModal('returns')}
                startIcon={<Edit sx={{ fontSize: 16 }} />}
                sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Map return</Button>} />
            {selected.linkedReturns?.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.linkedReturns.map(r => (
                  <Chip key={r.returnId} size="small" icon={<LinkIcon sx={{ fontSize: 14 }} />}
                            label={`${r.returnName}${r.frequency ? ` (${r.frequency})` : ''}`} sx={{ height: 22 }} />
                ))}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">None mapped</Typography>}
          </Paper>

          {/* Sanctions */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Regulatory Sanctions" />
            {selected.sanctions?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selected.sanctions.map((s, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: '#FFF5F5', borderColor: '#FEB2B2' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                      <Chip size="small" icon={<Gavel sx={{ fontSize: 14 }} />}
                        label={s.sanctionType || 'Sanction'} color="error" sx={{ height: 22 }} />
                      {(s.sanctionAmountNaira != null && s.sanctionAmountNaira > 0) && (
                        <Chip size="small" label={formatNaira(s.sanctionAmountNaira) + (s.sanctionAmountPerDay ? '/day' : '')}
                          color="error" sx={{ height: 22 }} />
                      )}
                      {s.hasBeenEnforced != null && (
                        <Chip size="small" label={s.hasBeenEnforced ? 'Enforced' : 'Not enforced'}
                          sx={{ height: 22 }} />
                      )}
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
              </Box>
            ) : <Typography variant="body2" color="text.secondary">No sanctions recorded</Typography>}
          </Paper>

          {/* Gap */}
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <SectionHeader title="Control Gap"
              action={actionEdit(() => setActiveModal('gap'), 'Identified Gaps')} />
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
              action={<Button size="medium" variant="contained" onClick={() => setActiveModal('evidence')}
                startIcon={<UploadFile sx={{ fontSize: 16 }} />}
                sx={{ width: 180, height: 40, textTransform: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Upload</Button>} />
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
