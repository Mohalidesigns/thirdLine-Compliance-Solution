import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem,
  TableContainer, Paper, TablePagination, TableSortLabel, Tooltip, Snackbar,
  Alert as MuiAlert, Typography as MuiTypography,
} from '@mui/material';
import {
  Search, Close, Visibility, ArrowBack, Download,
  Article, CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api, getToken, API_BASE } from '../services/api';

const RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" sx={{ height: 22, borderRadius: '4px' }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px' }} />;
}

function formatNaira(amount) {
  if (amount == null) return '-';
  try {
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount);
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch { return String(amount); }
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 300, sortField: 'sourceTitle' },
  { id: 'regulator', label: 'Regulator', minWidth: 100, sortField: 'regulatorAbbreviation' },
  { id: 'risk', label: 'Risk', minWidth: 100, sortField: 'riskRating' },
  { id: 'obligations', label: 'Obligations', minWidth: 100, sortField: 'obligationCount' },
  { id: 'actions', label: 'Actions', minWidth: 80 },
];

const SANCTION_COLUMNS = [
  { id: 'type', label: 'Type', minWidth: 100 },
  { id: 'penalty', label: 'Penalty', minWidth: 140 },
  { id: 'section', label: 'Section', minWidth: 100 },
  { id: 'roles', label: 'Liable Roles', minWidth: 150 },
  { id: 'risk', label: 'Risk', minWidth: 120 },
];

