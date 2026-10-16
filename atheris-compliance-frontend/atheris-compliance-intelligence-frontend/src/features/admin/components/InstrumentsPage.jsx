import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Button, CircularProgress, Alert, IconButton,
  TableContainer, Paper, TablePagination, Tooltip,
} from '@mui/material';
import {
  PageHeader, FilterBar, instrumentColumns,
  EyeIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentTextIcon,
} from 'shared';
import api, { getToken, API_BASE, pdfErrorMessage } from '../../../services/api';
import InstrumentDetailContent from './detail/InstrumentDetailContent';

export default function InstrumentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [riskFilter, setRiskFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  // The top-bar search routes here as /admin/instruments?q=…; follow it even when already mounted.
  const urlQuery = searchParams.get('q');
  useEffect(() => { if (urlQuery != null) { setSearch(urlQuery); setPage(0); } }, [urlQuery]);
  const [rowsPerPage] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
        <PageHeader
          title={d.sourceTitle || 'Instrument'}
          subtitle={[detailData?.regulator || regMap[d.regulatorId], d.sourceReferenceNumber].filter(Boolean).join(' · ') || undefined}
          onBack={closeDetail}
          backLabel="Back to Instruments"
          actions={
            <>
              <Button variant="outlined" onClick={() => handleViewInstrument(d)} startIcon={<EyeIcon size={16} />}>
                View Instrument
              </Button>
              <Button variant="outlined" onClick={() => handleDownloadInstrument(d)} startIcon={<ArrowDownTrayIcon size={16} />}>
                Download
              </Button>
            </>
          }
        />

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
      <PageHeader
        title="Instruments"
        subtitle="Browse all regulatory instruments in the platform"
        actions={
          <Button variant="contained" startIcon={<ArrowUpTrayIcon size={16} />}
            onClick={() => navigate('/admin/uploads')}>
            Upload Instrument
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search title or regulator...' }}
        filters={[
          {
            key: 'risk', label: 'Risk', value: riskFilter, allLabel: 'All', minWidth: 130,
            onChange: (v) => { setRiskFilter(v); setPage(0); },
            options: ['High', 'Medium', 'Low'].map(r => ({ value: r, label: r })),
          },
          {
            key: 'regulator', label: 'Regulator', value: regulatorFilter, allLabel: 'All', minWidth: 150,
            onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: regulatorsList.filter(r => r !== 'All').map(r => ({ value: r, label: r })),
          },
          {
            key: 'status', label: 'Status', value: statusFilter, allLabel: 'All', minWidth: 140,
            onChange: (v) => { setStatusFilter(v); setPage(0); },
            options: statuses.filter(st => st !== 'All').map(st => ({ value: st, label: st })),
          },
        ]}
        showClear={!!(search || riskFilter !== 'All' || regulatorFilter !== 'All' || statusFilter !== 'All')}
        onClear={() => {
          setSearch(''); setRiskFilter('All'); setRegulatorFilter('All'); setStatusFilter('All');
        }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <DocumentTextIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No instruments found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {columns.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth }}>
                      {c.label}
                    </TableCell>
                  ))}
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map(item => {
                  return (
                    <TableRow key={item.instrumentId} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer' }}>
                      {columns.map(c => (
                        <TableCell key={c.id}>{c.render ? c.render(item) : (item[c.id] ?? '—')}</TableCell>
                      ))}
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton size="small" onClick={e => { e.stopPropagation(); openDetail(item); }}>
                            <EyeIcon size={16} />
                          </IconButton>
                        </Tooltip>
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
