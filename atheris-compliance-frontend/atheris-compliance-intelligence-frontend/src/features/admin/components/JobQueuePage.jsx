import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TableSortLabel, Chip, Button, CircularProgress, Alert,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StatusBadge, TL,
  ArrowPathIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon, DocumentTextIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import UploadDialog from './UploadDialog';

/* One row = one non-toolkit DOCUMENT. Stage comes from the backend
   (PipelineService.stageOf): failed | extracting | classified | published | superseded | withdrawn. */
const STAGES = [
  { key: 'failed', label: 'Download Failed', tone: 'red' },
  { key: 'extracting', label: 'Extracting', tone: 'purple' },
  { key: 'classified', label: 'Classified', tone: 'orange' },
  { key: 'published', label: 'Published', tone: 'green' },
  { key: 'superseded', label: 'Superseded', tone: 'gray' },
  { key: 'withdrawn', label: 'Withdrawn', tone: 'gray' },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]));

const STATUS_CHIP = {
  Published: { label: 'Published', tone: 'green' },
  Triage: { label: 'In Progress', tone: 'orange' },
  Superseded: { label: 'Superseded', tone: 'gray' },
  Withdrawn: { label: 'Withdrawn', tone: 'red' },
  failed: { label: 'Failed', tone: 'red' },
};

const COLUMNS = [
  { id: 'title', label: 'Document', minWidth: 320 },
  { id: 'regulatorAbbreviation', label: 'Regulator', minWidth: 160 },
  { id: 'stage', label: 'Stage', minWidth: 150 },
  { id: 'status', label: 'Status', minWidth: 120 },
  { id: 'discoveredAt', label: 'Discovered', minWidth: 150 },
];

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function stageChip(stage) {
  const s = STAGE_BY_KEY[stage] || { label: stage || '—', tone: 'gray' };
  return <StatusBadge label={s.label} tone={s.tone} />;
}

function statusChip(status) {
  const s = STATUS_CHIP[status] || { label: status || '—', tone: 'gray' };
  return <StatusBadge label={s.label} tone={s.tone} />;
}

/* KPI card key -> the stage its card drills to. Each card's number and its drill agree. */
const KPI_STAGE = { total: 'All', failed: 'failed', completed: 'published' };

