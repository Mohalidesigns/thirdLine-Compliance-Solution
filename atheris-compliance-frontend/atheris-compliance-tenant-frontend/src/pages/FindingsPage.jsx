import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, TextField, MenuItem, Button, IconButton,
  Paper, Dialog, Stepper, Step, StepLabel,
  DialogTitle, DialogContent, DialogActions, CircularProgress, Alert,
  Grid, Tooltip, Checkbox, FormControlLabel,
  Snackbar, Alert as MuiAlert
} from '@mui/material';
import {
  PageHeader, DetailHeader, FilterBar, FilterField, DataCard, RiskBadge, StateBadge, TL, KpiCards,
  PlusIcon, ExclamationTriangleIcon, ClockIcon, ArrowUpTrayIcon, EyeIcon, ArrowPathIcon, CheckCircleIcon,
} from 'shared';
import { api } from '../services/api';
import OwnerPicker from '../components/org/OwnerPicker';
import { useAuth } from '../contexts/AuthContext';
import ImportDialog from '../components/modals/ImportDialog';
import { EvidenceFileList } from '../components/evidence/EvidenceFiles';

const SECTION_LABEL_SX = {
  display: 'block', fontSize: '0.625rem', fontWeight: 600, color: TL.gray400,
  textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1,
};
const STATUS_ORDER = ['Open', 'In Remediation', 'Remediated', 'Closed'];
const IMPORT_ROLES = ['CCO', 'TENANT_ADMIN'];
const LINK_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
const SUBMIT_ROLES = ['ANALYST', 'TENANT_ADMIN'];

