import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, Tooltip, Snackbar, Alert as MuiAlert, Link, Grid, Skeleton,
  Stepper, Step, StepLabel, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
} from '@mui/material';
import {
  PageHeader, StatusBadge, RiskBadge, TL,
  ArrowPathIcon, ClockIcon, CheckCircleIcon, LinkIcon, CalendarIcon, CalendarDaysIcon,
  ClipboardDocumentListIcon, ExclamationTriangleIcon, ExclamationCircleIcon,
  PencilSquareIcon, QueueListIcon, DocumentTextIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import EditScheduleDialog from '../components/modals/EditScheduleDialog';
import EventTriggerSetupDialog from '../components/modals/EventTriggerSetupDialog';
import RecordReturnEventDialog from '../components/modals/RecordReturnEventDialog';
import PersonPicker from '../components/common/PersonPicker';
import { Section, Field, FieldGrid, StatTile } from '../components/detailKit';

const SCHEDULE_ROLES = ['CCO', 'TENANT_ADMIN'];
const EVENT_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];

// Must match the backend STAGE_ORDER (ReturnInstanceDetailResponse) — includes Not Started.
const STAGE_NAMES = ['Not Started', 'Data Gathering', 'Draft', 'Review', 'Sign-off', 'Submitted'];
const SIGN_OFF_IDX = STAGE_NAMES.indexOf('Sign-off');
const ESCALATION_ROLE = { 1: 'Analyst', 2: 'Manager', 3: 'CCO' };

const STATUS_TONE = {
  'Not Started': 'gray', 'In Progress': 'blue', 'Submitted': 'green',
  'Submitted Late': 'orange', 'Overdue': 'red',
};
const STATUS_ACCENT = {
  'Not Started': '#718096', 'In Progress': '#3182CE', 'Submitted': '#2D7D46',
  'Submitted Late': '#DD6B20', 'Overdue': '#E53E3E',
};

function statusBadge(status, label) {
  return <StatusBadge label={label || status || 'Not Started'} tone={STATUS_TONE[status] || 'gray'} />;
}
function statusAccent(status) { return STATUS_ACCENT[status] || '#2B6CB0'; }

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isEventDriven(item) {
  const type = (item?.frequencyType || '').toLowerCase().replace(/[\s_-]/g, '');
  if (type === 'eventdriven') return true;
  const f = (item?.frequency || '').toLowerCase().replace(/[\s_-]/g, '');
  return f === 'eventdriven' || f === 'onevent';
}
function noPeriodLabel(item) {
  return isEventDriven(item) ? 'On event' : 'No scheduled period';
}

