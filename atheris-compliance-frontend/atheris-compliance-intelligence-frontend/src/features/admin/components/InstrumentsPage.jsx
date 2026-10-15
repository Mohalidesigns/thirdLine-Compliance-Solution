import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton,
  Collapse, TableContainer, Paper, TablePagination, Tooltip,
} from '@mui/material';
import {
  PageHeader, FilterBar, DataCard, RiskBadge, StateBadge,
  EyeIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ChevronDownIcon, DocumentTextIcon,
} from 'shared';
import api, { getToken, API_BASE, pdfErrorMessage } from '../../../services/api';

const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 280 },
  { id: 'reference', label: 'Reference No', minWidth: 140 },
  { id: 'regulator', label: 'Regulator', minWidth: 100 },
  { id: 'risk', label: 'Risk', minWidth: 80 },
  { id: 'status', label: 'Status', minWidth: 90 },
  { id: 'actions', label: 'Actions', minWidth: 80, align: 'right' },
];

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function riskChip(rating) {
  return <RiskBadge value={rating} emptyLabel="Unrated" />;
}

function statusChip(status) {
  return <StateBadge value={status} emptyLabel="Unknown" />;
}

const FIELD_LABEL_SX = {
  fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block',
};

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
          <>
            <DataCard title="Overview" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                {riskChip(d.riskRating)}
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {detailData?.regulator || regMap[d.regulatorId] || '-'}
                </Typography>
                {statusChip(d.status)}
                <Chip size="small" label={d.areaOfFocus || 'General'} variant="outlined" />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Risk Rating</Typography>
                  <Box sx={{ mt: 0.5 }}>{riskChip(d.riskRating)}</Box>
                </Box>
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Regulator</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailData?.regulator || regMap[d.regulatorId] || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Area of Focus</Typography>
                  <Typography variant="body2">{d.areaOfFocus || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Nature</Typography>
                  <Typography variant="body2">{d.nature || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Obligations</Typography>
                  <Typography variant="body2">{detailData?.obligations?.length || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Confidence</Typography>
                  <Typography variant="body2">{d.applicabilityConfidence != null ? `${(d.applicabilityConfidence * 100).toFixed(0)}%` : '-'}</Typography>
                </Box>
                {d.dateCommencement && (
                  <Box>
                    <Typography variant="caption" sx={FIELD_LABEL_SX}>Effective Date</Typography>
                    <Typography variant="body2">{formatDate(d.dateCommencement)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" sx={FIELD_LABEL_SX}>Published</Typography>
                  <Typography variant="body2">{formatDate(d.firstPublishedAt || d.discoveredAt)}</Typography>
                </Box>
              </Box>
            </DataCard>

            {detailData?.aiSummary && (
              <DataCard title="AI Summary" sx={{ mb: 3 }}>
                <Typography variant="body2" fontStyle="italic" color="text.secondary">{detailData.aiSummary}</Typography>
              </DataCard>
            )}

            {detailData?.pdfOcrText && (
              <DataCard
                title="Raw OCR Text"
                noPadding
                sx={{ mb: 3 }}
                actions={
                  <Button size="small" variant="text" onClick={() => setShowOcr(!showOcr)}
                    endIcon={<ChevronDownIcon size={16} sx={{ transition: 'transform .15s', transform: showOcr ? 'rotate(180deg)' : 'none' }} />}>
                    {showOcr ? 'Hide' : 'Show'} Raw OCR Text
                  </Button>
                }
              >
                <Collapse in={showOcr}>
                  <Box sx={{
                    p: 2, bgcolor: '#1A1A2E', color: '#E2E8F0',
                    maxHeight: 400, overflow: 'auto', fontFamily: 'Roboto Mono, monospace',
                    fontSize: '0.75rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {detailData.pdfOcrText}
                  </Box>
                </Collapse>
              </DataCard>
            )}

            {detailData?.sanctions?.length > 0 && (
              <DataCard title="Penalties" sx={{ mb: 3 }}>
                {detailData.sanctions.map((s, i) => (
                  <Box key={i} sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                      {s.sanctionType}{s.amountNaira ? ` — ₦${s.amountNaira.toLocaleString()}` : ''}
                    </Typography>
                    {s.liableRoles?.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Liable: {s.liableRoles.join(', ')}
                      </Typography>
                    )}
                  </Box>
                ))}
              </DataCard>
            )}

            <DataCard title={`Obligations (${detailData?.obligations?.length || 0})`} noPadding>
              {detailData?.obligations?.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Section</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Deadline</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailData.obligations.map(obl => (
                        <TableRow key={obl.number} hover>
                          <TableCell>{obl.number}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 400 }}>{obl.statement}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={obl.sectionReference || '-'} variant="outlined" sx={{ fontFamily: '"Roboto Mono", monospace', fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{obl.type || '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{obl.recurringDeadline || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">No specific obligations extracted for this instrument.</Typography>
                </Box>
              )}
            </DataCard>
          </>
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
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} align={c.align} sx={{ minWidth: c.minWidth }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map(item => {
                  return (
                    <TableRow key={item.instrumentId} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Tooltip title={item.sourceTitle}>
                          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sourceTitle}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={item.sourceReferenceNumber || '-'}>
                          <Typography variant="body2" sx={{ fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem', color: 'text.secondary', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sourceReferenceNumber || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={regMap[item.regulatorId] || '-'}>
                          <Typography variant="body2" sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {regMap[item.regulatorId] || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{riskChip(item.riskRating)}</TableCell>
                      <TableCell>{statusChip(item.status)}</TableCell>
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
