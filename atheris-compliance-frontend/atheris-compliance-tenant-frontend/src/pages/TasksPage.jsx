import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Stack, Typography, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, SectionTabs,
  ClockIcon, ExclamationTriangleIcon, CheckCircleIcon, InboxIcon,
} from 'shared';
import MultiPersonPicker from '../components/common/MultiPersonPicker';
import { api } from '../services/api';

const opt = (values) => values.map((v) => ({ value: v, label: v }));
const PRIORITIES = ['OVERDUE', 'HIGH', 'MEDIUM', 'SOON', 'LOW'];
const CATEGORIES = [
  { key: 'CONTROLS', label: 'Controls' },
  { key: 'RETURNS', label: 'Returns' },
  { key: 'FINDINGS', label: 'Findings' },
  { key: 'OBLIGATIONS', label: 'Obligations' },
];
const priorityChip = {
  OVERDUE: { label: 'Overdue', color: 'error' },
  HIGH: { label: 'High', color: 'warning' },
  MEDIUM: { label: 'Medium', color: 'default' },
  SOON: { label: 'Due soon', color: 'info' },
  LOW: { label: 'Low', color: 'default' },
};

function relText(t) {
  if (t.dueDate == null || t.daysRemaining == null) return null;
  if (t.daysRemaining < 0) return `${Math.abs(t.daysRemaining)} days overdue`;
  if (t.daysRemaining === 0) return 'today';
  if (t.daysRemaining === 1) return '1 day';
  return `${t.daysRemaining} days`;
}

export default function TasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [assignee, setAssignee] = useState('all');
  const [category, setCategory] = useState('RETURNS');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const [kpi, setKpi] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [snackbar, setSnackbar] = useState('');
  const [assignFor, setAssignFor] = useState(null);

  const params = { assignee, category, page, size };
  if (priority) params.priority = priority;
  if (q) params.q = q;

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['tasks', 'center', params],
    queryFn: ({ signal }) => api.tasks.center(params, { signal }),
    placeholderData: (prev) => prev,
  });
  const { data: stats } = useQuery({
    queryKey: ['tasks', 'center-stats', assignee, category],
    queryFn: ({ signal }) => api.tasks.centerStats({ assignee, category }, { signal }),
  });

  const startMut = useMutation({
    mutationFn: (instanceId) => api.returns.advance(instanceId, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSnackbar('Filing started — the responsible person can submit the data now.');
    },
    onError: (e) => setSnackbar(e.message || 'Could not start the filing.'),
  });
  const assignMut = useMutation({
    mutationFn: ({ returnId, persons }) => api.returns.update(returnId, { responsiblePersons: persons }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setAssignFor(null);
      setSnackbar('Responsible person set — filings will now generate.');
    },
    onError: (e) => setSnackbar(e.message || 'Could not assign the responsible person.'),
  });

  const rows = data?.content || [];
  const total = data?.totalElements || 0;
  const byCategory = stats?.byCategory || {};

  const tabs = CATEGORIES.map((c) => ({ ...c, count: byCategory[c.key] ?? 0 }));

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
      id: 'title', label: 'Task', minWidth: 260, render: (t) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{t.title}</Typography>
          <Chip size="small" variant="outlined" label={priorityChip[t.priority]?.label || t.priority}
            color={priorityChip[t.priority]?.color || 'default'} />
        </Stack>
      ),
    },
    {
      id: 'due', label: 'Due date', minWidth: 160, render: (t) => (
        t.dueDate ? (
          <Typography variant="body2" sx={{ color: t.daysRemaining < 0 ? 'error.main' : 'text.primary' }} noWrap>
            {t.dueDate}
            {relText(t) ? <Typography component="span" variant="caption" color="text.secondary">{` (${relText(t)})`}</Typography> : null}
          </Typography>
        ) : <Typography variant="body2" color="text.secondary">—</Typography>
      ),
    },
    {
      id: 'regulator', label: 'Regulator', minWidth: 130, render: (t) => (
        t.regulator ? <Chip size="small" variant="outlined" label={t.regulator} /> : <Typography variant="body2" color="text.secondary">—</Typography>
      ),
    },
    { id: 'responsible', label: 'Responsible person', minWidth: 180, render: (t) => <Typography variant="body2" noWrap>{t.responsiblePerson || '—'}</Typography> },
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

      <SectionTabs tabs={tabs} value={category} onChange={(v) => { setCategory(v); setKpi(null); setPage(0); }} sx={{ mb: 2 }} />

      <KpiCards items={kpis.map((k) => ({ ...k, active: kpi === k.key }))}
        onSelect={(key) => { setKpi((v) => (v === key ? null : key)); setPage(0); }} columns={5} />

      <FilterBar
        search={{ value: q, onChange: (v) => { setQ(v); setPage(0); }, placeholder: 'Search task, regulator, or owner…' }}
        filters={[
          { key: 'priority', label: 'Priority', value: priority, onChange: (v) => { setPriority(v); setPage(0); },
            options: opt(PRIORITIES), allLabel: 'All', minWidth: 150 },
        ]}
        showClear={!!(q || priority || kpi)}
        onClear={() => { setQ(''); setPriority(''); setKpi(null); setPage(0); }}
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
          emptyMessage="Nothing to action in this category."
          emptyIcon={<CheckCircleIcon size={44} sx={{ mb: 1, opacity: 0.35 }} />}
          actions={(t) => {
            if (t.actionType === 'START') {
              return (
                <Button size="small" variant="contained" disabled={startMut.isPending}
                  onClick={() => startMut.mutate(t.sourceRef?.instanceId)}>Start</Button>
              );
            }
            if (t.actionType === 'ASSIGN') {
              return <Button size="small" variant="contained" onClick={() => setAssignFor(t)}>Assign</Button>;
            }
            return <Button size="small" variant="outlined" onClick={() => navigate(t.linkPath)}>{t.actionLabel || 'Open'}</Button>;
          }}
        />
      )}

      {assignFor && (
        <AssignDialog task={assignFor} saving={assignMut.isPending}
          onClose={() => setAssignFor(null)}
          onSave={(persons) => assignMut.mutate({ returnId: assignFor.sourceRef?.returnId, persons })} />
      )}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</Alert>
      </Snackbar>
    </Box>
  );
}

function AssignDialog({ task, saving, onClose, onSave }) {
  const [persons, setPersons] = useState([]);
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign responsible person</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {task.title} — the responsible person receives the filing request and submits the data.
        </Typography>
        <MultiPersonPicker label="Responsible person(s)" value={persons} onChange={setPersons} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !persons.length}
          onClick={() => onSave((persons || []).map((p) => p.fullName || p.email).filter(Boolean))}>
          {saving ? 'Saving…' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