export default function ReturnsDetailPage() {
  const { returnId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEditSchedule = SCHEDULE_ROLES.includes(user?.role);
  const canRecordEvent = EVENT_ROLES.includes(user?.role);

  const [tab, setTab] = useState(0);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [eventSetupOpen, setEventSetupOpen] = useState(false);
  const [recordEventOpen, setRecordEventOpen] = useState(false);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const itemQuery = useQuery({
    queryKey: ['returns', 'item', String(returnId)],
    queryFn: ({ signal }) => api.returns.get(returnId, { signal }),
  });
  const filingsQuery = useQuery({
    queryKey: ['returns', 'filings', String(returnId)],
    queryFn: ({ signal }) => api.returns.calendar({ returnId, size: 200 }, { signal }),
  });
  const obligationsQuery = useQuery({
    queryKey: ['returns', 'obligations', String(returnId)],
    queryFn: ({ signal }) => api.returns.linkedObligations(returnId, { signal }),
  });

  const item = itemQuery.data;
  const filings = filingsQuery.data?.content || [];

  useEffect(() => {
    if (selectedInstanceId == null && item?.currentInstanceId != null) setSelectedInstanceId(item.currentInstanceId);
  }, [item?.currentInstanceId, selectedInstanceId]);

  const instanceQuery = useQuery({
    queryKey: ['returns', 'detail', String(selectedInstanceId)],
    queryFn: ({ signal }) => api.returns.detail(selectedInstanceId, { signal }),
    enabled: selectedInstanceId != null,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['returns'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }
  function openFiling(instanceId) {
    if (instanceId == null) return;
    setSelectedInstanceId(instanceId);
    setTab(0);
  }

  if (itemQuery.isPending) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }
  if (itemQuery.error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}
        action={<Button size="small" onClick={() => navigate('/returns')}>Back</Button>}>
        {itemQuery.error.message || 'Failed to load this return.'}
      </Alert>
    );
  }

  const detail = instanceQuery.data;
  const obligations = obligationsQuery.data || [];

  return (
    <Box>
      <PageHeader
        title={item.returnName || 'Return'}
        subtitle={(
          <>
            {item.actName || 'No act recorded'}
            {item.filingRegulator && ` · ${item.filingRegulator}`}
            {(item.frequency || item.frequencyType) && ` · ${isEventDriven(item) ? 'On event' : item.frequency}`}
          </>
        )}
        onBack={() => navigate('/returns')}
        backLabel="Back to Returns Register"
        actions={(
          <>
            <Tooltip title="Refresh"><IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton></Tooltip>
            {canEditSchedule && !isEventDriven(item) && (
              <Button variant="outlined" startIcon={<CalendarDaysIcon size={16} />} onClick={() => setScheduleOpen(true)}>
                Edit schedule
              </Button>
            )}
            {canEditSchedule && isEventDriven(item) && (
              <Button variant="outlined" startIcon={<PencilSquareIcon size={16} />} onClick={() => setEventSetupOpen(true)}>
                {item.eventTriggerConfigured ? 'Edit trigger' : 'Configure trigger'}
              </Button>
            )}
            {canRecordEvent && isEventDriven(item) && item.eventTriggerConfigured && (
              <Button variant="contained" startIcon={<CalendarIcon size={16} />} onClick={() => setRecordEventOpen(true)}>
                Record event
              </Button>
            )}
            {canRecordEvent && isEventDriven(item) && item.eventTriggerConfigured && (
              <Button variant="outlined" startIcon={<LinkIcon size={16} />} onClick={() => setSendLinkOpen(true)}>
                Send link
              </Button>
            )}
          </>
        )}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {item.currentStatus && statusBadge(item.currentStatus)}
          <Chip size="small" variant="outlined" label={isEventDriven(item) ? 'On event' : (item.frequency || item.frequencyType || 'Ad hoc')} />
          {item.filingRegulator && <Chip size="small" variant="outlined" label={item.filingRegulator} />}
          {(item.linkedObligationCount ?? 0) === 0 && (
            <Tooltip title="Not linked to any obligation"><span><StatusBadge label="No obligations" tone="amber" /></span></Tooltip>
          )}
        </Box>
      </PageHeader>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Filing" />
        <Tab label={`History${filings.length ? ` (${filings.length})` : ''}`} />
        <Tab label="Details" />
      </Tabs>

      {/* ── Filing (selected current instance) ── */}
      {tab === 0 && (
        instanceQuery.isPending && selectedInstanceId != null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
        ) : selectedInstanceId == null ? (
          <Alert severity="info">
            {isEventDriven(item)
              ? 'No filing yet. Configure the trigger and record an event to create one.'
              : item.dueDateNeeded
                ? 'This return needs a due date before periods can be scheduled.'
                : 'No filing period has been generated yet.'}
          </Alert>
        ) : instanceQuery.error ? (
          <Alert severity="error">{instanceQuery.error.message || 'Failed to load the filing.'}</Alert>
        ) : detail ? (
          <FilingPanel detail={detail} onRefresh={refresh} onSnackbar={setSnackbar}
            noPeriodLabel={noPeriodLabel} />
        ) : null
      )}

      {/* ── History (all periods) ── */}
      {tab === 1 && (
        <HistoryTable filings={filings} isEventDriven={isEventDriven(item)}
          selectedId={selectedInstanceId} onOpen={openFiling} loading={filingsQuery.isPending} />
      )}

      {/* ── Details (schedule + obligations) ── */}
      {tab === 2 && (
        <>
          <Section icon={<CalendarIcon />} title="Schedule">
            <FieldGrid min={160}>
              <Field label="Act" value={item.actName} />
              <Field label="Regulator" value={item.filingRegulator} />
              <Field label="Frequency" value={isEventDriven(item) ? 'On event' : (item.frequency || item.frequencyType)} />
              <Field label="Due rule" value={dueRuleText(item)} />
              <Field label="Start preparing" value={item.prepDays != null ? `${item.prepDays} day(s) before due` : '—'} />
              <Field label="Responsible unit" value={item.responsibleUnit} />
              <Field label="Responsible person" value={item.responsiblePerson} />
              {item.deadlineText && <Field label="Regulator wording" value={item.deadlineText} />}
            </FieldGrid>
          </Section>

          {isEventDriven(item) && (
            <Section icon={<CalendarIcon />} title="Event trigger">
              <FieldGrid min={160}>
                <Field label="Trigger" value={item.eventTriggerLabel} />
                <Field label="Deadline mode" value={item.eventDeadlineMode} />
                <Field label="Deadline" value={item.eventDeadlineDays != null ? `${item.eventDeadlineDays} ${item.eventDeadlineUnit?.toLowerCase() || ''} day(s)` : '—'} />
              </FieldGrid>
            </Section>
          )}

          <Section icon={<LinkIcon />} title={`Linked obligations (${obligations.length})`}>
            {obligations.length === 0 ? (
              <Alert severity="warning">This return is not linked to any obligation — its filing has no documented duty behind it.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Obligation</TableCell>
                      <TableCell sx={{ width: 120 }}>Section</TableCell>
                      <TableCell sx={{ width: 140 }}>Area</TableCell>
                      <TableCell sx={{ width: 110 }}>Risk</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {obligations.map((o, i) => (
                      <TableRow key={o.obligationId ?? i} hover sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/obligations/${o.obligationId}`)}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main' }}>{o.title || o.name || `Obligation #${o.obligationId}`}</Typography>
                          {o.plainEnglishStatement && <Typography variant="caption" color="text.secondary" display="block">{o.plainEnglishStatement}</Typography>}
                        </TableCell>
                        <TableCell>{o.sectionReference ? <Chip size="small" variant="outlined" label={o.sectionReference} sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} /> : '—'}</TableCell>
                        <TableCell>{o.areaOfFocus || '—'}</TableCell>
                        <TableCell><RiskBadge value={o.inherentRiskRating} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Section>
        </>
      )}

      {canEditSchedule && (
        <EditScheduleDialog open={scheduleOpen} item={item}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); setSnackbar('Schedule saved.'); refresh(); }} />
      )}
      {canEditSchedule && (
        <EventTriggerSetupDialog open={eventSetupOpen} item={item}
          onClose={() => setEventSetupOpen(false)}
          onSaved={(instance) => { setEventSetupOpen(false); setSnackbar('Event trigger saved.'); refresh(); if (instance?.instanceId) openFiling(instance.instanceId); }} />
      )}
      <RecordReturnEventDialog open={recordEventOpen} item={item}
        onClose={() => setRecordEventOpen(false)}
        onSaved={(instance) => { setRecordEventOpen(false); setSnackbar('Event filing created.'); refresh(); if (instance?.instanceId) openFiling(instance.instanceId); }} />
      <SendUploadLinkDialog open={sendLinkOpen} item={item}
        onClose={() => setSendLinkOpen(false)} onSnackbar={setSnackbar} />

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}

function dueRuleText(item) {
  if (item.dueDateNeeded) return 'Due date needed';
  if (item.dueRuleType === 'OFFSET') return `${item.daysAfterPeriodEnd} day(s) after period end`;
  if (item.dueRuleType === 'DATE' && item.firstDueDate) return `Fixed — first ${formatDate(item.firstDueDate)}`;
  if (isEventDriven(item)) return 'On event (no schedule)';
  return '—';
}

/* ───────── History table ───────── */
function HistoryTable({ filings, isEventDriven, selectedId, onOpen, loading }) {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (!filings.length) return <Alert severity="info">No filing periods yet.</Alert>;
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell>Due date</TableCell>
            <TableCell>Stage</TableCell>
            <TableCell>Status</TableCell>
            <TableCell sx={{ width: 90 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {filings.map((f) => {
            const st = f.isOverdue && f.status !== 'Submitted' && f.status !== 'Submitted Late' ? 'Overdue' : f.status;
            return (
              <TableRow key={f.instanceId} hover selected={f.instanceId === selectedId}
                sx={{ cursor: 'pointer', bgcolor: f.isOverdue ? '#FFF5F5' : 'inherit' }}
                onClick={() => onOpen(f.instanceId)}>
                <TableCell>
                  {f.triggerDate ? `Event · ${formatDate(f.triggerDate)}` : (f.period || '—')}
                </TableCell>
                <TableCell>
                  {formatDate(f.dueDate)}
                  {f.dueDateAdjusted && <Tooltip title="Moved to the next working day"><span><StatusBadge label="Adjusted" tone="gray" sx={{ ml: 1 }} /></span></Tooltip>}
                </TableCell>
                <TableCell>{f.currentStage || '—'}</TableCell>
                <TableCell>{statusBadge(st)}</TableCell>
                <TableCell>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(f.instanceId); }}>Open</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/* ───────── Filing panel (one instance) ───────── */
function FilingPanel({ detail, onRefresh, onSnackbar, noPeriodLabel }) {
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const isSubmitted = detail.status === 'Submitted' || detail.status === 'Submitted Late';
  const currentStageIdx = (detail.stages || []).findIndex(s => s.current) >= 0
    ? (detail.stages || []).findIndex(s => s.current)
    : STAGE_NAMES.indexOf(detail.currentStage);
  const nextStage = currentStageIdx >= 0 && currentStageIdx < STAGE_NAMES.length - 1
    ? STAGE_NAMES[currentStageIdx + 1] : null;

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatTile icon={<CalendarDaysIcon />} label="Due Date"
          value={detail.dueDate ? formatDate(detail.dueDate) : noPeriodLabel(detail)} />
        <StatTile icon={<CheckCircleIcon />} label="Status" accent={statusAccent(detail.status)}
          chip={statusBadge(detail.status)} />
        <StatTile icon={<ClockIcon />} label="Days Late"
          value={detail.daysLate > 0 ? `${detail.daysLate}` : '—'}
          accent={detail.daysLate > 0 ? '#E53E3E' : '#2D7D46'} />
        <StatTile icon={<ExclamationCircleIcon />} label="Escalation"
          value={detail.escalationLevel > 0 ? `Level ${detail.escalationLevel}` : 'None'}
          accent={detail.escalationLevel > 0 ? '#E53E3E' : '#2B6CB0'} />
      </Box>

      <Section icon={<CalendarIcon />} title="Filing"
        action={detail.currentStage ? <Chip size="small" variant="outlined" label={detail.currentStage} /> : null}>
        <FieldGrid min={160}>
          <Field label="Period" value={detail.period || (isEventDriven(detail) ? 'On event' : '—')} />
          <Field label="Due Date" value={detail.dueDate ? formatDate(detail.dueDate) : '—'} />
          <Field label="Prep Start" value={detail.prepStartDate ? formatDate(detail.prepStartDate) : '—'} />
          <Field label="Filing Channel" value={detail.filingChannel} />
          <Field label="Return Owner" value={detail.returnOwnerName} />
          {detail.deadlineText && <Field label="Regulator Wording" value={detail.deadlineText} />}
        </FieldGrid>
      </Section>

      {(detail.eventTriggerDate || detail.eventTriggerLabel) && (
        <Section icon={<CalendarIcon />} title="Event Trigger">
          <FieldGrid min={160}>
            <Field label="Trigger" value={detail.eventTriggerLabel} />
            <Field label="Trigger Date" value={detail.eventTriggerDate ? formatDate(detail.eventTriggerDate) : '—'} />
            <Field label="Reference" value={detail.eventReference} />
            <Field label="Base Deadline" value={detail.eventUnadjustedDueDate ? formatDate(detail.eventUnadjustedDueDate) : '—'} />
            <Field label="Adjusted">
              {detail.eventDueDateAdjusted
                ? <StatusBadge label="Moved to next working day" tone="gray" />
                : <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>No</Typography>}
            </Field>
            {detail.eventEvidenceFileId && (
              <Field label="Evidence"><EvidenceFileButton fileId={detail.eventEvidenceFileId} /></Field>
            )}
          </FieldGrid>
        </Section>
      )}

      {detail.escalationLevel > 0 && (
        <Section icon={<ExclamationTriangleIcon />} title="Escalation">
          <Alert severity="error">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Escalated · Level {detail.escalationLevel} · {ESCALATION_ROLE[detail.escalationLevel] || 'Management'}
            </Typography>
            {detail.escalatedAt && <Typography variant="caption">Escalated since {formatDate(detail.escalatedAt)}</Typography>}
          </Alert>
        </Section>
      )}

      <Section icon={<QueueListIcon />} title="Stages"
        action={detail.currentStage ? <Chip size="small" variant="outlined" label={detail.currentStage} /> : null}>
        <Stepper activeStep={currentStageIdx} orientation="vertical" sx={{ mb: 2 }}>
          {detail.stages && detail.stages.map((stage, i) => (
            <Step key={i} completed={stage.completed} active={stage.current}>
              <StepLabel optional={
                <Box sx={{ mt: 0.5 }}>
                  {stage.completedAt && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Completed {formatDate(stage.completedAt)}{stage.completedByName && ` by ${stage.completedByName}`}
                    </Typography>
                  )}
                  {stage.evidenceUrl && (
                    <Link href={stage.evidenceUrl} target="_blank" rel="noopener" variant="caption"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                      <LinkIcon size={14} /> Evidence
                    </Link>
                  )}
                  {stage.current && !isSubmitted && i < SIGN_OFF_IDX && (
                    <Box sx={{ mt: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => setAdvanceOpen(true)}>
                        Mark complete → {STAGE_NAMES[i + 1]}
                      </Button>
                    </Box>
                  )}
                  {stage.current && !isSubmitted && i === SIGN_OFF_IDX && (
                    <Box sx={{ mt: 1 }}>
                      <Button size="small" variant="contained" color="success" onClick={() => setSubmitOpen(true)}>
                        Mark as submitted
                      </Button>
                    </Box>
                  )}
                </Box>
              }>{stage.name}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {isSubmitted && detail.submissionEvidenceUrl && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon size={18} sx={{ color: 'success.main' }} />
              Submitted {formatDate(detail.submittedDate)}{detail.daysLate > 0 && ` (${detail.daysLate} days late)`}
            </Typography>
            <Link href={detail.submissionEvidenceUrl} target="_blank" rel="noopener" variant="caption">View submission receipt</Link>
          </Box>
        )}
      </Section>

      {detail.notes && (
        <Section icon={<DocumentTextIcon />} title="Notes">
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.85rem' }}>{detail.notes}</Typography>
        </Section>
      )}

      <AdvanceDialog open={advanceOpen} onClose={() => setAdvanceOpen(false)}
        instanceId={detail.instanceId} stageName={detail.currentStage} nextStageName={nextStage}
        onSaved={() => { setAdvanceOpen(false); onRefresh(); }} onSnackbar={onSnackbar} />
      <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)}
        instanceId={detail.instanceId}
        onSaved={() => { setSubmitOpen(false); onRefresh(); }} onSnackbar={onSnackbar} />
    </Box>
  );
}

function AdvanceDialog({ open, onClose, instanceId, stageName, nextStageName, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ evidenceUrl: '', completedByName: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try { await api.returns.advance(instanceId, form); onSaved(); }
    catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ evidenceUrl: '', completedByName: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Advance Stage</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Mark "{stageName}" complete and advance to "{nextStageName}"
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}><TextField label="Evidence URL (optional)" fullWidth size="small" value={form.evidenceUrl}
            onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="Completed by name" fullWidth size="small" value={form.completedByName}
            onChange={e => setForm(f => ({ ...f, completedByName: e.target.value }))} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Advancing...' : `Advance to ${nextStageName}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SubmitDialog({ open, onClose, instanceId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ evidenceUrl: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try { await api.returns.submit(instanceId, form); onSaved(); }
    catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ evidenceUrl: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as Submitted</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>After filing on the regulator portal, upload the submission receipt.</Typography>
        <TextField label="Submission evidence URL" fullWidth size="small" value={form.evidenceUrl}
          onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" onClick={handleSave} disabled={saving}>
          {saving ? 'Submitting...' : 'Mark as Submitted'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ───────── Send upload link (public event filing) ───────── */
function SendUploadLinkDialog({ open, item, onClose, onSnackbar }) {
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setEmail(''); setLink(''); setCopied(false); setError(''); }
  }, [open]);

  if (!item) return null;

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await api.returns.createUploadLink(item.returnId, { recipientEmail: email.trim() || undefined });
      setLink(res.path ? `${window.location.origin}${res.path}` : res.url);
    } catch (e) { setError(e.message); } finally { setCreating(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { onSnackbar('Copy failed — select the link manually.'); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send event-filing upload link</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create a secure link the owner can use to record an event filing for
          <strong> {item.returnName}</strong> and attach evidence, without signing in.
        </Typography>
        <PersonPicker mode="link" label="Recipient (optional — defaults to the return owner)"
          value={email} onChange={(v) => setEmail(v || '')} disabled={!!link} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {link && (
          <TextField fullWidth size="small" label="Link" value={link} onFocus={e => e.target.select()}
            slotProps={{ input: { readOnly: true } }} sx={{ mt: 2 }} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {link
          ? <Button variant="contained" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
          : <Button variant="contained" onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create link'}</Button>}
      </DialogActions>
    </Dialog>
  );
}

function EvidenceFileButton({ fileId }) {
  const query = useQuery({ queryKey: ['evidence', String(fileId)], queryFn: ({ signal }) => api.evidence.detail(fileId, { signal }) });
  const [error, setError] = useState('');
  async function download() {
    setError('');
    try {
      const file = await api.evidence.download(fileId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url; link.download = file.name; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || 'Evidence download failed'); }
  }
  return <Tooltip title={error || query.data?.originalName || 'Download trigger evidence'}><Button size="small" onClick={download} disabled={query.isPending || query.isError}>{query.isPending ? 'Loading…' : 'Evidence file'}</Button></Tooltip>;
}
