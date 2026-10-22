import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, CircularProgress, Stack, Typography, Snackbar, Alert } from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, StatusBadge,
  ClockIcon, ExclamationTriangleIcon, CheckCircleIcon, InboxIcon,
} from 'shared';
import { api } from '../services/api';

const opt = (values) => values.map((v) => ({ value: v, label: v }));
const PRIORITIES = ['OVERDUE', 'HIGH', 'MEDIUM', 'SOON', 'LOW'];
const priorityChip = {
  OVERDUE: { label: 'Overdue', color: 'error' },
  HIGH: { label: 'High', color: 'warning' },
  MEDIUM: { label: 'Medium', color: 'default' },
  SOON: { label: 'Due soon', color: 'info' },
  LOW: { label: 'Low', color: 'default' },
};

function dueText(t) {
  if (t.dueDate == null) return '—';
  if (t.daysRemaining < 0) return `${Math.abs(t.daysRemaining)}d overdue`;
  if (t.daysRemaining === 0) return 'Today';
  return `in ${t.daysRemaining}d`;
}

export default function TasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [assignee, setAssignee] = useState('me');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const [kpi, setKpi] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [snackbar, setSnackbar] = useState('');

  const params = { assignee, page, size };
  if (category) params.category = category;
  if (priority) params.priority = priority;
  if (q) params.q = q;

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['tasks', 'center', params],
    queryFn: ({ signal }) => api.tasks.center(params, { signal }),
    placeholderData: (prev) => prev,
  });
  const { data: stats } = useQuery({
    queryKey: ['tasks', 'center-stats', assignee],
    queryFn: ({ signal }) => api.tasks.centerStats({ assignee }, { signal }),
  });

  const startMut = useMutation({
    mutationFn: (instanceId) => api.returns.advance(instanceId, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSnackbar('Filing started — the responsible person will be notified.');
    },
    onError: (e) => setSnackbar(e.message || 'Could not start the filing.'),
  });

  const rows = data?.content || [];
  const total = data?.totalElements || 0;

  const kpis = useMemo(() => [
    { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, tone: 'red', icon: <ExclamationTriangleIcon size={16} /> },
    { key: 'today', label: 'Due today', value: stats?.dueToday ?? 0, tone: 'orange', icon: <ClockIcon size={16} /> },
    { key: 'week', label: 'Due this week', value: stats?.dueThisWeek ?? 0, tone: 'amber', icon: <ClockIcon size={16} /> },
    { key: 'unassigned', label: 'Unassigned', value: stats?.unassigned ?? 0, tone: 'gray', icon: <InboxIcon size={16} /> },
    { key: 'done', label: 'Completed (7d)', value: stats?.completedLast7d ?? 0, tone: 'green', icon: <CheckCircleIcon size={16} /> },
  ], [stats]);

  const visible = useMemo(() => {
    if (!kpi || kpi === 'done') return rows;
    if (kpi === 'overdue') return rows.filter((t) => t.priority === 'OVERDUE');
    if (kpi === 'today') return rows.filter((t) => t.daysRemaining === 0);
    if (kpi === 'week') return rows.filter((t) => t.daysRemaining != null && t.daysRemaining >= 0 && t.daysRemaining <= 7);
    if (kpi === 'unassigned') return rows.filter((t) => t.ownerUserId == null);
    return rows;
  }, [rows, kpi]);

  const columns = [
    {
      id: 'title', label: 'Task', minWidth: 280, render: (t) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{t.title}</Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
            <Chip size="small" variant="outlined" label={priorityChip[t.priority]?.label || t.priority}
              color={priorityChip[t.priority]?.color || 'default'} />
            <Typography variant="caption" color="text.secondary" noWrap>{t.type?.replaceAll('_', ' ').toLowerCase()}</Typography>
          </Stack>
        </Box>
      ),
    },
    { id: 'caption', label: 'Related', minWidth: 200, render: (t) => <Typography variant="body2" color="text.secondary">{t.caption || '—'}</Typography> },
    {
      id: 'due', label: 'Due', minWidth: 120, render: (t) => (
        <Typography variant="body2" sx={{ color: t.daysRemaining < 0 ? 'error.main' : 'text.primary' }}>
          {dueText(t)}{t.dueDate ? <Typography component="span" variant="caption" color="text.secondary">{` · ${t.dueDate}`}</Typography> : null}
        </Typography>
      ),
    },
    { id: 'owner', label: 'Owner', minWidth: 150, render: (t) => <Typography variant="body2">{t.ownerName || '—'}</Typography> },
  ];

  return (
    <Box>
      <PageHeader
        title="Tasks"
        subtitle="Actionable work across the compliance calendar — prepare, submit, or chase."
        actions={(
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant={assignee === 'me' ? 'contained' : 'outlined'} size="small"
              onClick={() => { setAssignee('me'); setPage(0); }}>My work</Button>
            <Button variant={assignee === 'all' ? 'contained' : 'outlined'} size="small"
              onClick={() => { setAssignee('all'); setPage(0); }}>Whole organisation</Button>
            <Button variant="outlined" size="small" onClick={() => refetch()}>Refresh</Button>
          </Stack>
        )}
      />

      <KpiCards items={kpis.map((k) => ({ ...k, active: kpi === k.key }))}
        onSelect={(key) => { setKpi((v) => (v === key ? null : key)); setPage(0); }} columns={5} />

      <FilterBar
        search={{ value: q, onChange: (v) => { setQ(v); setPage(0); }, placeholder: 'Search task, return, or owner…' }}
        filters={[
          { key: 'category', label: 'Category', value: category, onChange: (v) => { setCategory(v); setPage(0); },
            options: opt(['RETURNS']), allLabel: 'All', minWidth: 150 },
          { key: 'priority', label: 'Priority', value: priority, onChange: (v) => { setPriority(v); setPage(0); },
            options: opt(PRIORITIES), allLabel: 'All', minWidth: 150 },
        ]}
        showClear={!!(q || category || priority || kpi)}
        onClear={() => { setQ(''); setCategory(''); setPriority(''); setKpi(null); setPage(0); }}
      />

      {isError ? (
        <Alert severity="error" action={<Button size="small" onClick={() => refetch()}>Retry</Button>}>
          {error?.message || 'Could not load tasks.'}
        </Alert>
      ) : (
        <SectionTable
          columns={columns}
          rows={visible}
          total={total}
          page={page}
          size={size}
          loading={isPending}
          onPage={setPage}
          onSize={(s) => { setSize(s); setPage(0); }}
          rowKey={(t) => t.key}
          onRowClick={(t) => navigate(t.linkPath)}
          emptyMessage="Nothing to action — no filings are due soon or overdue."
          emptyIcon={<CheckCircleIcon size={44} sx={{ mb: 1, opacity: 0.35 }} />}
          actions={(t) => (
            t.actionType === 'START' ? (
              <Button size="small" variant="contained" disabled={startMut.isPending}
                onClick={() => startMut.mutate(t.sourceRef?.instanceId)}>Start</Button>
            ) : (
              <Button size="small" variant="outlined" onClick={() => navigate(t.linkPath)}>{t.actionLabel || 'Open'}</Button>
            )
          )}
        />
      )}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</Alert>
      </Snackbar>
    </Box>
  );
}
