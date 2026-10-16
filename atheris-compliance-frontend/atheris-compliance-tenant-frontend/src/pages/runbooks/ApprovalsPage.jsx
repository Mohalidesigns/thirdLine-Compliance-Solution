import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, Snackbar, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DataCard, EntityDrawer, FilterBar, KpiCards, PageHeader, RiskBadge, SectionTable, StatusBadge, TL,
  formatDate, ClipboardDocumentCheckIcon, ExclamationTriangleIcon, DocumentTextIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import VersionDiffView from '../../components/runbooks/VersionDiffView';
import { APPROVER_ROLES, CATEGORIES, CRITICALITIES, humanize, label } from './runbookConstants';

const codeChipSx = { height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' };
const sectionLabelSx = {
  fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase',
  letterSpacing: '0.05em', mb: 1,
};

const sameUser = (a, b) => a != null && b != null && String(a) === String(b);

function countBy(rows, fn) {
  return rows.reduce((acc, r) => {
    const k = fn(r);
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

/* ----------------------------------------------------------------- Drawer body */

function LintPanel({ runbookId, versionId }) {
  const lintQuery = useQuery({
    queryKey: ['runbook-version-lint', String(runbookId), String(versionId)],
    queryFn: () => api.runbooks.versions.lint(runbookId, versionId),
    staleTime: 0,
    retry: false,
  });
  if (lintQuery.isLoading) return <CircularProgress size={20} />;
  if (lintQuery.isError) {
    return <Alert severity="warning">Lint unavailable: {lintQuery.error?.message || 'request failed'}</Alert>;
  }
  const lint = lintQuery.data || {};
  const issues = lint.issues || [];
  if (!issues.length) return <Alert severity="success">No lint issues.</Alert>;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <StatusBadge label={`${lint.errors ?? 0} errors`} tone={lint.errors ? 'red' : 'gray'} />
        <StatusBadge label={`${lint.warnings ?? 0} warnings`} tone={lint.warnings ? 'amber' : 'gray'} />
      </Box>
      {issues.map((iss, i) => (
        <Box key={`${iss.rule}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.5 }}>
          <StatusBadge label={iss.rule} tone={iss.severity === 'ERROR' ? 'red' : 'amber'} />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {iss.stepCode && <Box component="span" sx={{ fontFamily: TL.mono, mr: 0.75 }}>{iss.stepCode}</Box>}
            {iss.message}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function DecisionPanel({ item, isAuthor, onDone }) {
  const queryClient = useQueryClient();
  const [changeSummary, setChangeSummary] = useState(item.changeSummary || '');
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState('CHANGES_REQUESTED');
  const [rejectComment, setRejectComment] = useState('');
  const [error, setError] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['runbook-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['runbooks'] });
    queryClient.invalidateQueries({ queryKey: ['runbook', String(item.runbookId)] });
  };

  const approve = useMutation({
    mutationFn: () => api.runbooks.versions.approve(item.runbookId, item.versionId, {
      comment: comment.trim(), changeSummary: changeSummary.trim(),
    }),
    onSuccess: () => { invalidate(); onDone(`v${item.versionNumber} of ${item.runbookCode} approved and published`); },
    onError: (e) => setError(e.message || 'Approval failed'),
  });
  const reject = useMutation({
    mutationFn: () => api.runbooks.versions.reject(item.runbookId, item.versionId, {
      comment: rejectComment.trim(), decision,
    }),
    onSuccess: () => {
      invalidate();
      onDone(`v${item.versionNumber} of ${item.runbookCode} ${decision === 'REJECTED' ? 'rejected' : 'returned for changes'}`);
    },
    onError: (e) => setError(e.message || 'Rejection failed'),
  });

  const busy = approve.isPending || reject.isPending;
  const summaryOk = changeSummary.trim().length >= 10;
  const approveDisabled = isAuthor || !summaryOk || busy;
  const approveTip = isAuthor
    ? 'You authored this version — another approver must approve it (approver ≠ author).'
    : !summaryOk ? 'Change summary must be at least 10 characters.' : '';

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <DataCard title="Approve" subtitle="Records an APPROVED decision and publishes this version" sx={{ mb: 2 }}>
        <TextField
          label="Change summary" size="small" fullWidth multiline minRows={2} required
          value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)}
          error={changeSummary.length > 0 && !summaryOk}
          helperText={`${changeSummary.trim().length}/10 characters minimum`}
          sx={{ mb: 1.5 }}
        />
        <TextField
          label="Comment" size="small" fullWidth multiline minRows={2}
          value={comment} onChange={(e) => setComment(e.target.value)} sx={{ mb: 1.5 }}
        />
        <Tooltip title={approveTip}>
          <span>
            <Button variant="contained" color="success" disabled={approveDisabled} onClick={() => approve.mutate()}
              sx={{ textTransform: 'none', fontWeight: 600 }}>
              {approve.isPending ? 'Approving…' : 'Approve & publish'}
            </Button>
          </span>
        </Tooltip>
      </DataCard>

      <DataCard title="Reject or request changes" subtitle="Returns the version to DRAFT for the author">
        <TextField
          select label="Decision" size="small" fullWidth value={decision}
          onChange={(e) => setDecision(e.target.value)} sx={{ mb: 1.5 }}
        >
          <MenuItem value="CHANGES_REQUESTED">Changes requested</MenuItem>
          <MenuItem value="REJECTED">Rejected</MenuItem>
        </TextField>
        <TextField
          label="Comment" size="small" fullWidth multiline minRows={2} required
          value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} sx={{ mb: 1.5 }}
          helperText="Explain what the author needs to change"
        />
        <Button variant="outlined" color="error" disabled={!rejectComment.trim() || busy} onClick={() => reject.mutate()}
          sx={{ textTransform: 'none', fontWeight: 600 }}>
          {reject.isPending ? 'Sending…' : decision === 'REJECTED' ? 'Reject version' : 'Request changes'}
        </Button>
      </DataCard>
    </Box>
  );
}

function ApprovalDrawerBody({ item, isAuthor, onDone }) {
  const diffQuery = useQuery({
    queryKey: ['runbook-version-diff', String(item.runbookId), String(item.versionId), String(item.publishedVersionId)],
    queryFn: ({ signal }) => api.runbooks.versions.diff(item.runbookId, item.versionId, item.publishedVersionId, { signal }),
    enabled: item.publishedVersionId != null,
  });

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '4px 16px', mb: 2 }}>
        <Typography variant="caption" color="text.secondary">Category</Typography>
        <Typography variant="body2">{label(CATEGORIES, item.category)}</Typography>
        <Typography variant="caption" color="text.secondary">Criticality</Typography>
        <Box><RiskBadge value={humanize(item.criticality)} /></Box>
        <Typography variant="caption" color="text.secondary">Author</Typography>
        <Typography variant="body2">{item.authoredByName || '–'}</Typography>
        <Typography variant="caption" color="text.secondary">Submitted</Typography>
        <Typography variant="body2">{formatDate(item.submittedAt)}</Typography>
        <Typography variant="caption" color="text.secondary">Published</Typography>
        <Typography variant="body2">
          {item.publishedVersionNumber != null ? `v${item.publishedVersionNumber}` : 'Never published'}
        </Typography>
      </Box>
      {item.changeSummary && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Author's change summary</Typography>
          {item.changeSummary}
        </Alert>
      )}

      <Typography sx={sectionLabelSx}>Changes vs published</Typography>
      <DataCard sx={{ mb: 2 }}>
        {item.publishedVersionId == null ? (
          <Typography variant="body2" color="text.secondary">First version — no previous publication.</Typography>
        ) : diffQuery.isLoading ? (
          <CircularProgress size={20} />
        ) : diffQuery.isError ? (
          <Alert severity="warning">Could not load the diff: {diffQuery.error?.message}</Alert>
        ) : (
          <VersionDiffView diff={diffQuery.data} />
        )}
      </DataCard>

      <Typography sx={sectionLabelSx}>Lint</Typography>
      <DataCard sx={{ mb: 2 }}>
        <LintPanel runbookId={item.runbookId} versionId={item.versionId} />
      </DataCard>

      <Typography sx={sectionLabelSx}>Decision</Typography>
      <DecisionPanel key={item.versionId} item={item} isAuthor={isAuthor} onDone={onDone} />
    </Box>
  );
}

/* ------------------------------------------------------------------- Page */

export default function ApprovalsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canApprove = APPROVER_ROLES.includes(user?.role);

  const [q, setQ] = useState('');
  const [criticality, setCriticality] = useState('All');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['runbook-approvals'],
    queryFn: ({ signal }) => api.runbooks.approvalsPending({ signal }),
    enabled: canApprove,
  });
  const items = useMemo(() => (Array.isArray(data) ? data : (data?.content || [])), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((r) => (criticality === 'All' || r.criticality === criticality)
      && (category === 'All' || r.category === category)
      && (!needle || [r.runbookCode, r.title, r.authoredByName, r.changeSummary]
        .some((v) => String(v || '').toLowerCase().includes(needle))));
  }, [items, q, criticality, category]);

  const pageRows = filtered.slice(page * size, page * size + size);

  const highCrit = items.filter((r) => r.criticality === 'HIGH' || r.criticality === 'CRITICAL');
  const firstVersions = items.filter((r) => r.publishedVersionId == null);
  const kpis = [
    { key: 'pending', label: 'Pending approvals', value: items.length, tone: 'blue',
      icon: <ClipboardDocumentCheckIcon size={16} />,
      breakdown: countBy(items, (r) => humanize(r.criticality)) },
    { key: 'highCrit', label: 'High / Critical', value: highCrit.length, tone: 'red',
      icon: <ExclamationTriangleIcon size={16} />,
      breakdown: countBy(highCrit, (r) => label(CATEGORIES, r.category)) },
    { key: 'first', label: 'First publications', value: firstVersions.length, tone: 'teal',
      icon: <DocumentTextIcon size={16} />,
      breakdown: countBy(firstVersions, (r) => label(CATEGORIES, r.category)) },
  ];

  const resetPage = (fn) => (v) => { fn(v); setPage(0); };
  const onKpiSelect = (key) => {
    setPage(0);
    if (key === 'pending') { setCriticality('All'); setCategory('All'); }
  };
  const onKpiDrill = (key, lbl) => {
    setPage(0);
    if (key === 'pending') {
      const crit = CRITICALITIES.find((c) => humanize(c) === lbl);
      if (crit) setCriticality(crit);
    } else {
      const cat = CATEGORIES.find((c) => c.label === lbl);
      if (cat) setCategory(cat.value);
    }
  };

  const columns = [
    { id: 'runbook', label: 'Runbook', minWidth: 260, render: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={r.runbookCode || '—'} size="small" variant="outlined" sx={codeChipSx} />
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={r.title}>{r.title}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{label(CATEGORIES, r.category)}</Typography>
      </Box>
    ) },
    { id: 'version', label: 'Version', minWidth: 200, render: (r) => (
      <Box sx={{ minWidth: 0, maxWidth: 320 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          v{r.versionNumber}
          {r.publishedVersionNumber != null && (
            <Box component="span" sx={{ color: TL.gray400, fontWeight: 400 }}> (from v{r.publishedVersionNumber})</Box>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {r.changeSummary || 'No change summary'}
        </Typography>
      </Box>
    ) },
    { id: 'criticality', label: 'Criticality', render: (r) => <RiskBadge value={humanize(r.criticality)} /> },
    { id: 'author', label: 'Author', render: (r) => (
      <Box>
        <Typography variant="body2">{r.authoredByName || '–'}</Typography>
        {sameUser(r.authoredByUserId, user?.userId) && (
          <Typography variant="caption" color="warning.main">You (cannot approve)</Typography>
        )}
      </Box>
    ) },
    { id: 'submitted', label: 'Submitted', render: (r) => <Typography variant="body2">{formatDate(r.submittedAt)}</Typography> },
  ];

  return (
    <Box>
      <PageHeader
        title="Runbook Approvals"
        subtitle="Runbook versions awaiting a second-person approval before publication"
      />
      <RunbooksNav counts={canApprove ? { '/runbooks/approvals': items.length } : {}} />

      {!canApprove ? (
        <Alert severity="info">
          Only a CCO or Tenant Admin can approve runbook versions. Ask one of them to review your submission.
        </Alert>
      ) : (
        <>
          <KpiCards items={kpis} columns={3} onSelect={onKpiSelect} onDrill={onKpiDrill} />
          <FilterBar
            search={{ value: q, onChange: resetPage(setQ), placeholder: 'Search runbook, author or summary…' }}
            filters={[
              { key: 'criticality', label: 'Criticality', value: criticality, onChange: resetPage(setCriticality),
                options: CRITICALITIES.map((c) => ({ value: c, label: humanize(c) })) },
              { key: 'category', label: 'Category', value: category, onChange: resetPage(setCategory),
                options: CATEGORIES },
            ]}
            showClear={q !== '' || criticality !== 'All' || category !== 'All'}
            onClear={() => { setQ(''); setCriticality('All'); setCategory('All'); setPage(0); }}
          />
          <SectionTable
            columns={columns}
            rows={pageRows}
            total={filtered.length}
            page={page}
            size={size}
            onPage={setPage}
            onSize={(s) => { setSize(s); setPage(0); }}
            loading={isLoading}
            error={error}
            rowKey={(r) => r.versionId}
            onRowClick={setSelected}
            emptyMessage={items.length ? 'No approvals match these filters.' : 'Nothing awaiting approval.'}
          />
        </>
      )}

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={720}
        title={selected ? `${selected.runbookCode} · v${selected.versionNumber}` : ''}
        subtitle={selected?.title}
        onOpenFull={selected ? () => navigate(`/runbooks/${selected.runbookId}`) : undefined}
        fullPageLabel="Open runbook"
      >
        {selected && (
          <ApprovalDrawerBody
            item={selected}
            isAuthor={sameUser(selected.authoredByUserId, user?.userId)}
            onDone={(msg) => { setSelected(null); setToast(msg); }}
          />
        )}
      </EntityDrawer>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
