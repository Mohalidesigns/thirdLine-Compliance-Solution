import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, MenuItem, Chip, Button, IconButton, Tooltip,
  CircularProgress, Alert, Menu,
} from '@mui/material';
import {
  Search, Refresh, Close, CloudUpload, CheckCircle, ErrorOutline, HourglassEmpty,
  ArrowDropDown, Description,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import UploadDialog from './UploadDialog';

/* One row = one DOCUMENT (non-toolkit). Stage vocabulary comes from the backend
   (PipelineService.stageOf): failed | extracting | classified | published | superseded | withdrawn. */
const STAGES = [
  { key: 'failed', label: 'Download Failed', color: '#C53030' },
  { key: 'extracting', label: 'Extracting', color: '#805AD5' },
  { key: 'classified', label: 'Classified', color: '#DD6B20' },
  { key: 'published', label: 'Published', color: '#2D7D46' },
  { key: 'superseded', label: 'Superseded', color: '#718096' },
  { key: 'withdrawn', label: 'Withdrawn', color: '#718096' },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]));

const STATUS_CHIP = {
  Published: { label: 'Published', color: '#2D7D46' },
  Triage: { label: 'In Progress', color: '#DD6B20' },
  Superseded: { label: 'Superseded', color: '#718096' },
  Withdrawn: { label: 'Withdrawn', color: '#C53030' },
  failed: { label: 'Failed', color: '#C53030' },
};

