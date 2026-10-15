import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TableSortLabel, TextField, Chip, Button,
  CircularProgress, Alert,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, FilterField, StatusBadge, TL,
  ArrowPathIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon, DocumentTextIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import UploadDialog from './UploadDialog';

/* One row = one DOCUMENT. Stage is derived from the instrument status; failed
   downloads (no instrument yet) are their own row. */
const STAGES = [
  { key: 'failed', label: 'Download Failed', tone: 'red' },
  { key: 'extracted', label: 'Extracted', tone: 'purple' },
  { key: 'classified', label: 'Classified', tone: 'orange' },
  { key: 'published', label: 'Published', tone: 'green' },
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
  { id: 'title', label: 'Document', minWidth: 320, sortField: 'title' },
  { id: 'regulator', label: 'Regulator', minWidth: 160, sortField: 'regulator' },
  { id: 'stage', label: 'Stage', minWidth: 150, sortField: 'stage' },
  { id: 'status', label: 'Status', minWidth: 120, sortField: 'status' },
  { id: 'updatedAt', label: 'Discovered', minWidth: 150, sortField: 'updatedAt' },
];

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* Instrument status -> pipeline stage. */
function stageOfStatus(status) {
  if (status === 'Published') return 'published';
  if (status === 'Triage') return 'extracted';
  return 'classified';
}

function stageChip(stage) {
  const s = STAGE_BY_KEY[stage] || { label: stage, tone: 'gray' };
  return <StatusBadge label={s.label} tone={s.tone} />;
}

function statusChip(status) {
  const s = STATUS_CHIP[status] || { label: status || '—', tone: 'gray' };
  return <StatusBadge label={s.label} tone={s.tone} />;
}

/* KPI card key -> stage it filters to. */
const KPI_STAGE = { total: 'All', failed: 'failed', inProgress: 'extracted', completed: 'published' };