export default function InstrumentsPage() {
  const navigate = useNavigate();
  const abortRef = useRef(null);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [detailId, setDetailId] = useState(null);
  const [snackbar, setSnackbar] = useState('');

  const hasFilters = search || riskFilter !== 'All' || regulatorFilter !== 'All';

  const { data: listData, isLoading: listLoading, error: listError } = useQuery({
    queryKey: ['instruments', page, rowsPerPage, search],
    queryFn: async ({ signal }) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = signal;
      return api.instruments.list(page, rowsPerPage, search, { signal });
    },
    keepPreviousData: true,
  });

  const items = useMemo(() => listData?.content || [], [listData]);

  const regulatorsList = useMemo(() => {
    const s = new Set(items.map(i => i.regulatorAbbreviation || i.regulatorName).filter(Boolean));
    return ['All', ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (regulatorFilter !== 'All') {
      result = result.filter(i => (i.regulatorAbbreviation || i.regulatorName) === regulatorFilter);
    }
    if (riskFilter !== 'All') {
      result = result.filter(i => i.riskRating === riskFilter);
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        let av = a[sortField] ?? '';
        let bv = b[sortField] ?? '';
        if (sortField === 'obligationCount') {
          av = Number(av) || 0;
          bv = Number(bv) || 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return result;
  }, [items, regulatorFilter, riskFilter, sortField, sortDir]);

  const kpis = useMemo(() => {
    const total = items.length;
    const critical = items.filter(i => i.riskRating === 'Critical' || i.riskRating === 'Extreme').length;
    const high = items.filter(i => i.riskRating === 'High').length;
    const published = items.filter(i => i.publishedAt || i.createdAt).length;
    return [
      { key: 'total', label: 'Total Instruments', value: total, color: '#2B6CB0', bg: '#EBF8FF' },
      { key: 'critical', label: 'Critical Risk', value: critical, color: '#E53E3E', bg: '#FFF5F5' },
      { key: 'high', label: 'High Risk', value: high, color: '#DD6B20', bg: '#FFFAF0' },
      { key: 'published', label: 'Published', value: published, color: '#38A169', bg: '#F0FFF4' },
    ];
  }, [items]);

  function applyKpiFilter(key) {
    setPage(0);
    if (key === 'critical') setRiskFilter('Critical');
    else if (key === 'high') setRiskFilter('High');
    else setRiskFilter('All');
  }

  function clearFilters() {
    setSearch('');
    setRiskFilter('All');
    setRegulatorFilter('All');
    setPage(0);
  }

  async function fetchPdfBlob(instrumentId) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/subscriptions/instruments/${instrumentId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to load PDF');
    return res.blob();
  }

  async function handleViewPdf(item) {
    try {
      const blob = await fetchPdfBlob(item.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setSnackbar('Failed to load PDF.');
    }
  }

  async function handleDownload(item) {
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
      setSnackbar('Failed to download PDF.');
    }
  }

  function openDetail(item) {
    setDetailId(item.id);
  }

  function closeDetail() {
    setDetailId(null);
  }

  if (detailId) {
    return <DetailView id={detailId} onBack={closeDetail} onSnackbar={setSnackbar} />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Instruments</Typography>
          <Typography variant="body2" color="text.secondary">
            Instruments confirmed into your obligations register
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<CloudUploadIcon />}
          onClick={() => navigate('/upload')} sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
          Upload Instrument
        </Button>
      </Box>

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError.message}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            onClick={() => applyKpiFilter(k.key)}
            sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${k.color}`,
              transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk" sx={{ minWidth: 110 }}>
          {['All', 'Critical', 'High', 'Moderate', 'Low'].map(r =>
            <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorFilter}
          onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 130 }}>
          {regulatorsList.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {listLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No confirmed instruments yet.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id}
                        sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                          cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                          else { setSortField(c.sortField); setSortDir('asc'); }
                          setPage(0);
                        } : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={sortDir}
                              sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                              {c.label}
                            </TableSortLabel>
                          : c.label}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(item => {
                  const risk = item.riskRating || 'Unrated';
                  return (
                    <TableRow key={item.id} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                      <TableCell>
                        <Tooltip title={item.sourceTitle || ''}>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sourceTitle || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {item.regulatorAbbreviation
                          ? <Chip size="small" label={item.regulatorAbbreviation}
                              sx={{ height: 22, fontWeight: 600, borderRadius: '4px', bgcolor: '#1A365D', color: '#fff' }} />
                          : <Typography variant="body2" color="text.secondary">-</Typography>}
                      </TableCell>
                      <TableCell>{riskChip(risk)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={item.obligationCount ?? 0}
                          sx={{ height: 22, fontWeight: 600, borderRadius: '4px' }} />
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button size="small" variant="text" startIcon={<Visibility />}
                          onClick={() => openDetail(item)} sx={{ minWidth: 0, px: 1 }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="error" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}

function DetailView({ id, onBack, onSnackbar }) {
  const { data: detailData, isLoading, error: detailError } = useQuery({
    queryKey: ['instrument', id],
    queryFn: () => api.instruments.get(id),
  });

  const d = detailData;
  const regulator = d?.regulatorAbbreviation || d?.regulatorName || '-';
  const risk = d?.riskRating || 'Unrated';

  async function handleViewPdf() {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load PDF');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      onSnackbar('Failed to load PDF.');
    }
  }

  async function handleDownload() {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d?.sourceTitle || 'instrument-' + id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      onSnackbar('Failed to download PDF.');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={onBack}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={handleViewPdf} startIcon={<Visibility />}>
          View PDF
        </Button>
        <Button variant="outlined" onClick={handleDownload} startIcon={<Download />}>
          Download
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : detailError ? (
        <Alert severity="error">{detailError.message}</Alert>
      ) : !d ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Typography variant="body1">Instrument not found.</Typography>
        </Paper>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {regulator}
              </Typography>
              <Chip size="small" label={d.documentType || 'Document'} variant="outlined" />
              {riskChip(risk)}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{d.sourceTitle}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Regulator</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{regulator}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Document Type</Typography>
                <Typography variant="body2">{d.documentType || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Issued</Typography>
                <Typography variant="body2">{formatDate(d.dateIssued || d.publishedAt || d.createdAt)}</Typography>
              </Box>
              {d.dateCommencement && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Commencement</Typography>
                  <Typography variant="body2">{formatDate(d.dateCommencement)}</Typography>
                </Box>
              )}
              {d.nature && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Nature</Typography>
                  <Typography variant="body2">{d.nature}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Risk</Typography>
                <Typography variant="body2">{risk}</Typography>
              </Box>
            </Box>
          </Paper>

          {d.aiSummary && (
            <Paper sx={{ p: 3, mb: 2, borderLeft: '4px solid', borderColor: 'primary.main', bgcolor: '#F8FAFF' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>AI Summary</Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary' }}>{d.aiSummary}</Typography>
            </Paper>
          )}

          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Obligations ({d.obligations?.length || 0})
              </Typography>
            </Box>
            {d.obligations?.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 40 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 280 }}>Obligation</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 100 }}>Risk</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 120 }}>Act</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 120 }}>Owner</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {d.obligations.map((obl, idx) => (
                      <TableRow key={obl.obligationId || idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          {obl.title && (
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, maxWidth: 400,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {obl.title}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary"
                            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              overflow: 'hidden', maxWidth: 400 }}>
                            {obl.plainEnglishStatement || obl.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{riskChip(obl.inherentRiskRating)}</TableCell>
                        <TableCell>
                          <Tooltip title={obl.actName || ''}>
                            <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {obl.actName || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{obl.controlOwner || '-'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No obligations extracted for this instrument.</Typography>
              </Box>
            )}
          </Paper>

          {d.sanctions?.length > 0 && (
            <Paper>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Penalties ({d.sanctions.length})
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {SANCTION_COLUMNS.map(c => (
                        <TableCell key={c.id} sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: c.minWidth }}>
                          {c.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {d.sanctions.map((s, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>
                          {s.sanctionType
                            ? <Chip size="small" label={s.sanctionType} variant="outlined"
                                sx={{ height: 22, borderRadius: '4px' }} />
                            : <Typography variant="body2" color="text.secondary">-</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                            {s.amountNaira != null ? formatNaira(s.amountNaira)
                              : s.penaltyDetails || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={s.sourceSectionReference || ''}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.72rem',
                              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.sourceSectionReference || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(Array.isArray(s.liableRoles) ? s.liableRoles : s.liableRoles ? String(s.liableRoles).split(',').map(r => r.trim()) : [])
                              .slice(0, 3).map((role, ri) => (
                                <Chip key={ri} size="small" label={role}
                                  sx={{ height: 20, fontSize: '0.65rem', borderRadius: '3px' }} />
                              ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={s.riskExplanation || ''}>
                            <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.severityScore != null ? `Sev ${s.severityScore}` : s.riskExplanation || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