const COLUMNS = [
  { id: 'title', label: 'Document', minWidth: 320 },
  { id: 'regulator', label: 'Regulator', minWidth: 160 },
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
  const s = STAGE_BY_KEY[stage] || { label: stage || '—', color: '#718096' };
  return (
    <Chip size="small" label={s.label}
      sx={{ height: 22, borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem', bgcolor: `${s.color}18`, color: s.color }} />
  );
}

function statusChip(status) {
  const s = STATUS_CHIP[status] || { label: status || '—', color: '#718096' };
  return (
    <Chip size="small" label={s.label}
      sx={{ height: 22, borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem', bgcolor: `${s.color}18`, color: s.color }} />
  );
}

/* KPI card with a breakdown dropdown (label -> count). Clicking the card applies the card's
   filter; clicking a breakdown entry narrows that filter to one regulator. */
function KpiCard({ label, value, color, icon, breakdown, onSelect, onDrill }) {
  const [anchor, setAnchor] = useState(null);
  const entries = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Paper elevation={0} variant="outlined"
      onClick={onSelect}
      sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${color}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ color, opacity: 0.55, display: 'flex' }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
        </Box>
        {entries.length > 0 && (
          <IconButton size="small" aria-label={`${label} breakdown`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
            <ArrowDropDown fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color }}>{value}</Typography>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={(e) => e.stopPropagation()}>
        {entries.map(([name, count]) => (
          <MenuItem key={name} dense onClick={() => { setAnchor(null); onDrill(name); }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, width: '100%' }}>
              <span>{name}</span>
              <span style={{ color: '#718096' }}>{count}</span>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}

export default function JobQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [stage, setStage] = useState(searchParams.get('stage') || 'All');
  const [regulatorId, setRegulatorId] = useState(searchParams.get('regulatorId') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [rowsPerPage, setRowsPerPage] = useState(Number(searchParams.get('size') || 20));

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const reqId = useRef(0);

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
  useEffect(() => {
    const ctrl = new AbortController();
    api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' })
      .then((data) => setRegulators(Array.isArray(data) ? data : (data.content || [])))
      .catch(() => { /* filter degrades gracefully */ });
    return () => ctrl.abort();
  }, []);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (stage !== 'All') params.set('stage', stage);
      if (regulatorId !== 'All') params.set('regulatorId', regulatorId);
      params.set('page', String(page));
      params.set('size', String(rowsPerPage));

      const [listData, statsData] = await Promise.all([
        api.platform.pipeline.list(params.toString(), ctrl.signal),
        api.platform.pipeline.stats(ctrl.signal),
      ]);
      if (id !== reqId.current) return;
      setRows(Array.isArray(listData?.content) ? listData.content : []);
      setTotal(Number(listData?.totalElements || 0));
      setStats(statsData || null);
    } catch (err) {
      if (id === reqId.current && err.name !== 'AbortError') setError(err.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [q, stage, regulatorId, page, rowsPerPage]);

  useEffect(() => { load(); }, [load]);

  const regulatorOptions = useMemo(
    () => regulators.map((r) => ({
      id: r.regulatorId,
      label: r.abbreviation || r.name || `Regulator #${r.regulatorId}`,
    })).sort((a, b) => (a.label || '').localeCompare(b.label || '')),
    [regulators],
  );

  const idByLabel = useMemo(() => {
    const m = {};
    for (const o of regulatorOptions) m[o.label] = o.id;
    return m;
  }, [regulatorOptions]);

  const kpis = useMemo(() => ({
    total: { value: stats?.totalDownloads ?? 0, breakdown: stats?.byRegulator || {} },
    failed: { value: stats?.failedDownloads ?? 0, breakdown: stats?.byRegulator || {} },
    completed: { value: stats?.completed ?? 0, breakdown: stats?.byRegulator || {} },
  }), [stats]);

  const hasFilters = !!q || stage !== 'All' || regulatorId !== 'All';

  function clearFilters() {
    setSearchInput(''); setQ(''); setStage('All'); setRegulatorId('All'); setPage(0);
  }

  function drillRegulator(label) {
    const id = idByLabel[label];
    if (id !== undefined) setRegulatorId(String(id));
    setPage(0);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Document Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} document{total !== 1 ? 's' : ''} — the AI pipeline (toolkit-seeded regulations are excluded)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="contained" startIcon={<CloudUpload />} size="medium"
            onClick={() => setUploadOpen(true)} sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            Upload Document
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={load}><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI cards — each drill matches the card's own number */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
        <KpiCard label="Total Downloads" value={kpis.total.value} color="#2B6CB0"
          icon={<Description sx={{ fontSize: 18 }} />} breakdown={kpis.total.breakdown}
          onSelect={() => { setStage('All'); setPage(0); }}
          onDrill={drillRegulator} />
        <KpiCard label="Failed Downloads" value={kpis.failed.value} color="#C53030"
          icon={<ErrorOutline sx={{ fontSize: 18 }} />} breakdown={kpis.failed.breakdown}
          onSelect={() => { setStage('failed'); setPage(0); }}
          onDrill={(name) => { drillRegulator(name); setStage('failed'); }} />
        <KpiCard label="Total Completed" value={kpis.completed.value} color="#2D7D46"
          icon={<CheckCircle sx={{ fontSize: 18 }} />} breakdown={kpis.completed.breakdown}
          onSelect={() => { setStage('published'); setPage(0); }}
          onDrill={(name) => { drillRegulator(name); setStage('published'); }} />
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search document title or reference..." value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 280 }} />
        <TextField select size="small" value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }}
          label="Stage" sx={{ minWidth: 170 }}>
          <MenuItem value="All">All stages</MenuItem>
          {STAGES.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorId} onChange={(e) => { setRegulatorId(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 180 }}>
          <MenuItem value="All">All regulators</MenuItem>
          {regulatorOptions.map((r) => <MenuItem key={r.id} value={String(r.id)}>{r.label}</MenuItem>)}
        </TextField>
        {hasFilters && <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <HourglassEmpty sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No documents found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 50 }}>#</TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.id} hover
                    onClick={() => row.type === 'instrument'
                      ? navigate(`${ROUTES.ADMIN_INSTRUMENTS}/${row.instrumentId}`)
                      : navigate(`${ROUTES.ADMIN_PIPELINE}`)}
                    sx={{ cursor: 'pointer', '& td': { py: 1.25, verticalAlign: 'middle' }, '&:hover': { bgcolor: '#F7FAFC' } }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        ? <Chip size="small" label={row.regulatorAbbreviation} sx={{ height: 22, borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{stageChip(row.stage)}</TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell sx={{ fontSize: '0.76rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(row.discoveredAt)}</TableCell>
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