export default function JobQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [stage, setStage] = useState(searchParams.get('stage') || 'All');
  const [regulator, setRegulator] = useState(searchParams.get('regulator') || 'All');
  const [reference, setReference] = useState(searchParams.get('reference') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [rowsPerPage, setRowsPerPage] = useState(Number(searchParams.get('size') || 20));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || 'updatedAt');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'desc');

  const [rows, setRows] = useState([]);
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const alive = useRef(true);
  const reqId = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (stage !== 'All') p.stage = stage;
    if (regulator !== 'All') p.regulator = regulator;
    if (reference) p.reference = reference;
    if (page) p.page = String(page);
    if (rowsPerPage !== 20) p.size = String(rowsPerPage);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, stage, regulator, reference, page, rowsPerPage, sortField, sortDir, setSearchParams]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const [regsData, pendingData, pubData, triData] = await Promise.all([
        api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' }),
        api.platform.pendingDownloads.list('pending'),
        api.platform.instruments.list('status=Published&size=1000'),
        api.platform.instruments.list('status=Triage&size=1000'),
      ]);
      if (!alive.current || id !== reqId.current) return;
      const regs = Array.isArray(regsData) ? regsData : (regsData.content || []);
      setRegulators(regs);
      const regName = {};
      for (const r of regs) regName[r.regulatorId] = r.abbreviation || r.name || `Regulator #${r.regulatorId}`;

      const items = [];
      for (const inst of [...(pubData.content || []), ...(triData.content || [])]) {
        if (inst.uploadSource === 'toolkit_seed') continue;
        items.push({
          id: `inst-${inst.instrumentId}`,
          instrumentId: inst.instrumentId,
          source: 'instrument',
          title: inst.sourceTitle || 'Untitled document',
          reference: inst.sourceReferenceNumber || '',
          regulatorId: inst.regulatorId,
          regulator: regName[inst.regulatorId] || (inst.regulatorId != null ? `Regulator #${inst.regulatorId}` : '—'),
          stage: stageOfStatus(inst.status),
          status: inst.status,
          updatedAt: inst.discoveredAt,
        });
      }
      for (const pd of (pendingData || [])) {
        items.push({
          id: `pd-${pd.id}`,
          pendingId: pd.id,
          source: 'pending',
          title: pd.title || 'Untitled document',
          reference: '',
          regulatorId: pd.regulatorId,
          regulator: regName[pd.regulatorId] || `Regulator #${pd.regulatorId}`,
          stage: 'failed',
          status: 'failed',
          sourceUrl: pd.sourceUrl,
          errorMessage: pd.errorMessage,
          updatedAt: pd.discoveredAt || pd.createdAt,
        });
      }
      setRows(items);
    } catch (err) {
      if (alive.current && id === reqId.current) setError(err.message);
    } finally {
      if (alive.current && id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let out = rows;
    if (regulator !== 'All') out = out.filter((r) => r.regulator === regulator);
    if (stage !== 'All') out = out.filter((r) => r.stage === stage);
    if (reference) {
      const ref = reference.toLowerCase();
      out = out.filter((r) => (r.reference || '').toLowerCase().includes(ref));
    }
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter((r) =>
        (r.title || '').toLowerCase().includes(needle) ||
        (r.reference || '').toLowerCase().includes(needle) ||
        (r.regulator || '').toLowerCase().includes(needle));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...out].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === 'updatedAt') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      else { av = (av ?? '').toString().toLowerCase(); bv = (bv ?? '').toString().toLowerCase(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, regulator, stage, reference, q, sortField, sortDir]);

  const kpis = useMemo(() => {
    const byReg = (pred) => {
      const m = {};
      for (const r of rows) if (pred(r)) m[r.regulator] = (m[r.regulator] || 0) + 1;
      return m;
    };
    return {
      total: { value: rows.length, breakdown: byReg(() => true) },
      failed: { value: rows.filter((r) => r.stage === 'failed').length, breakdown: byReg((r) => r.stage === 'failed') },
      inProgress: { value: rows.filter((r) => r.stage === 'extracted' || r.stage === 'classified').length,
        breakdown: byReg((r) => r.stage === 'extracted' || r.stage === 'classified') },
      completed: { value: rows.filter((r) => r.stage === 'published').length, breakdown: byReg((r) => r.stage === 'published') },
    };
  }, [rows]);

  const externalRegulators = useMemo(
    () => regulators.map((r) => r.abbreviation || r.name).sort(), [regulators]);

  const hasFilters = !!searchInput || stage !== 'All' || regulator !== 'All' || !!reference;

  function clearFilters() {
    setSearchInput(''); setQ(''); setStage('All'); setRegulator('All'); setReference(''); setPage(0);
  }

  function handleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const kpiItems = [
    { key: 'total', label: 'Total Documents', value: kpis.total.value, tone: 'blue',
      icon: <DocumentTextIcon />, breakdown: kpis.total.breakdown },
    { key: 'failed', label: 'Failed Downloads', value: kpis.failed.value, tone: 'red',
      icon: <ExclamationCircleIcon />, breakdown: kpis.failed.breakdown },
    { key: 'inProgress', label: 'In Progress', value: kpis.inProgress.value, tone: 'orange',
      icon: <ClockIcon />, breakdown: kpis.inProgress.breakdown },
    { key: 'completed', label: 'Completed', value: kpis.completed.value, tone: 'green',
      icon: <CheckCircleIcon />, breakdown: kpis.completed.breakdown },
  ];

  return (
    <Box>
      <PageHeader
        title="Document Pipeline"
        subtitle={`${filtered.length} document${filtered.length !== 1 ? 's' : ''} — tracked through every pipeline stage`}
        actions={(
          <>
            <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={load}>Refresh</Button>
            <Button variant="contained" startIcon={<CloudArrowUpIcon size={16} />} onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          </>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <KpiCards
        items={kpiItems}
        columns={4}
        onSelect={(key) => { setStage(KPI_STAGE[key] || 'All'); setPage(0); }}
        onDrill={(key, name) => { setRegulator(name); setStage(KPI_STAGE[key] || 'All'); setPage(0); }}
      />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search document title or regulator...' }}
        filters={[
          { key: 'stage', label: 'Stage', value: stage, allLabel: 'All stages', minWidth: 160,
            onChange: (v) => { setStage(v); setPage(0); },
            options: STAGES.map((st) => ({ value: st.key, label: st.label })) },
          { key: 'regulator', label: 'Regulator', value: regulator, allLabel: 'All regulators', minWidth: 160,
            onChange: (v) => { setRegulator(v); setPage(0); },
            options: externalRegulators.map((r) => ({ value: r, label: r })) },
        ]}
        showClear={hasFilters}
        onClear={clearFilters}
      >
        <FilterField label="Reference" minWidth={160}>
          <TextField size="small" value={reference}
            onChange={(e) => { setReference(e.target.value); setPage(0); }}
            sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
        </FilterField>
      </FilterBar>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
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
                  {COLUMNS.map((c) => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth,
                        cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(c.sortField)}>
                        <TableSortLabel active={active} direction={active ? sortDir : 'asc'}
                          sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                          {c.label}
                        </TableSortLabel>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((row) => (
                  <TableRow key={row.id} hover
                    onClick={() => row.source === 'instrument'
                      ? navigate(`${ROUTES.ADMIN_INSTRUMENTS}/${row.instrumentId}`)
                      : navigate(`${ROUTES.ADMIN_PIPELINE}/pending-${row.pendingId}`)}
                    sx={{ cursor: 'pointer', '& td': { verticalAlign: 'middle' } }}>
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
                      {row.regulator && row.regulator !== '—'
                        ? <Chip size="small" label={row.regulator} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{stageChip(row.stage)}</TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem', color: TL.gray500, whiteSpace: 'nowrap' }}>{formatDt(row.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page}
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