export default function FindingsPage() {
  const [view, setView] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ status: '', severity: '', overdueOnly: false });
  const [stats, setStats] = useState(null);
  const [searchParams] = useSearchParams();
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [remediateOpen, setRemediateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const [success, setSuccess] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuth();
  const canImport = IMPORT_ROLES.includes(user?.role);

  const loadList = useCallback(() => {
    setLoading(true);
    const p = { page, size: rowsPerPage };
    if (filters.status) p.status = filters.status;
    if (filters.severity) p.severity = filters.severity;
    if (filters.overdueOnly) p.overdueOnly = true;
    api.findings.register(p).then(res => setData(res))
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
    api.findings.stats().then(setStats).catch(() => {});
  }, [page, rowsPerPage, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = useCallback((id) => {
    setLoading(true);
    api.findings.detail(id).then(res => { setDetail(res); setView('detail'); setDetailId(id); })
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fid = searchParams.get('findingId');
    if (fid) loadDetail(fid);
  }, [searchParams, loadDetail]);

  const byStatus = stats?.byStatus || {};
  const findingKpis = [
    { key: 'open', label: 'Open', value: byStatus['Open'] ?? 0, tone: 'blue', icon: <ExclamationTriangleIcon />,
      active: filters.status === 'Open' },
    { key: 'inremediation', label: 'In Remediation', value: byStatus['In Remediation'] ?? 0, tone: 'orange', icon: <ArrowPathIcon />,
      active: filters.status === 'In Remediation' },
    { key: 'awaiting', label: 'Awaiting Review', value: byStatus['Remediated'] ?? 0, tone: 'purple', icon: <ClockIcon />,
      active: filters.status === 'Remediated' },
    { key: 'overdue', label: 'Overdue', value: stats?.overdueRemediation ?? 0, tone: 'red', icon: <ClockIcon />,
      active: !!filters.overdueOnly },
    { key: 'closed', label: 'Closed', value: byStatus['Closed'] ?? 0, tone: 'green', icon: <CheckCircleIcon />,
      active: filters.status === 'Closed' },
  ];

  const onKpiSelect = (key) => {
    setPage(0);
    const base = { severity: '', overdueOnly: false };
    if (key === 'open') setFilters({ ...base, status: 'Open' });
    else if (key === 'inremediation') setFilters({ ...base, status: 'In Remediation' });
    else if (key === 'awaiting') setFilters({ ...base, status: 'Remediated' });
    else if (key === 'overdue') setFilters({ ...base, status: '', overdueOnly: true });
    else if (key === 'closed') setFilters({ ...base, status: 'Closed' });
  };

  if (view === 'detail' && detail) {
    return (
      <DetailView
        detail={detail}
        onBack={() => { setView('list'); setDetail(null); setDetailId(null); }}
        onRefresh={() => loadDetail(detailId)}
        onAssign={() => setAssignOpen(true)}
        onRemediate={() => setRemediateOpen(true)}
        onReview={() => setReviewOpen(true)}
        onLink={() => setLinkOpen(true)}
        currentUser={user}
        assignOpen={assignOpen} setAssignOpen={setAssignOpen}
        remediateOpen={remediateOpen} setRemediateOpen={setRemediateOpen}
        reviewOpen={reviewOpen} setReviewOpen={setReviewOpen}
        linkOpen={linkOpen} setLinkOpen={setLinkOpen}
        onSnackbar={setSnackbar}
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title="Findings"
        subtitle="Track and remediate control gaps"
        actions={(
          <>
            {canImport && (
              <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setImportOpen(true)}>
                Import
              </Button>
            )}
            <Button variant="contained" color="error" startIcon={<PlusIcon size={16} />} onClick={() => setRaiseOpen(true)}>
              Raise Finding
            </Button>
          </>
        )}
      />

      <KpiCards columns={5} items={findingKpis} onSelect={onKpiSelect} />

      <FilterBar>
        <FilterField label="Status" minWidth={170}>
          <TextField select size="small"
            value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Open">Open</MenuItem>
            <MenuItem value="In Remediation">In Remediation</MenuItem>
            <MenuItem value="Remediated">Remediated</MenuItem>
            <MenuItem value="Closed">Closed</MenuItem>
          </TextField>
        </FilterField>
        <FilterField label="Severity" minWidth={170}>
          <TextField select size="small"
            value={filters.severity} onChange={e => { setFilters(f => ({ ...f, severity: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Critical">Critical</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </TextField>
        </FilterField>
        <FilterField label="Deadline" minWidth={140}>
          <FormControlLabel sx={{ height: 40, m: 0 }} control={<Checkbox size="small" checked={filters.overdueOnly}
            onChange={e => { setFilters(f => ({ ...f, overdueOnly: e.target.checked })); setPage(0); }} />}
            label={<Typography variant="body2" sx={{ color: TL.gray700 }}>Overdue only</Typography>} />
        </FilterField>
      </FilterBar>

      <DataCard title="Findings Register" subtitle={`${data.totalElements} finding${data.totalElements !== 1 ? 's' : ''}`} noPadding>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <ExclamationTriangleIcon size={40} sx={{ color: TL.gray300, mb: 1 }} />
            <Typography color="text.secondary">No findings found</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Finding</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Deadline</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((row) => {
                    const deadline = row.remediationDeadline ? new Date(row.remediationDeadline) : null;
                    const isOverdue = deadline && deadline < new Date() && row.status !== 'Closed' && row.status !== 'Remediated';
                    return (
                      <TableRow key={row.findingId} hover sx={{ cursor: 'pointer' }}
                        onClick={() => loadDetail(row.findingId)}>
                        <TableCell sx={{ maxWidth: 420 }}>
                          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.description}
                          </Typography>
                          <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>
                            {row.displayId}{row.externalReference ? ` · ${row.externalReference}` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell><RiskBadge value={row.severity} /></TableCell>
                        <TableCell>{row.assignedToName || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color={isOverdue ? 'error.main' : 'text.primary'}
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
                            {isOverdue && <ClockIcon size={14} />}
                            {deadline ? deadline.toLocaleDateString() : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StateBadge value={row.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View detail">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); loadDetail(row.findingId); }}>
                              <EyeIcon size={16} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            <TablePagination component="div" count={data.totalElements} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </DataCard>

      <RaiseDialog open={raiseOpen} onClose={() => setRaiseOpen(false)}
        onSaved={() => { setRaiseOpen(false); loadList(); }} onSnackbar={setSnackbar} />

      {canImport && (
        <ImportDialog entityType="findings" entityLabel="findings" open={importOpen}
          itemLabel="Finding" contextLabel="Control / Obligation"
          invalidateKeys={[['dashboard']]}
          onClose={() => setImportOpen(false)}
          onImported={(r) => { loadList(); setSuccess(`Imported ${r?.importedRows ?? 0} findings.`); }} />
      )}

      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSuccess('')}>{success}</MuiAlert>
      </Snackbar>

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}

function DetailView({ detail, onBack, onRefresh, onAssign, onRemediate, onReview, onLink, currentUser,
  assignOpen, setAssignOpen, remediateOpen, setRemediateOpen, reviewOpen, setReviewOpen, linkOpen, setLinkOpen,
  onSnackbar }) {
  const isOpen = detail.status === 'Open';
  const isInRemediation = detail.status === 'In Remediation';
  const isRemediated = detail.status === 'Remediated';
  const isClosed = detail.status === 'Closed';
  const deadline = detail.remediationDeadline ? new Date(detail.remediationDeadline) : null;
  const isOverdue = deadline && deadline < new Date() && !isClosed;
  const isSubmitter = currentUser?.userId != null
    && detail.remediationSubmittedByUserId != null
    && currentUser.userId === detail.remediationSubmittedByUserId;
  const canLink = LINK_ROLES.includes(currentUser?.role);
  const canRecord = SUBMIT_ROLES.includes(currentUser?.role);
  const navigate = useNavigate();

  const hasControl = detail.linkedControlId != null;
  const stageNames = hasControl
    ? ['Control', 'Test failed', 'Finding raised', 'In remediation', 'Review & sign off', 'Closed']
    : ['Finding raised', 'In remediation', 'Review & sign off', 'Closed'];
  const stageOffset = hasControl ? 2 : 0;
  const stageByStatus = { Open: 0, 'In Remediation': 1, Remediated: 2, Closed: 3 };
  const activeStep = isClosed ? stageNames.length : stageOffset + (stageByStatus[detail.status] ?? 0);

  return (
    <Box>
      <DetailHeader
        band
        onBack={onBack}
        backLabel="Back to Findings"
        title={detail.displayId}
        status={detail.status}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <RiskBadge value={detail.severity} />
            {detail.linkedControlId && (
              <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>
                Linked control:{' '}
                <Box component="span" sx={{ fontFamily: TL.mono, fontSize: '0.75rem' }}>
                  {detail.linkedControlIdentifier || `CTRL-${String(detail.linkedControlId).padStart(3, '0')}`}
                </Box>
              </Typography>
            )}
          </Box>
        )}
        description={detail.description}
        right={(
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isOpen && <Button variant="outlined" size="small" onClick={onAssign}>Assign</Button>}
            {(isOpen || isInRemediation) && canLink && (
              <Button variant="outlined" size="small" onClick={onLink}>Remediation link</Button>
            )}
            {isInRemediation && canRecord && (
              <Button variant="outlined" size="small" onClick={onRemediate}>Record remediation on behalf of owner</Button>
            )}
            {isRemediated && !isSubmitter && (
              <Button variant="contained" color="success" size="small" onClick={onReview}>Review & Sign off</Button>
            )}
            {isRemediated && isSubmitter && (
              <Tooltip title="You submitted this remediation — another Analyst, CCO or Admin must sign off">
                <span><Button variant="contained" color="success" size="small" disabled>Review & Sign off</Button></span>
              </Tooltip>
            )}
          </Box>
        )}
      />

      {/* SLA */}
      {deadline && !isClosed && (
        <Paper sx={{ mb: 3, px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: isOverdue ? '#FEF2F2' : TL.gray50, color: isOverdue ? TL.error : TL.gray500,
          }}>
            <ClockIcon size={16} />
          </Box>
          <Typography variant="body2" fontWeight={600} color={isOverdue ? 'error.main' : 'text.primary'}>
            SLA: {detail.slaDays} days
            {isOverdue ? ' · OVERDUE' : ` · ${detail.slaRemainingDays} days remaining`}
          </Typography>
          <Typography variant="body2" color="text.secondary">Deadline: {deadline.toLocaleDateString()}</Typography>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <DataCard title="Workflow" sx={{ mb: 3 }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {stageNames.map((name, i) => (
                <Step key={name} completed={i < activeStep}>
                  <StepLabel>
                    <Typography
                      onClick={hasControl && i === 0
                        ? () => navigate(`/controls?controlId=${detail.linkedControlId}`)
                        : undefined}
                      sx={{
                        fontSize: '0.8125rem', fontWeight: i === activeStep ? 700 : 500,
                        color: i === activeStep ? 'primary.main' : (i < activeStep ? 'text.secondary' : 'text.disabled'),
                        cursor: hasControl && i === 0 ? 'pointer' : 'default',
                        textDecoration: hasControl && i === 0 ? 'underline' : 'none',
                      }}>
                      {name}
                    </Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: 'center' }}>
              {isClosed ? 'Finding closed — remediation signed off.'
                : isRemediated ? (isSubmitter
                  ? 'Awaiting sign off by another reviewer — you submitted this remediation.'
                  : 'Remediation submitted — review and sign off to close.')
                : isInRemediation ? 'Owner is remediating — record evidence or submit via the remediation link.'
                : 'Assign an owner and start remediation.'}
              {isOverdue && !isClosed ? ' SLA is overdue.' : ''}
            </Typography>
          </DataCard>

          {/* Timeline */}
          <DataCard title="Timeline">
            {detail.timeline && detail.timeline.length > 0 ? (
              <Box sx={{ position: 'relative', pl: 3 }}>
                {detail.timeline.map((evt, i) => (
                  <Box key={i} sx={{ position: 'relative', pb: 2.5, '&:last-child': { pb: 0 },
                    '&::before': i < detail.timeline.length - 1 ? {
                      content: '""', position: 'absolute', left: -5, top: 20, width: 2, height: '100%',
                      bgcolor: TL.gray100
                    } : {}
                  }}>
                    <Box sx={{ position: 'absolute', left: -11, top: 2, width: 14, height: 14, borderRadius: '50%',
                      bgcolor: i === detail.timeline.length - 1 && evt.eventType === 'closed' ? 'success.main' : 'primary.main',
                      border: '2px solid', borderColor: 'background.paper' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                      {new Date(evt.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: '0.875rem', color: TL.gray700 }}>{evt.description}</Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No timeline events</Typography>
            )}
          </DataCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          {/* Details sidebar */}
          <DataCard title="Finding Details" sx={{ mb: 3 }}>
            <Typography component="span" sx={SECTION_LABEL_SX}>Finding</Typography>
            {detail.externalReference && <DetailRow label="Reference" value={detail.externalReference} />}
            <DetailRow label="Type" value={detail.findingType} />
            <DetailRow label="Trigger" value={detail.triggerReason} />
            {detail.rootCause && <DetailRow label="Root cause" value={detail.rootCause} />}
            <DetailRow label="Created" value={detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '-'} />
            <Box sx={{ borderTop: `1px solid ${TL.gray100}`, my: 2 }} />
            <Typography component="span" sx={SECTION_LABEL_SX}>Remediation</Typography>
            <DetailRow label="Owner" value={detail.assignedToName || 'Unassigned'} />
            <DetailRow label="Deadline" value={deadline ? deadline.toLocaleDateString() : '-'} />
            {detail.remediationSubmittedAt && (
              <DetailRow label="Submitted" value={new Date(detail.remediationSubmittedAt).toLocaleDateString()} />
            )}
            {detail.remediationSubmittedViaLink && (
              <DetailRow label="Submitted by" value={`${detail.assignedToName || 'Owner'} (via link)`} />
            )}
            {detail.remediationNotes && <DetailRow label="Notes" value={detail.remediationNotes} />}
            <Box sx={{ mt: 1.5 }}>
              <Typography component="span" sx={SECTION_LABEL_SX}>Evidence</Typography>
              <EvidenceFileList sourceType="finding" sourceId={detail.findingId}
                emptyText="No evidence attached." />
            </Box>
            {detail.reviewNotes && <DetailRow label="Review note" value={detail.reviewNotes} />}
            {detail.signedOffAt && (
              <DetailRow label="Signed off" value={new Date(detail.signedOffAt).toLocaleDateString()} />
            )}
          </DataCard>
        </Grid>
      </Grid>

      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)}
        findingId={detail.findingId} onSaved={() => { setAssignOpen(false); onRefresh(); }}
        onSnackbar={onSnackbar} />

      <RemediateDialog open={remediateOpen} onClose={() => setRemediateOpen(false)}
        findingId={detail.findingId} onSaved={() => { setRemediateOpen(false); onRefresh(); }}
        onSnackbar={onSnackbar} />

      <ReviewDialog open={reviewOpen} onClose={() => setReviewOpen(false)}
        findingId={detail.findingId} detail={detail}
        onSaved={() => { setReviewOpen(false); onRefresh(); }}
        onSnackbar={onSnackbar} />

      <RemediationLinkDialog open={linkOpen} onClose={() => setLinkOpen(false)}
        findingId={detail.findingId} onSnackbar={onSnackbar} />
    </Box>
  );
}

function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1 }}>
      <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray700, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Box>
  );
}

/* ---------- Raise Dialog ---------- */
function RaiseDialog({ open, onClose, onSaved, onSnackbar }) {
  const [form, setForm] = useState({
    findingType: '', severity: '', description: '', rootCause: '',
    linkedObligationId: '', linkedControlId: '',
    assignedToOwnerId: null, remediationDeadline: '',
  });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (body.linkedObligationId) body.linkedObligationId = parseInt(body.linkedObligationId, 10);
      if (body.linkedControlId) body.linkedControlId = parseInt(body.linkedControlId, 10);
      await api.findings.raise(body);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  const reset = () => setForm({ findingType: '', severity: '', description: '', rootCause: '', linkedObligationId: '', linkedControlId: '', assignedToOwnerId: null, remediationDeadline: '' });
  useEffect(() => { if (open) reset(); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Raise New Finding</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Finding type" fullWidth size="small" required value={form.findingType}
              onChange={e => setForm(f => ({ ...f, findingType: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Gap">Gap (no control exists)</MenuItem>
              <MenuItem value="Control Failure">Control failure (test failed)</MenuItem>
              <MenuItem value="Process Weakness">Process weakness</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Severity" fullWidth size="small" required value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} required value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Root cause" fullWidth size="small" multiline minRows={2} value={form.rootCause}
              onChange={e => setForm(f => ({ ...f, rootCause: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Linked Obligation ID" fullWidth size="small" type="number" value={form.linkedObligationId}
              onChange={e => setForm(f => ({ ...f, linkedObligationId: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Linked Control ID" fullWidth size="small" type="number" value={form.linkedControlId}
              onChange={e => setForm(f => ({ ...f, linkedControlId: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <OwnerPicker value={form.assignedToOwnerId}
              onChange={id => setForm(f => ({ ...f, assignedToOwnerId: id }))} label="Assign to" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Remediation deadline" type="date" fullWidth size="small" required
              InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
              onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.findingType || !form.severity || !form.description || !form.remediationDeadline}>
          {saving ? 'Raising...' : 'Raise Finding'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Assign Dialog ---------- */
function AssignDialog({ open, onClose, findingId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ assignedToOwnerId: null, remediationDeadline: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.findings.assign(findingId, {
        assignedToOwnerId: form.assignedToOwnerId,
        remediationDeadline: form.remediationDeadline,
      });
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ assignedToOwnerId: null, remediationDeadline: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign Finding</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <OwnerPicker value={form.assignedToOwnerId}
              onChange={id => setForm(f => ({ ...f, assignedToOwnerId: id }))} label="Assign to" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Remediation deadline" type="date" fullWidth size="small" required
              InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
              onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.assignedToOwnerId || !form.remediationDeadline}>
          {saving ? 'Assigning...' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Remediate Dialog ---------- */
function RemediateDialog({ open, onClose, findingId, onSaved, onSnackbar }) {
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      if (notes) form.append('notes', notes);
      files.forEach((f) => form.append('files', f));
      await api.findings.remediate(findingId, form);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) { setNotes(''); setFiles([]); } }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Remediation</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Use this only when the owner cannot use the remediation link. The evidence is recorded
          on the owner's behalf, and the analyst who records it cannot sign it off.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField label="Remediation notes" fullWidth size="small" multiline minRows={3} value={notes}
              onChange={e => setNotes(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button variant="outlined" component="label" startIcon={<ArrowUpTrayIcon size={16} />}>
              Attach evidence files
              <input hidden type="file" multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={e => setFiles(Array.from(e.target.files || []))} />
            </Button>
            {files.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {files.map(f => f.name).join(', ')}
              </Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Submitting...' : 'Record remediation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Review / Sign-off Dialog ---------- */
function ReviewDialog({ open, onClose, findingId, detail, onSaved, onSnackbar }) {
  const [decision, setDecision] = useState('Accepted');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setDecision('Accepted'); setNotes(''); }
  }, [open]);

  const handleSave = async () => {
    if (decision === 'Rejected' && !notes.trim()) {
      onSnackbar('A reason is required when rejecting.');
      return;
    }
    setSaving(true);
    try {
      await api.findings.review(findingId, decision, notes.trim() || undefined);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };

  const submittedBy = detail?.remediationSubmittedViaLink
    ? `${detail?.assignedToName || 'Owner'} (via link)`
    : (detail?.remediationSubmittedByUserId != null ? 'Analyst (on behalf of owner)' : null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review Remediation</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, p: 1.5, bgcolor: TL.gray50, borderRadius: 1 }}>
          <Typography component="span" sx={SECTION_LABEL_SX}>Submitted remediation</Typography>
          <DetailRow label="Owner" value={detail?.assignedToName || 'Unassigned'} />
          {detail?.remediationSubmittedAt && (
            <DetailRow label="Submitted" value={new Date(detail.remediationSubmittedAt).toLocaleString()} />
          )}
          {submittedBy && <DetailRow label="Submitted by" value={submittedBy} />}
          {detail?.remediationNotes && <DetailRow label="Notes" value={detail.remediationNotes} />}
          <Box sx={{ mt: 1 }}>
            <EvidenceFileList sourceType="finding" sourceId={findingId}
              emptyText="No evidence attached." />
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField select label="Decision" fullWidth size="small" value={decision}
              onChange={e => setDecision(e.target.value)}>
              <MenuItem value="Accepted">Accept — close the finding</MenuItem>
              <MenuItem value="Rejected">Reject — needs more work</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label={decision === 'Rejected' ? 'Reason (required)' : 'Notes (optional)'}
              fullWidth size="small" multiline minRows={3} value={notes}
              onChange={e => setNotes(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={decision === 'Rejected' ? 'error' : 'success'}
          onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : decision === 'Rejected' ? 'Reject' : 'Accept & Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Remediation Link Dialog ---------- */
function RemediationLinkDialog({ open, onClose, findingId, onSnackbar }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLink(null); setCopied(false); setLoading(true);
    api.findings.remediationLink(findingId)
      .then((res) => setLink(res.path ? `${window.location.origin}${res.path}` : res.url))
      .catch((e) => onSnackbar(e.message))
      .finally(() => setLoading(false));
  }, [open, findingId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch { onSnackbar('Copy failed — select the link manually.'); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Remediation Link</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Send this to the owner so they can submit remediation evidence themselves — no account
          needed. It has been emailed to the owner's address on file.
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>
        ) : link ? (
          <TextField fullWidth size="small" label="Link" value={link} onFocus={(e) => e.target.select()}
            slotProps={{ input: { readOnly: true } }} />
        ) : (
          <Alert severity="error">Could not create a link.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={copy} disabled={!link}>{copied ? 'Copied' : 'Copy link'}</Button>
      </DialogActions>
    </Dialog>
  );
}
