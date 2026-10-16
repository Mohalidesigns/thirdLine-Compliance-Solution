import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TableSortLabel, TextField, MenuItem, Chip, Button,
  IconButton, Tooltip, CircularProgress, Alert, Menu,
} from '@mui/material';
import {
  Search, Refresh, Close, CloudUpload, CheckCircle, ErrorOutline, HourglassEmpty,
  ArrowDropDown, Description,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import UploadDialog from './UploadDialog';

/* One row = one DOCUMENT. Stage is derived from the instrument status; failed
   downloads (no instrument yet) are their own row. */
const STAGES = [
  { key: 'failed', label: 'Download Failed', color: '#C53030' },
  { key: 'extracted', label: 'Extracted', color: '#805AD5' },
  { key: 'classified', label: 'Classified', color: '#DD6B20' },
  { key: 'published', label: 'Published', color: '#2D7D46' },
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
  const s = STAGE_BY_KEY[stage] || { label: stage, color: '#718096' };
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

/* KPI card with a breakdown dropdown (regulator -> count). */
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Document Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''} — tracked through every pipeline stage
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

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        <KpiCard label="Total Documents" value={kpis.total.value} color="#2B6CB0"
          icon={<Description sx={{ fontSize: 18 }} />} breakdown={kpis.total.breakdown}
          onSelect={() => { setStage('All'); setPage(0); }}
          onDrill={(name) => { setRegulator(name); setStage('All'); setPage(0); }} />
        <KpiCard label="Failed Downloads" value={kpis.failed.value} color="#C53030"
          icon={<ErrorOutline sx={{ fontSize: 18 }} />} breakdown={kpis.failed.breakdown}
          onSelect={() => { setStage('failed'); setPage(0); }}
          onDrill={(name) => { setRegulator(name); setStage('failed'); setPage(0); }} />
        <KpiCard label="In Progress" value={kpis.inProgress.value} color="#DD6B20"
          icon={<HourglassEmpty sx={{ fontSize: 18 }} />} breakdown={kpis.inProgress.breakdown}
          onSelect={() => { setStage('extracted'); setPage(0); }}
          onDrill={(name) => { setRegulator(name); setStage('extracted'); setPage(0); }} />
        <KpiCard label="Completed" value={kpis.completed.value} color="#2D7D46"
          icon={<CheckCircle sx={{ fontSize: 18 }} />} breakdown={kpis.completed.breakdown}
          onSelect={() => { setStage('published'); setPage(0); }}
          onDrill={(name) => { setRegulator(name); setStage('published'); setPage(0); }} />
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search document title or regulator..." value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <TextField select size="small" value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }}
          label="Stage" sx={{ minWidth: 160 }}>
          <MenuItem value="All">All stages</MenuItem>
          {STAGES.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulator} onChange={(e) => { setRegulator(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 160 }}>
          <MenuItem value="All">All regulators</MenuItem>
          {externalRegulators.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Reference" value={reference}
          onChange={(e) => { setReference(e.target.value); setPage(0); }} sx={{ minWidth: 160 }} />
        {hasFilters && <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
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
                  {COLUMNS.map((c) => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
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
                {paged.map((row, idx) => (
                  <TableRow key={row.id} hover
                    onClick={() => row.source === 'instrument'
                      ? navigate(`${ROUTES.ADMIN_INSTRUMENTS}/${row.instrumentId}`)
                      : navigate(`${ROUTES.ADMIN_PIPELINE}/pending-${row.pendingId}`)}
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
                      {row.regulator && row.regulator !== '—'
                        ? <Chip size="small" label={row.regulator} sx={{ height: 22, borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{stageChip(row.stage)}</TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell sx={{ fontSize: '0.76rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(row.updatedAt)}</TableCell>
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