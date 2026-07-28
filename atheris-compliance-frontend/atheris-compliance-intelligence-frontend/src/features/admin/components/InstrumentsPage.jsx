import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem,
  Collapse, TableContainer, Paper, TablePagination, Card, CardContent,
} from '@mui/material';
import {
  Visibility, Search, Close, ExpandMore, ExpandLess,
  Article, CalendarToday, CloudUpload as CloudUploadIcon, ArrowBack,
} from '@mui/icons-material';
import api from '../../../services/api';

const RISK_CONFIG = {
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 280 },
  { id: 'regulator', label: 'Regulator', minWidth: 100 },
  { id: 'risk', label: 'Risk', minWidth: 80 },
  { id: 'status', label: 'Status', minWidth: 90 },
  { id: 'published', label: 'Published', minWidth: 110 },
  { id: 'actions', label: 'Actions', minWidth: 100 },
];

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
  }

  // ── Detail View ──
  if (detailItem) {
    const d = detailItem;
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={closeDetail}><ArrowBack /></IconButton>
          <Box sx={{ flex: 1 }} />
          {d.pdfUrl && (
            <Button variant="outlined" href={d.pdfUrl} target="_blank" startIcon={<Visibility />}>
              View PDF
            </Button>
          )}
        </Box>

        {detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            <Paper sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                {riskChip(d.riskRating)}
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {detailData?.regulator || regMap[d.regulatorId] || '-'}
                </Typography>
                {statusChip(d.status)}
                <Chip size="small" label={d.areaOfFocus || 'General'} variant="outlined" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{d.sourceTitle}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Risk Rating</Typography>
                  <Box sx={{ mt: 0.5 }}>{riskChip(d.riskRating)}</Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Regulator</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailData?.regulator || regMap[d.regulatorId] || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Area of Focus</Typography>
                  <Typography variant="body2">{d.areaOfFocus || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Nature</Typography>
                  <Typography variant="body2">{d.nature || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Obligations</Typography>
                  <Typography variant="body2">{detailData?.obligations?.length || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Confidence</Typography>
                  <Typography variant="body2">{d.applicabilityConfidence != null ? `${(d.applicabilityConfidence * 100).toFixed(0)}%` : '-'}</Typography>
                </Box>
                {d.dateCommencement && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Effective Date</Typography>
                    <Typography variant="body2">{formatDate(d.dateCommencement)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Published</Typography>
                  <Typography variant="body2">{formatDate(d.firstPublishedAt || d.discoveredAt)}</Typography>
                </Box>
              </Box>
            </Paper>

            {detailData?.aiSummary && (
              <Paper sx={{ p: 3, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>AI Summary</Typography>
                <Typography variant="body2" fontStyle="italic" color="text.secondary">{detailData.aiSummary}</Typography>
              </Paper>
            )}

            {detailData?.pdfOcrText && (
              <Paper sx={{ mb: 2 }}>
                <Button size="small" onClick={() => setShowOcr(!showOcr)}
                  endIcon={showOcr ? <ExpandLess /> : <ExpandMore />} sx={{ px: 2, py: 1 }}>
                  {showOcr ? 'Hide' : 'Show'} Raw OCR Text
                </Button>
                <Collapse in={showOcr}>
                  <Box sx={{
                    p: 2, bgcolor: '#1A1A2E', color: '#E2E8F0',
                    maxHeight: 400, overflow: 'auto', fontFamily: 'Roboto Mono, monospace',
                    fontSize: '0.75rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
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
                      {s.sanctionType}{s.amountNaira ? ` — ₦${s.amountNaira.toLocaleString()}` : ''}
                    </Typography>
                    {s.liableRoles?.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Liable: {s.liableRoles.join(', ')}
                      </Typography>
                    )}
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
                        <TableCell sx={{ fontWeight: 700 }}>Deadline</TableCell>
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
                            <Chip size="small" label={obl.sectionReference || '-'} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
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
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>
                      {c.label}
                    </TableCell>
                  ))}
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
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sourceTitle}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{regMap[item.regulatorId] || '-'}</Typography>
                      </TableCell>
                      <TableCell>{riskChip(item.riskRating)}</TableCell>
                      <TableCell>{statusChip(item.status)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday sx={{ fontSize: 13, color: 'text.secondary' }} />
                          <Typography variant="body2">{formatDate(item.firstPublishedAt || item.discoveredAt)}</Typography>
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
          <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        </Paper>
      )}
    </Box>
  );
}
