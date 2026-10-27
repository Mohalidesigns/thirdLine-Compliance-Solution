import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton, Tooltip,
  Snackbar, Alert as MuiAlert, Tabs, Tab, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  PageHeader, ArrowPathIcon, CalendarDaysIcon, CalendarIcon, PencilSquareIcon, LinkIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import EditScheduleDialog from '../components/modals/EditScheduleDialog';
import ReturnEscalationPolicyDialog from '../components/returns/ReturnEscalationPolicyDialog';
import EventTriggerSetupDialog from '../components/modals/EventTriggerSetupDialog';
import RecordReturnEventDialog from '../components/modals/RecordReturnEventDialog';
import ReturnDetailsCard from '../components/returns/ReturnDetailsCard';
import ReturnFilingPanel from '../components/returns/ReturnFilingPanel';
import ReturnHistoryTable from '../components/returns/ReturnHistoryTable';
import PersonPicker from '../components/common/PersonPicker';
import {
  statusBadge, isEventDriven, formatDate, needsAction, isCompletedStatus, SCHEDULE_ROLES, EVENT_ROLES,
} from '../components/returns/returnCommon';

const TAB_NAMES = ['filings', 'history'];

export default function ReturnsDetailPage() {
  const { returnId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canEditSchedule = SCHEDULE_ROLES.includes(user?.role);
  const canRecordEvent = EVENT_ROLES.includes(user?.role);

  const tabParam = searchParams.get('tab');
  const instanceParam = searchParams.get('instanceId');
  const reviewParam = searchParams.get('review');

  const [tab, setTab] = useState(() => (TAB_NAMES.includes(tabParam) ? TAB_NAMES.indexOf(tabParam) : 0));
  const [selectedInstanceId, setSelectedInstanceId] = useState(instanceParam ? Number(instanceParam) : null);
  const [highlightReview, setHighlightReview] = useState(!!reviewParam);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [eventSetupOpen, setEventSetupOpen] = useState(false);
  const [recordEventOpen, setRecordEventOpen] = useState(false);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
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
  const escalationQuery = useQuery({
    queryKey: ['returns', 'escalation', String(returnId)],
    queryFn: ({ signal }) => api.returns.escalation(returnId, { signal }),
  });

  const item = itemQuery.data;
  const escalation = escalationQuery.data;
  const filings = filingsQuery.data?.content || [];

  const instanceQuery = useQuery({
    queryKey: ['returns', 'detail', String(selectedInstanceId)],
    queryFn: ({ signal }) => api.returns.detail(selectedInstanceId, { signal }),
    enabled: selectedInstanceId != null,
  });

  // Deep link: a task opens the filing it points at, on the Filings tab.
  useEffect(() => {
    if (instanceParam) {
      const id = Number(instanceParam);
      if (!Number.isNaN(id) && id !== selectedInstanceId) setSelectedInstanceId(id);
      setTab(0);
      setHighlightReview(!!reviewParam);
    }
  }, [instanceParam, reviewParam, selectedInstanceId]);

  // Default selection: a filing awaiting review comes first (someone is waiting on us), else the
  // return's current period.
  const defaultInstanceId = useMemo(() => {
    const awaiting = filings.find((f) => f.pendingReview);
    return awaiting?.instanceId ?? item?.currentInstanceId ?? null;
  }, [filings, item?.currentInstanceId]);

  useEffect(() => {
    if (selectedInstanceId == null && !instanceParam && defaultInstanceId != null) {
      setSelectedInstanceId(defaultInstanceId);
    }
  }, [defaultInstanceId, selectedInstanceId, instanceParam]);

  const writeParams = useCallback(({ tabIdx, instanceId, keepReview }) => {
    const next = new URLSearchParams();
    if (tabIdx === 1) next.set('tab', 'history');
    if (instanceId != null) next.set('instanceId', String(instanceId));
    if (keepReview && reviewParam) next.set('review', reviewParam);
    setSearchParams(next, { replace: true });
  }, [reviewParam, setSearchParams]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['returns'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  function openFiling(instanceId) {
    if (instanceId == null) return;
    setSelectedInstanceId(instanceId);
    setHighlightReview(false);
    setTab(0);
    writeParams({ tabIdx: 0, instanceId });
  }

  // History is the closed record: filings the CCO has accepted (completed). Anything still in flight —
  // open, awaiting review, rejected back to Draft — lives in the Filings tab.
  const closedFilings = useMemo(() => filings.filter((f) => isCompletedStatus(f.status)), [filings]);

  // Period switcher: the filing the user must act on first, then the other periods needing action.
  const actionPeriods = useMemo(() => {
    const flagged = filings.filter((f) => needsAction(f, escalation));
    const ordered = [...flagged].sort((a, b) => {
      if (a.instanceId === item?.currentInstanceId) return -1;
      if (b.instanceId === item?.currentInstanceId) return 1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
    return ordered.map((f) => ({
      instanceId: f.instanceId,
      label: `${f.triggerDate ? `Event ${formatDate(f.triggerDate)}` : (f.period || 'No period')}`
        + ` · due ${formatDate(f.dueDate)} · ${f.pendingReview ? 'awaiting review' : (f.currentStage || 'Not started')}`,
    }));
  }, [filings, escalation, item?.currentInstanceId]);

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
  const eventDriven = isEventDriven(item);

  return (
    <Box>
      <PageHeader
        title={item.returnName || 'Return'}
        subtitle={(
          <>
            {item.actName || 'No act recorded'}
            {item.filingRegulator && ` · ${item.filingRegulator}`}
            {(item.frequency || item.frequencyType) && ` · ${eventDriven ? 'On event' : item.frequency}`}
          </>
        )}
        onBack={() => navigate('/returns')}
        backLabel="Back to Returns Register"
        actions={(
          <>
            <Tooltip title="Refresh"><IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton></Tooltip>
            {canEditSchedule && !eventDriven && (
              <Button variant="outlined" startIcon={<CalendarDaysIcon size={16} />} onClick={() => setScheduleOpen(true)}>
                Edit schedule
              </Button>
            )}
            {canEditSchedule && eventDriven && (
              <Button variant="outlined" startIcon={<PencilSquareIcon size={16} />} onClick={() => setEventSetupOpen(true)}>
                {item.eventTriggerConfigured ? 'Edit trigger' : 'Configure trigger'}
              </Button>
            )}
            {canRecordEvent && eventDriven && item.eventTriggerConfigured && (
              <Button variant="contained" startIcon={<CalendarIcon size={16} />} onClick={() => setRecordEventOpen(true)}>
                Record event
              </Button>
            )}
            {canRecordEvent && eventDriven && item.eventTriggerConfigured && (
              <Button variant="outlined" startIcon={<LinkIcon size={16} />} onClick={() => setSendLinkOpen(true)}>
                Send link
              </Button>
            )}
          </>
        )}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {item.currentStatus && statusBadge(item.hasOverdue ? 'Overdue' : item.currentStatus)}
          <Chip size="small" variant="outlined" label={eventDriven ? 'On event' : (item.frequency || item.frequencyType || 'Ad hoc')} />
          {item.filingRegulator && <Chip size="small" variant="outlined" label={item.filingRegulator} />}
        </Box>
      </PageHeader>

      <ReturnDetailsCard
        item={item}
        obligations={obligations}
        obligationsLoading={obligationsQuery.isPending}
        escalation={escalation}
        escalationLoading={escalationQuery.isPending}
        onEditEscalation={() => setPolicyOpen(true)}
      />

      <Tabs value={tab} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        onChange={(_, v) => { setTab(v); writeParams({ tabIdx: v, instanceId: selectedInstanceId, keepReview: true }); }}>
        <Tab label={`Filings${actionPeriods.length ? ` (${actionPeriods.length})` : ''}`} />
        <Tab label={`History${closedFilings.length ? ` (${closedFilings.length})` : ''}`} />
      </Tabs>

      {tab === 0 && (
        instanceQuery.isPending && selectedInstanceId != null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
        ) : selectedInstanceId == null ? (
          <Alert severity="info">
            {eventDriven
              ? 'No filing yet. Configure the trigger and record an event to create one.'
              : item.dueDateNeeded
                ? 'This return needs a due date before periods can be scheduled.'
                : 'No filing period has been generated yet.'}
          </Alert>
        ) : instanceQuery.error ? (
          <Alert severity="error">{instanceQuery.error.message || 'Failed to load the filing.'}</Alert>
        ) : detail ? (
          <ReturnFilingPanel detail={detail} item={item} periods={actionPeriods}
            onSelectPeriod={openFiling} onRefresh={refresh} onSnackbar={setSnackbar}
            highlight={highlightReview} />
        ) : null
      )}

      {tab === 1 && (
        <ReturnHistoryTable filings={closedFilings} selectedId={selectedInstanceId}
          onOpen={openFiling} loading={filingsQuery.isPending} />
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
      {policyOpen && <ReturnEscalationPolicyDialog open item={item} onClose={() => setPolicyOpen(false)}
        onSnackbar={setSnackbar} onSaved={() => { setSnackbar('Escalation policy saved.'); refresh(); }} />}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
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
          <TextField fullWidth size="small" label="Link" value={link} onFocus={(e) => e.target.select()}
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
