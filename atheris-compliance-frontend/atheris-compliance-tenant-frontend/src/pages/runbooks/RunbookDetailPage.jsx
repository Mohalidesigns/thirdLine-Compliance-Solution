import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem,
  Snackbar, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BlockIcon from '@mui/icons-material/Block';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  DetailHeader, SectionTabs, TL, StatusBadge,
  PencilSquareIcon, CheckCircleIcon, CalendarDaysIcon, ArrowDownTrayIcon, TrashIcon, EllipsisVerticalIcon,
  LinkIcon, ScaleIcon, ShieldCheckIcon, DocumentTextIcon, ClockIcon, ArrowPathIcon, ClipboardDocumentCheckIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import { Section, Field, FieldGrid, CARD_SX } from '../../components/detailKit';
import {
  RunbookStatusBadge, CriticalityBadge, ExecStatusBadge, CodeChip, formatDateTime, errMsg,
} from '../../components/runbooks/LibraryBadges';
import { StepsView, PrerequisitesView, EscalationRollbackView } from '../../components/runbooks/DetailVersionView';
import StartExecutionDialog from '../../components/runbooks/StartExecutionDialog';
import PublishVersionDialog from '../../components/runbooks/PublishVersionDialog';
import ScheduleRunbookDialog from '../../components/runbooks/ScheduleRunbookDialog';
import MapClausesDialog from '../../components/runbooks/MapClausesDialog';
import VersionDiffDialog from '../../components/runbooks/VersionDiffDialog';
import { CloneRunbookDialog, RetireRunbookDialog, ConfirmDialog } from '../../components/runbooks/DetailActionDialogs';
import LinkObligationsPicker from '../../components/modals/LinkObligationsPicker';
import LinkControlsPicker from '../../components/modals/LinkControlsPicker';
import {
  CATEGORIES, FREQUENCIES, AUTHOR_ROLES, APPROVER_ROLES, EXECUTOR_ROLES, label, humanize, formatMinutes,
} from './runbookConstants';

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d)
    : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DIRECT_PUBLISH = ['LOW', 'MEDIUM'];

function ChipRow({ items, empty = 'None' }) {
  if (!items?.length) return <Typography variant="body2" color="text.secondary">{empty}</Typography>;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {items.map((t) => <Chip key={t} size="small" label={t} sx={{ height: 22 }} />)}
    </Box>
  );
}

function EmptyText({ children }) {
  return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{children}</Typography>;
}

/** Thin bordered table wrapper in the register look (max 5 data columns + optional actions). */
function PlainTable({ head, children }) {
  return (
    <Box sx={{ ...CARD_SX, overflow: 'hidden' }}>
      <Table size="small">
        <TableHead><TableRow>{head}</TableRow></TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </Box>
  );
}

