import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem,
  Collapse, TableContainer, Paper, TablePagination, Card, CardContent, Tooltip,
} from '@mui/material';
import {
  Visibility, Search, Close, ExpandMore, ExpandLess,
  Article, CloudUpload as CloudUploadIcon, ArrowBack, Download,
} from '@mui/icons-material';
import api, { getToken, API_BASE, pdfErrorMessage } from '../../../services/api';
import { instrumentColumns } from 'shared';
import InstrumentDetailContent from './detail/InstrumentDetailContent';

const RISK_CONFIG = {
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22 }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, fontWeight: 600 }} />;
}

function statusChip(status) {
  const colors = { Published: 'success', Triage: 'warning', Superseded: 'default', Withdrawn: 'error' };
  return <Chip size="small" label={status || 'Unknown'} color={colors[status] || 'default'} sx={{ height: 22, fontWeight: 600 }} />;
}

export default function InstrumentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  useEffect(() => {
    Promise.all([
      api.platform.instruments.list(`size=100&page=${page}`),
      api.platform.regulators.list(),
    ]).then(([instrData, regData]) => {
      setItems(instrData.content || []);
      setRegulators(Array.isArray(regData) ? regData : (regData.content || []));
    }).catch(err => setError(err.message))
    .finally(() => setLoading(false));
  }, [page]);

  const regMap = useMemo(() => {
    const m = {};
    regulators.forEach(r => { m[r.regulatorId] = r.abbreviation || r.name; });
    return m;
  }, [regulators]);

  const regulatorsList = useMemo(() => ['All', ...regulators.map(r => r.abbreviation || r.name).filter(Boolean)], [regulators]);
  const columns = useMemo(() => instrumentColumns({ regMap }), [regMap]);

  const statuses = useMemo(() => {
    const s = new Set(items.map(i => i.status).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (riskFilter !== 'All' && i.riskRating !== riskFilter) return false;
      if (regulatorFilter !== 'All' && regMap[i.regulatorId] !== regulatorFilter) return false;
      if (statusFilter !== 'All' && i.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = (i.sourceTitle || '').toLowerCase();
        const reg = (regMap[i.regulatorId] || '').toLowerCase();
        if (!title.includes(q) && !reg.includes(q)) return false;
      }
      return true;
    });
  }, [items, riskFilter, regulatorFilter, statusFilter, search, regMap]);

  async function openDetail(item) {
    setDetailItem(item);
    setDetailLoading(true);
    setDetailData(null);
    setShowOcr(false);
    setError('');
    try {
      const data = await api.platform.instruments.get(item.instrumentId);
      setDetailData(data);
    } catch {
      setError('Failed to load detail.');
    } finally { setDetailLoading(false); }
  }

  function closeDetail() {
    setDetailItem(null);
    setDetailData(null);
    setShowOcr(false);
    setError('');
  }

  async function fetchPdfBlob(instrumentId) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/intelligence/obligations/${instrumentId}/pdf`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await pdfErrorMessage(res));
    return await res.blob();
  }

  async function handleViewInstrument(item) {
    try {
      const blob = await fetchPdfBlob(item.instrumentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message || 'Failed to load PDF.');
    }
  }

  async function handleDownloadInstrument(item) {
    try {
      const blob = await fetchPdfBlob(item.instrumentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.sourceTitle || 'instrument-' + item.instrumentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Failed to download PDF.');
    }
  }

  // ── Detail View ──
  if (detailItem) {
    const d = detailItem;
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={closeDetail}><ArrowBack /></IconButton>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={() => handleViewInstrument(d)} startIcon={<Visibility />}>
            View Instrument
          </Button>
          <Button variant="outlined" onClick={() => handleDownloadInstrument(d)} startIcon={<Download />}>
            Download
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : (
          <InstrumentDetailContent
            row={d}
            detail={detailData}
            regulatorLabel={regMap[d.regulatorId]}
          />
        )}
      </Box>
    );
  }

  // ── List View ──
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Instruments</Typography>
          <Typography variant="body2" color="text.secondary">
            Browse all regulatory instruments in the platform
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<CloudUploadIcon />}
          onClick={() => navigate('/admin/uploads')}>
          Upload Instrument
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 220 }} />
        <TextField select size="small" value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk" sx={{ minWidth: 110 }}>
          {['All', 'High', 'Medium', 'Low'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorFilter} onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 130 }}>
          {regulatorsList.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 120 }}>
          {statuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        {(search || riskFilter !== 'All' || regulatorFilter !== 'All' || statusFilter !== 'All') && (
          <Button size="small" startIcon={<Close />} onClick={() => {
            setSearch(''); setRiskFilter('All'); setRegulatorFilter('All'); setStatusFilter('All');
          }}>Clear</Button>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No instruments found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {columns.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>
                      {c.label}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map(item => {
                  const rc = RISK_CONFIG[item.riskRating] || {};
                  return (
                    <TableRow key={item.instrumentId} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer', bgcolor: rc.bg || 'inherit',
                        '&:hover': { bgcolor: rc.bg || '#F7FAFC' },
                        borderLeft: rc.chip ? `3px solid ${rc.chip}` : '3px solid transparent',
                      }}>
                      {columns.map(c => (
                        <TableCell key={c.id}>{c.render ? c.render(item) : (item[c.id] ?? '—')}</TableCell>
                      ))}
                      <TableCell>
                        <Button size="small" variant="text" startIcon={<Visibility />}
                          onClick={e => { e.stopPropagation(); openDetail(item); }} sx={{ minWidth: 0, px: 1 }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        </Paper>
      )}
    </Box>
  );
}