export default function JobQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [stage, setStage] = useState(searchParams.get('stage') || 'All');
  const [regulatorId, setRegulatorId] = useState(searchParams.get('regulatorId') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [rowsPerPage, setRowsPerPage] = useState(Number(searchParams.get('size') || 20));

  const [uploadOpen, setUploadOpen] = useState(false);

  // Debounce the search box into the applied query.
  useEffect(() => {
    const t = setTimeout(() => { setQ(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reflect the applied filters in the URL.
  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (stage !== 'All') p.stage = stage;
    if (regulatorId !== 'All') p.regulatorId = regulatorId;
    if (page) p.page = String(page);
    if (rowsPerPage !== 20) p.size = String(rowsPerPage);
    setSearchParams(p, { replace: true });
  }, [q, stage, regulatorId, page, rowsPerPage, setSearchParams]);

  // Regulator list for the filter + abbreviation -> id mapping.
  const regulatorsQuery = useQuery({
    queryKey: ['regulators', 'pipeline-filter'],
    queryFn: ({ signal }) => api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc', signal }),
    staleTime: 5 * 60 * 1000,
  });

  const params = (() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (stage !== 'All') p.set('stage', stage);
    if (regulatorId !== 'All') p.set('regulatorId', regulatorId);
    p.set('page', String(page));
    p.set('size', String(rowsPerPage));
    return p.toString();
  })();

  const listQuery = useQuery({
    queryKey: ['pipeline', 'list', params],
    queryFn: ({ signal }) => api.platform.pipeline.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['pipeline', 'stats'],
    queryFn: ({ signal }) => api.platform.pipeline.stats(signal),
  });

  const rows = Array.isArray(listQuery.data?.content) ? listQuery.data.content : [];
  const total = Number(listQuery.data?.totalElements || 0);
  const loading = listQuery.isPending;
  const error = listQuery.isError ? (listQuery.error?.message || 'Failed to load pipeline') : null;
  const stats = statsQuery.data;
  const load = () => { listQuery.refetch(); statsQuery.refetch(); };

  const regulatorOptions = useMemo(() => {
    const regs = Array.isArray(regulatorsQuery.data) ? regulatorsQuery.data : (regulatorsQuery.data?.content || []);
    return regs.map((r) => ({
      id: r.regulatorId,
      label: r.abbreviation || r.name || `Regulator #${r.regulatorId}`,
    })).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [regulatorsQuery.data]);

  const idByLabel = useMemo(() => {
    const m = {};
    for (const o of regulatorOptions) m[o.label] = o.id;
    return m;
  }, [regulatorOptions]);

  const kpiItems = [
    { key: 'total', label: 'Total Downloads', value: stats?.totalDownloads ?? 0, tone: 'blue',
      icon: <DocumentTextIcon />, breakdown: stats?.byRegulator || {} },
    { key: 'failed', label: 'Failed Downloads', value: stats?.failedDownloads ?? 0, tone: 'red',
      icon: <ExclamationCircleIcon />, breakdown: stats?.byRegulator || {} },
    { key: 'completed', label: 'Total Completed', value: stats?.completed ?? 0, tone: 'green',
      icon: <CheckCircleIcon />, breakdown: stats?.byRegulator || {} },
  ];

  const hasFilters = !!q || stage !== 'All' || regulatorId !== 'All';

  function clearFilters() {
    setSearchInput(''); setQ(''); setStage('All'); setRegulatorId('All'); setPage(0);
  }

  function drillRegulator(name) {
    const id = idByLabel[name];
    if (id !== undefined) setRegulatorId(String(id));
    setPage(0);
  }

  return (
    <Box>
      <PageHeader
        title="Document Pipeline"
        subtitle={`${total} document${total !== 1 ? 's' : ''} — the AI pipeline (toolkit-seeded regulations are excluded)`}
        actions={(
          <>
            <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={load}>Refresh</Button>
            <Button variant="contained" startIcon={<CloudArrowUpIcon size={16} />} onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          </>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <KpiCards
        items={kpiItems}
        columns={3}
        onSelect={(key) => { setStage(KPI_STAGE[key] || 'All'); setPage(0); }}
        onDrill={(key, name) => { drillRegulator(name); setStage(KPI_STAGE[key] || 'All'); }}
      />

      <FilterBar
        search={{ value: searchInput, onChange: setSearchInput, placeholder: 'Search document title or reference...' }}
        filters={[
          { key: 'stage', label: 'Stage', value: stage, allLabel: 'All stages', minWidth: 170,
            onChange: (v) => { setStage(v); setPage(0); },
            options: STAGES.map((st) => ({ value: st.key, label: st.label })) },
          { key: 'regulator', label: 'Regulator', value: regulatorId, allLabel: 'All regulators', minWidth: 180,
            onChange: (v) => { setRegulatorId(v); setPage(0); },
            options: regulatorOptions.map((r) => ({ value: String(r.id), label: r.label })) },
        ]}
        showClear={hasFilters}
        onClear={clearFilters}
      />

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <ClockIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No documents found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth }}>{c.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.id} hover
                    onClick={() => row.type === 'instrument'
                      ? navigate(`${ROUTES.ADMIN_INSTRUMENTS}/${row.instrumentId}`)
                      : navigate(`${ROUTES.ADMIN_PIPELINE}`)}
                    sx={{ cursor: 'pointer', '& td': { verticalAlign: 'middle' } }}>
                    <TableCell sx={{ color: TL.gray500 }}>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'primary.main', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.title}
                      </Typography>
                      {row.errorMessage && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.errorMessage}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.regulatorAbbreviation && row.regulatorAbbreviation !== '—'
                        ? <Chip size="small" label={row.regulatorAbbreviation} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{stageChip(row.stage)}</TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem', color: TL.gray500, whiteSpace: 'nowrap' }}>{formatDt(row.discoveredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={load} />
    </Box>
  );
}