export default function RunbookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role;
  const canAuthor = AUTHOR_ROLES.includes(role);
  const canApprove = APPROVER_ROLES.includes(role);
  const canExecute = EXECUTOR_ROLES.includes(role);

  const [tab, setTab] = useState('overview');
  const [snack, setSnack] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [dialog, setDialog] = useState(null); // 'execute'|'publish'|'schedule'|'clauses'|'obligations'|'controls'|'clone'|'deprecate'|'archive'|'delete'|'deleteSchedule'|'diff'
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [diffPair, setDiffPair] = useState(null);

  const key = ['runbook', String(id)];

  const detailQuery = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.runbooks.get(id, { signal }),
  });
  const rb = detailQuery.data;

  // Load the draft tree up front too, so the Steps / Prerequisites tab counts are known.
  const needsTree = true;
  const draftTreeQuery = useQuery({
    queryKey: ['runbook', String(id), 'version', String(rb?.draftVersionId)],
    queryFn: ({ signal }) => api.runbooks.versions.get(id, rb.draftVersionId, { signal }),
    enabled: !!rb && !rb.currentVersion && rb.draftVersionId != null && needsTree,
  });
  const versionsQuery = useQuery({
    queryKey: ['runbook', String(id), 'versions'],
    queryFn: ({ signal }) => api.runbooks.versions.list(id, { signal }),
    enabled: !!rb && tab === 'versions',
  });

  const showingDraft = !!rb && !rb.currentVersion;
  const tree = rb?.currentVersion || draftTreeQuery.data || null;

  const clausesById = useMemo(
    () => new Map((rb?.clauses || []).map((c) => [c.clauseId, c])),
    [rb?.clauses],
  );
  const stepCount = useMemo(
    () => (tree?.sections || []).reduce((n, s) => n + (s.steps?.length || 0), 0),
    [tree],
  );

  const notify = (msg, severity = 'success') => setSnack({ msg, severity });
  const closeDialog = () => { setDialog(null); action.reset(); };

  // One mutation for every simple action; each call says what to run, the toast and what follows.
  const action = useMutation({
    mutationFn: ({ fn }) => fn(),
    onSuccess: (res, vars) => {
      if (vars.removed) {
        queryClient.removeQueries({ queryKey: key });
      } else {
        queryClient.invalidateQueries({ queryKey: key });
      }
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      if (vars.msg) notify(vars.msg);
      if (vars.closeDialog !== false) setDialog(null);
      vars.after?.(res);
    },
    onError: (e, vars) => {
      if (vars.onError) { vars.onError(e); return; }
      // Errors from dialog-hosted actions render inside the dialog; others toast.
      if (!vars.inDialog) notify(errMsg(e), 'error');
    },
  });
  const run = (vars) => action.mutate(vars);

  if (detailQuery.isPending) {
    return (
      <Box>
        <RunbooksNav />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      </Box>
    );
  }
  if (detailQuery.error || !rb) {
    return (
      <Box>
        <RunbooksNav />
        <Alert severity="error" sx={{ mb: 2 }}>{detailQuery.error?.message || 'Runbook not found.'}</Alert>
        <Button onClick={() => navigate('/runbooks')}>Back to Runbook Library</Button>
      </Box>
    );
  }

  const status = rb.status;
  const retired = status === 'DEPRECATED' || status === 'ARCHIVED';
  const hasDraft = rb.draftVersionId != null;
  const directPublish = DIRECT_PUBLISH.includes(rb.criticality);
  const hasExecutions = (rb.recentExecutions?.length || 0) > 0 || !!rb.lastExecutionAt;

  const can = {
    execute: canExecute && rb.currentVersionId != null && !retired,
    edit: canAuthor && !retired,
    publish: canApprove && hasDraft && directPublish && !retired,
    submit: canAuthor && hasDraft && rb.draftVersionStatus === 'DRAFT' && !retired,
    reviewApproval: canApprove && hasDraft && rb.draftVersionStatus === 'IN_REVIEW' && !directPublish,
    schedule: canApprove && rb.currentVersionId != null && !retired,
    clone: canAuthor,
    deprecate: canApprove && (status === 'PUBLISHED' || status === 'IN_REVIEW'),
    archive: canApprove && status === 'DEPRECATED',
    remove: canApprove && status === 'DRAFT' && !hasExecutions,
    link: canAuthor && status !== 'ARCHIVED',
  };

  const openEditor = () => {
    if (hasDraft) { navigate(`/runbooks/${id}/edit`); return; }
    run({
      fn: () => api.runbooks.versions.createDraft(id),
      msg: 'New draft version created.',
      after: () => navigate(`/runbooks/${id}/edit`),
      // 409 = an open draft already exists (stale page) — just open the builder.
      onError: (e) => {
        if (/409|draft/i.test(e?.message || '')) navigate(`/runbooks/${id}/edit`);
        else notify(errMsg(e), 'error');
      },
    });
  };

  const exportJson = () => {
    setMenuAnchor(null);
    api.runbooks.exportJson(id)
      .then(() => notify('Runbook exported as JSON.'))
      .catch((e) => notify(errMsg(e, 'Export failed.'), 'error'));
  };

  const saveLinks = (patch) => run({
    fn: () => api.runbooks.setLinks(id, {
      obligationIds: rb.linkedObligationIds || [],
      controlIds: rb.linkedControlIds || [],
      ...patch,
    }),
    msg: 'Links updated.',
  });

  /* ───────── header ───────── */

  const meta = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <CodeChip label={rb.runbookCode} />
      <RunbookStatusBadge status={status} />
      {rb.currentVersionNumber != null && (
        <StatusBadge label={`v${rb.currentVersionNumber}`} tone="blue" title="Published version" />
      )}
      <CriticalityBadge value={rb.criticality} />
      <StatusBadge label={label(FREQUENCIES, rb.frequency)} tone="gray" />
      <StatusBadge label={label(CATEGORIES, rb.category)} tone="teal" />
      <Typography variant="body2" sx={{ color: TL.gray500 }}>
        Owner: <b>{rb.ownerName || 'Unassigned'}</b>
        {' · '}SLA: <b>{rb.slaMinutes != null ? formatMinutes(rb.slaMinutes) : 'none'}</b>
        {rb.sourceTemplateCode && (
          <> · From template <b>{rb.sourceTemplateCode}</b>{rb.sourceTemplateVersion != null ? ` v${rb.sourceTemplateVersion}` : ''}</>
        )}
      </Typography>
    </Box>
  );

  const menuItems = [
    can.clone && { key: 'clone', label: 'Clone', icon: <ContentCopyIcon fontSize="small" />, onClick: () => setDialog('clone') },
    { key: 'export', label: 'Export JSON', icon: <ArrowDownTrayIcon size={18} />, onClick: exportJson },
    can.submit && can.publish && {
      key: 'submit', label: 'Submit for approval', icon: <SendOutlinedIcon fontSize="small" />,
      onClick: () => run({ fn: () => api.runbooks.versions.submit(id, rb.draftVersionId), msg: 'Submitted for approval.' }),
    },
    can.deprecate && { key: 'deprecate', label: 'Deprecate', icon: <BlockIcon fontSize="small" />, onClick: () => setDialog('deprecate') },
    can.archive && { key: 'archive', label: 'Archive', icon: <ArchiveOutlinedIcon fontSize="small" />, onClick: () => setDialog('archive') },
    can.remove && { key: 'delete', label: 'Delete', icon: <TrashIcon size={18} />, onClick: () => setDialog('delete'), danger: true },
  ].filter(Boolean);

  const right = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Tooltip title="Refresh">
        <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: key })}><ArrowPathIcon size={18} /></IconButton>
      </Tooltip>
      {can.edit && (
        <Button variant="outlined" startIcon={<PencilSquareIcon size={16} />} onClick={openEditor} disabled={action.isPending}>
          {hasDraft ? 'Edit draft' : 'Edit'}
        </Button>
      )}
      {can.publish && (
        <Button variant="outlined" color="success" startIcon={<CheckCircleIcon size={16} />} onClick={() => setDialog('publish')}>
          Publish
        </Button>
      )}
      {can.submit && !can.publish && (
        <Button variant="outlined" startIcon={<SendOutlinedIcon fontSize="small" />} disabled={action.isPending}
          onClick={() => run({ fn: () => api.runbooks.versions.submit(id, rb.draftVersionId), msg: 'Submitted for approval.' })}>
          Submit for approval
        </Button>
      )}
      {can.reviewApproval && (
        <Button variant="outlined" startIcon={<ClipboardDocumentCheckIcon size={16} />} onClick={() => navigate('/runbooks/approvals')}>
          Review approval
        </Button>
      )}
      {can.schedule && (
        <Button variant="outlined" startIcon={<CalendarDaysIcon size={16} />}
          onClick={() => { setEditingSchedule(null); setDialog('schedule'); }}>
          Schedule
        </Button>
      )}
      {can.execute && (
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => setDialog('execute')}>
          Execute
        </Button>
      )}
      <IconButton aria-label="More actions" onClick={(e) => setMenuAnchor(e.currentTarget)}>
        <EllipsisVerticalIcon size={20} />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {menuItems.map((m) => (
          <MenuItem key={m.key} onClick={() => { setMenuAnchor(null); m.onClick(); }} sx={m.danger ? { color: 'error.main' } : undefined}>
            <ListItemIcon sx={m.danger ? { color: 'error.main' } : undefined}>{m.icon}</ListItemIcon>
            <ListItemText>{m.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );

  /* ───────── tabs ───────── */

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'steps', label: 'Steps', count: tree ? stepCount : undefined },
    { key: 'prereqs', label: 'Prerequisites', count: tree ? (tree.prerequisites?.length || 0) : undefined },
    { key: 'escalation', label: 'Escalation & Rollback' },
    { key: 'mapping', label: 'Framework Mapping', count: rb.clauses?.length || 0 },
    { key: 'versions', label: 'Versions', count: versionsQuery.data?.length },
    { key: 'executions', label: 'Executions', count: rb.recentExecutions?.length || 0 },
    { key: 'schedule', label: 'Schedule', count: rb.schedules?.length || 0 },
  ];

  const treeState = () => {
    if (tree) return null;
    if (!rb.draftVersionId) return <EmptyText>No content yet — open the builder to add steps.</EmptyText>;
    if (draftTreeQuery.isPending) return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
    if (draftTreeQuery.error) return <Alert severity="error">{draftTreeQuery.error.message}</Alert>;
    return <EmptyText>No content.</EmptyText>;
  };

  const draftNote = showingDraft && tree && (
    <Alert severity="info" sx={{ mb: 2 }}>
      This runbook has never been published — showing the <b>{humanize(tree.status)}</b> version v{tree.versionNumber}.
    </Alert>
  );

  const overview = (
    <>
      <Section icon={<DocumentTextIcon />} title="Objective">
        <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: rb.objective ? TL.gray700 : TL.gray400, fontStyle: rb.objective ? 'normal' : 'italic' }}>
          {rb.objective || 'No objective recorded.'}
        </Typography>
      </Section>
      <Section icon={<ClockIcon />} title="Details">
        <FieldGrid>
          <Field label="Category" value={label(CATEGORIES, rb.category)} />
          <Field label="Frequency" value={label(FREQUENCIES, rb.frequency)} />
          <Field label="SLA" value={rb.slaMinutes != null ? formatMinutes(rb.slaMinutes) : 'None'} />
          <Field label="Owner" value={rb.ownerName || 'Unassigned'} />
          <Field label="Review cadence" value={rb.reviewCadence ? label(FREQUENCIES, rb.reviewCadence) : '—'} />
          <Field label="Next review">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{formatDate(rb.nextReviewAt)}</Typography>
              {rb.needsReview && <StatusBadge label="Review due" tone="orange" />}
            </Box>
          </Field>
          <Field label="Next run" value={rb.nextRunAt ? formatDateTime(rb.nextRunAt) : '—'} />
          <Field label="Template" value={rb.sourceTemplateCode
            ? `${rb.sourceTemplateCode}${rb.sourceTemplateVersion != null ? ` v${rb.sourceTemplateVersion}` : ''}` : 'Custom'} />
          <Field label="Created" value={formatDate(rb.createdAt)} />
          <Field label="Updated" value={formatDate(rb.updatedAt)} />
        </FieldGrid>
      </Section>
      <Section icon={<ShieldCheckIcon />} title="Scope">
        <FieldGrid min={220}>
          <Field label="Systems"><ChipRow items={rb.scopeSystems} /></Field>
          <Field label="Teams"><ChipRow items={rb.scopeTeams} /></Field>
          <Field label="Tags"><ChipRow items={rb.tags} /></Field>
        </FieldGrid>
      </Section>
      {renderLinks()}
    </>
  );

  function renderLinks() {
    const obligations = rb.linkedObligations || [];
    const controls = rb.linkedControls || [];
    return (
      <Section icon={<LinkIcon />} title="Linked obligations & controls"
        subtitle={`${obligations.length} obligation${obligations.length !== 1 ? 's' : ''} · ${controls.length} control${controls.length !== 1 ? 's' : ''}`}
        action={can.link && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => setDialog('obligations')}>Link obligations</Button>
            <Button size="small" onClick={() => setDialog('controls')}>Link controls</Button>
          </Box>
        )}>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Obligations
        </Typography>
        {obligations.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No obligations linked.</Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {obligations.map((o) => (
              <Box key={o.obligationId} onClick={() => navigate(`/obligations/${o.obligationId}`)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, cursor: 'pointer', borderBottom: `1px solid ${TL.gray100}`, '&:hover .t': { textDecoration: 'underline' } }}>
                <ScaleIcon size={16} sx={{ color: TL.gray400 }} />
                <Typography className="t" variant="body2" sx={{ color: 'primary.main', fontWeight: 500, flex: 1, minWidth: 0 }} noWrap>
                  {o.title || `Obligation #${o.obligationId}`}
                </Typography>
                <CodeChip label={o.sectionReference} />
              </Box>
            ))}
          </Box>
        )}
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Controls
        </Typography>
        {controls.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No controls linked.</Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {controls.map((c) => (
              <Tooltip key={c.controlId} title={c.name || ''}>
                <Chip size="small" icon={<ShieldCheckIcon size={14} />}
                  label={`${c.controlNumber || `#${c.controlId}`}${c.name ? ` — ${c.name}` : ''}`}
                  sx={{ maxWidth: 360 }} />
              </Tooltip>
            ))}
          </Box>
        )}
      </Section>
    );
  }

  const mapping = (
    <>
      <Section icon={<ScaleIcon />} title="Framework clauses"
        subtitle={`${rb.clauses?.length || 0} clause${(rb.clauses?.length || 0) !== 1 ? 's' : ''} mapped`}
        action={can.link && <Button size="small" onClick={() => setDialog('clauses')}>Map clauses</Button>}
        contentSx={{ p: 0 }}>
        {(rb.clauses || []).length === 0 ? (
          <EmptyText>No clauses mapped — runbooks without clauses do not count towards coverage.</EmptyText>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Framework</TableCell>
                <TableCell>Clause</TableCell>
                <TableCell>Domain</TableCell>
                <TableCell>Deadline</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rb.clauses.map((c) => (
                <TableRow key={c.clauseId}>
                  <TableCell><Chip size="small" label={c.frameworkCode} sx={{ height: 22 }} /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeChip label={c.clauseRef} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{c.title || '—'}</Typography>
                    </Box>
                    {c.requirementText && (
                      <Tooltip title={c.requirementText}>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 520 }}>
                          {c.requirementText}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell><Typography variant="body2">{c.domain || '—'}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.deadlineRule || (c.slaMinutes != null ? formatMinutes(c.slaMinutes) : '—')}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      {renderLinks()}
    </>
  );

  const versionsTab = () => {
    if (versionsQuery.isPending) return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
    if (versionsQuery.error) return <Alert severity="error">{versionsQuery.error.message}</Alert>;
    const versions = [...(versionsQuery.data || [])].sort((a, b) => b.versionNumber - a.versionNumber);
    if (!versions.length) return <EmptyText>No versions yet.</EmptyText>;
    return (
      <PlainTable head={(
        <>
          <TableCell>Version</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Author</TableCell>
          <TableCell>Approved / published</TableCell>
          <TableCell>Steps</TableCell>
          <TableCell align="right" sx={{ width: 90 }}>Diff</TableCell>
        </>
      )}>
        {versions.map((v, i) => {
          const prev = versions[i + 1];
          return (
            <TableRow key={v.versionId} hover>
              <TableCell sx={{ maxWidth: 380 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: TL.mono }}>v{v.versionNumber}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap title={v.changeSummary || ''}>
                  {v.changeSummary || 'No change summary'}
                </Typography>
              </TableCell>
              <TableCell><RunbookStatusBadge status={v.status} /></TableCell>
              <TableCell>
                <Typography variant="body2">{v.authoredByName || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{formatDate(v.createdAt)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{v.approvedByName || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {v.publishedAt ? `Published ${formatDate(v.publishedAt)}` : (v.approvedAt ? `Approved ${formatDate(v.approvedAt)}` : '')}
                </Typography>
              </TableCell>
              <TableCell><Typography variant="body2">{v.stepCount ?? '—'}</Typography></TableCell>
              <TableCell align="right">
                {prev ? (
                  <Button size="small" onClick={() => { setDiffPair({ from: prev.versionId, to: v.versionId }); setDialog('diff'); }}>
                    vs v{prev.versionNumber}
                  </Button>
                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
              </TableCell>
            </TableRow>
          );
        })}
      </PlainTable>
    );
  };

  const executionsTab = (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Most recent executions (up to 5).</Typography>
        <Button size="small" onClick={() => navigate(`/runbooks/executions?runbookId=${id}`)}>View all executions</Button>
      </Box>
      {(rb.recentExecutions || []).length === 0 ? (
        <EmptyText>This runbook has not been executed yet.</EmptyText>
      ) : (
        <PlainTable head={(
          <>
            <TableCell>Execution</TableCell>
            <TableCell>Operator</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Progress</TableCell>
            <TableCell>Started / due</TableCell>
          </>
        )}>
          {rb.recentExecutions.map((e) => (
            <TableRow key={e.executionId} hover sx={{ cursor: 'pointer' }}
              onClick={() => navigate(`/runbooks/executions/${e.executionId}`)}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CodeChip label={e.executionRef || `#${e.executionId}`} />
                  {e.versionNumber != null && <Typography variant="caption" sx={{ fontFamily: TL.mono, color: TL.gray500 }}>v{e.versionNumber}</Typography>}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {humanize(e.triggerType)}{e.triggerRefId != null ? ` #${e.triggerRefId}` : ''}
                </Typography>
              </TableCell>
              <TableCell><Typography variant="body2">{e.operatorName || '—'}</Typography></TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ExecStatusBadge status={e.status} />
                  {e.overdue && <StatusBadge label="Overdue" tone="red" />}
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{e.stepsPassed ?? 0}/{e.stepsTotal ?? 0} passed</Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.stepsFailed ? `${e.stepsFailed} failed · ` : ''}{e.evidenceCount ?? 0} evidence
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{formatDateTime(e.startedAt || e.createdAt)}</Typography>
                <Typography variant="caption" color="text.secondary">{e.dueAt ? `Due ${formatDateTime(e.dueAt)}` : 'No due date'}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </PlainTable>
      )}
    </>
  );

  const scheduleTab = (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Recurring runs create executions ahead of the run date.</Typography>
        {can.schedule && (
          <Button size="small" variant="outlined" startIcon={<CalendarDaysIcon size={16} />}
            onClick={() => { setEditingSchedule(null); setDialog('schedule'); }}>
            Add schedule
          </Button>
        )}
      </Box>
      {(rb.schedules || []).length === 0 ? (
        <EmptyText>No schedules.{rb.currentVersionId == null ? ' Publish a version before scheduling.' : ''}</EmptyText>
      ) : (
        <PlainTable head={(
          <>
            <TableCell>Frequency</TableCell>
            <TableCell>Next run</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>Options</TableCell>
            <TableCell>Status</TableCell>
            {canApprove && <TableCell align="right" sx={{ width: 110 }}>Actions</TableCell>}
          </>
        )}>
          {rb.schedules.map((s) => (
            <TableRow key={s.scheduleId} hover>
              <TableCell>
                <Typography variant="body2">{label(FREQUENCIES, s.frequency)}</Typography>
                {s.timezone && <Typography variant="caption" color="text.secondary">{s.timezone}</Typography>}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{formatDateTime(s.nextRunAt)}</Typography>
                <Typography variant="caption" color="text.secondary">{s.lastRunAt ? `Last ${formatDate(s.lastRunAt)}` : 'Never run'}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{s.assigneeName || 'Runbook owner'}</Typography>
                {s.assigneeRole && <Typography variant="caption" color="text.secondary">{humanize(s.assigneeRole)}</Typography>}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{s.leadDays ?? 0}d lead</Typography>
                <Typography variant="caption" color="text.secondary">{s.skipHolidays ? 'Skips holidays' : 'Runs on holidays'}</Typography>
              </TableCell>
              <TableCell>
                {s.active ? <StatusBadge label="Active" tone="green" /> : <StatusBadge label="Paused" tone="gray" />}
              </TableCell>
              {canApprove && (
                <TableCell align="right">
                  <Tooltip title="Edit schedule">
                    <IconButton size="small" onClick={() => { setEditingSchedule(s); setDialog('schedule'); }}>
                      <PencilSquareIcon size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete schedule">
                    <IconButton size="small" onClick={() => { setEditingSchedule(s); setDialog('deleteSchedule'); }}>
                      <TrashIcon size={16} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </PlainTable>
      )}
    </>
  );

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/runbooks')}
        backLabel="Runbook Library"
        title={rb.title}
        meta={meta}
        right={right}
      />

      <RunbooksNav />

      {rb.templateUpdateAvailable && (
        <Alert severity="info" sx={{ mb: 2 }}
          action={(hasDraft ? canAuthor : canApprove) && !retired && (
            <Button color="inherit" size="small" disabled={action.isPending}
              onClick={hasDraft ? openEditor : () => run({
                // Builds a new DRAFT from the updated platform template content (M30).
                fn: () => api.runbooks.templateRevision(id),
                msg: 'Draft revision created from the updated template.',
                after: () => navigate(`/runbooks/${id}/edit`),
              })}>
              {hasDraft ? 'Open draft' : 'Create revision'}
            </Button>
          )}>
          Template {rb.sourceTemplateCode} updated to v{rb.latestTemplateVersion}
          {rb.sourceTemplateVersion != null ? ` (this runbook is based on v${rb.sourceTemplateVersion})` : ''}.
          Review the template and carry the changes into a new revision.
        </Alert>
      )}

      {hasDraft && rb.currentVersion && (
        <Alert severity={rb.draftVersionStatus === 'IN_REVIEW' ? 'warning' : 'info'} sx={{ mb: 2 }}>
          A {rb.draftVersionStatus === 'IN_REVIEW' ? 'revision awaiting approval' : 'draft revision'} exists.
          The tabs below show the published version v{rb.currentVersionNumber}.
          {!directPublish && rb.draftVersionStatus === 'DRAFT' ? ' HIGH / CRITICAL runbooks need CCO approval to publish.' : ''}
        </Alert>
      )}

      {retired && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This runbook is {humanize(status).toLowerCase()} — it can no longer be executed or scheduled.
        </Alert>
      )}

      <SectionTabs tabs={tabs} value={tab} onChange={setTab} sx={{ mb: 3 }} />

      {tab === 'overview' && overview}
      {tab === 'steps' && (treeState() || (<>{draftNote}<StepsView tree={tree} clausesById={clausesById} /></>))}
      {tab === 'prereqs' && (treeState() || (<>{draftNote}<PrerequisitesView tree={tree} /></>))}
      {tab === 'escalation' && (treeState() || (<>{draftNote}<EscalationRollbackView tree={tree} /></>))}
      {tab === 'mapping' && mapping}
      {tab === 'versions' && versionsTab()}
      {tab === 'executions' && executionsTab}
      {tab === 'schedule' && scheduleTab}

      {/* ───────── dialogs ───────── */}
      <StartExecutionDialog open={dialog === 'execute'} onClose={() => setDialog(null)} runbook={rb} />

      <PublishVersionDialog
        open={dialog === 'publish'}
        onClose={() => setDialog(null)}
        runbookId={id}
        versionId={rb.draftVersionId}
        onPublished={(v) => notify(`Version v${v?.versionNumber ?? ''} published.`)}
      />

      <ScheduleRunbookDialog
        open={dialog === 'schedule'}
        onClose={() => setDialog(null)}
        runbook={rb}
        schedule={editingSchedule}
        onSaved={() => notify(editingSchedule ? 'Schedule updated.' : 'Schedule created.')}
      />

      <MapClausesDialog
        open={dialog === 'clauses'}
        onClose={() => setDialog(null)}
        runbookId={id}
        mapped={rb.clauses}
        onSaved={() => notify('Framework clauses updated.')}
      />

      <LinkObligationsPicker
        open={dialog === 'obligations'}
        onClose={() => setDialog(null)}
        initialIds={rb.linkedObligationIds}
        onSave={(ids) => saveLinks({ obligationIds: ids })}
      />
      <LinkControlsPicker
        open={dialog === 'controls'}
        onClose={() => setDialog(null)}
        initialIds={rb.linkedControlIds}
        onSave={(ids) => saveLinks({ controlIds: ids })}
      />

      <VersionDiffDialog
        open={dialog === 'diff'}
        onClose={() => setDialog(null)}
        runbookId={id}
        fromVersionId={diffPair?.from}
        toVersionId={diffPair?.to}
      />

      <CloneRunbookDialog
        open={dialog === 'clone'}
        onClose={closeDialog}
        sourceTitle={rb.title}
        pending={action.isPending}
        error={action.error}
        onConfirm={(title) => run({
          fn: () => api.runbooks.clone(id, { title }),
          inDialog: true,
          msg: 'Runbook cloned.',
          after: (copy) => { if (copy?.runbookId != null) navigate(`/runbooks/${copy.runbookId}`); },
        })}
      />

      <RetireRunbookDialog
        open={dialog === 'deprecate' || dialog === 'archive'}
        mode={dialog === 'archive' ? 'archive' : 'deprecate'}
        onClose={closeDialog}
        pending={action.isPending}
        error={action.error}
        onConfirm={(reason) => run({
          fn: () => (dialog === 'archive' ? api.runbooks.archive(id, reason) : api.runbooks.deprecate(id, reason)),
          inDialog: true,
          msg: dialog === 'archive' ? 'Runbook archived.' : 'Runbook deprecated.',
        })}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={closeDialog}
        title="Delete runbook?"
        message={`${rb.runbookCode} — ${rb.title} will be permanently deleted. Only draft runbooks that were never executed can be deleted.`}
        pending={action.isPending}
        error={action.error}
        onConfirm={() => run({
          fn: () => api.runbooks.remove(id),
          inDialog: true,
          removed: true,
          msg: 'Runbook deleted.',
          after: () => navigate('/runbooks'),
        })}
      />

      <ConfirmDialog
        open={dialog === 'deleteSchedule'}
        onClose={closeDialog}
        title="Delete schedule?"
        message={editingSchedule ? `The ${label(FREQUENCIES, editingSchedule.frequency).toLowerCase()} schedule will stop creating executions.` : ''}
        pending={action.isPending}
        error={action.error}
        onConfirm={() => run({
          fn: () => api.runbooks.schedules.remove(id, editingSchedule.scheduleId),
          inDialog: true,
          msg: 'Schedule deleted.',
        })}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
