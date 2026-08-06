import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem,
  Collapse, TableContainer, Paper, TablePagination, Tooltip,
} from '@mui/material';
import {
  Visibility, Search, Close, ExpandMore, ExpandLess,
  Article, CalendarToday, CloudUpload as CloudUploadIcon, ArrowBack, Download,
} from '@mui/icons-material';
import { api, getToken, API_BASE } from '../services/api';

const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 280 },
  { id: 'regulator', label: 'Regulator', minWidth: 100 },
  { id: 'obligations', label: 'Obligations', minWidth: 100 },
  { id: 'published', label: 'Published', minWidth: 110 },
  { id: 'actions', label: 'Actions', minWidth: 100 },
];

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InstrumentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showOcr, setShowOcr] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.instruments.list(page, rowsPerPage, search)
      .then(data => setItems(data.content || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  const regulatorsList = useMemo(() => {
    const s = new Set(items.map(i => i.regulatorAbbreviation || i.regulatorName).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (regulatorFilter !== 'All' && (i.regulatorAbbreviation || i.regulatorName) !== regulatorFilter) return false;
      return true;
    });
  }, [items, regulatorFilter]);

  async function openDetail(item) {
    setDetailItem(item);
    setDetailLoading(true);
    setDetailData(null);
    setShowOcr(false);
    try {
      const data = await api.instruments.get(item.id);
      setDetailData(data);
    } catch {
      setError('Failed to load detail.');
    } finally { setDetailLoading(false); }
  }

  function closeDetail() {
    setDetailItem(null);
    setDetailData(null);
    setShowOcr(false);
  }

  async function fetchPdfBlob(instrumentId) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/subscriptions/instruments/${instrumentId}/pdf`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to load PDF');
    return await res.blob();
  }

  async function handleViewInstrument(item) {
    try {
      const blob = await fetchPdfBlob(item.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setError('Failed to load PDF.');
    }
  }

  async function handleDownloadInstrument(item) {
    try {
      const blob = await fetchPdfBlob(item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.sourceTitle || 'instrument-' + item.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download PDF.');
    }
  }

  // ── Detail View ──
  if (detailItem) {
    const d = detailItem;
    const regulator = detailData?.regulatorAbbreviation || detailData?.regulatorName || d.regulatorAbbreviation || d.regulatorName || '-';
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

        {detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            <Paper sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {regulator}
                </Typography>
                <Chip size="small" label={detailData?.documentType || d.documentType || 'Document'} variant="outlined" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{d.sourceTitle}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Regulator</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{regulator}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Document Type</Typography>
                  <Typography variant="body2">{detailData?.documentType || d.documentType || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Obligations</Typography>
                  <Typography variant="body2">{detailData?.obligations?.length || 0}</Typography>
                </Box>
                {detailData?.obligations?.some(o => o.effectiveDate) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Effective Date</Typography>
                    <Typography variant="body2">{formatDate(detailData.obligations.find(o => o.effectiveDate).effectiveDate)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Published</Typography>
                  <Typography variant="body2">{formatDate(d.publishedAt || d.createdAt)}</Typography>
                </Box>
              </Box>
            </Paper>

            {detailData?.aiSummary && (
              <Paper sx={{ p: 3, mb: 2, borderLeft: '4px solid', borderColor: 'primary.main', bgcolor: '#F8FAFF' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>AI Summary</Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary' }}>{detailData.aiSummary}</Typography>
              </Paper>
            )}

            {detailData?.pdfOcrText && (
              <Paper sx={{ mb: 2 }}>
                <Box onClick={() => setShowOcr(!showOcr)}
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    px: 2, py: 1.25, bgcolor: '#F7FAFC', cursor: 'pointer', userSelect: 'none',
                    '&:hover': { bgcolor: '#EDF2F7' } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Extracted Text</Typography>
                  {showOcr ? <ExpandLess /> : <ExpandMore />}
                </Box>
                <Collapse in={showOcr}>
                  <Box sx={{
                    p: 2.5, bgcolor: '#FAFBFD', borderTop: '1px solid', borderColor: 'divider',
                    maxHeight: 400, overflow: 'auto', fontFamily: "'Roboto Mono', 'SFMono-Regular', Consolas, monospace",
                    fontSize: '0.8rem', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {detailData.pdfOcrText}
                  </Box>
                </Collapse>
              </Paper>
            )}

            {detailData?.sanctions?.length > 0 && (
              <Paper sx={{ p: 3, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Penalties</Typography>
                {detailData.sanctions.map((s, i) => (
                  <Box key={i} sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                      {s.type || s.description || 'Penalty'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.description && s.type ? s.description : ''}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}

            <Paper>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Obligations ({detailData?.obligations?.length || 0})
                </Typography>
              </Box>
              {detailData?.obligations?.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Section</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Effective</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailData.obligations.map((obl, idx) => (
                        <TableRow key={obl.obligationId || idx} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 400 }}>{obl.description}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={obl.section || '-'} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{obl.type || '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatDate(obl.effectiveDate)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={obl.status || 'active'} variant="outlined"
                              sx={{ height: 22, fontWeight: 600, color: 'success.main', borderColor: 'success.main' }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">No obligations saved for this instrument.</Typography>
                </Box>
              )}
            </Paper>
          </>
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
            Instruments confirmed into your obligations register
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<CloudUploadIcon />}
          onClick={() => navigate('/uploads')}>
          Upload Instrument
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 220 }} />
        <TextField select size="small" value={regulatorFilter} onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 130 }}>
          {regulatorsList.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {(search || regulatorFilter !== 'All') && (
          <Button size="small" startIcon={<Close />} onClick={() => {
            setSearch(''); setRegulatorFilter('All');
          }}>Clear</Button>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No confirmed instruments yet. Review and save items from the Review Inbox.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map(item => {
                  return (
                    <TableRow key={item.id} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                      <TableCell>
                        <Tooltip title={item.sourceTitle}>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sourceTitle}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={item.regulatorAbbreviation || item.regulatorName || '-'}>
                          <Typography variant="body2" sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.regulatorAbbreviation || item.regulatorName || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={item.obligationCount ?? 0} variant="outlined" sx={{ height: 22, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday sx={{ fontSize: 13, color: 'text.secondary' }} />
                          <Typography variant="body2">{formatDate(item.publishedAt || item.createdAt)}</Typography>
                        </Box>
                      </TableCell>
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
          <TablePagination component="div" count={items.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        </Paper>
      )}
    </Box>
  );
}
