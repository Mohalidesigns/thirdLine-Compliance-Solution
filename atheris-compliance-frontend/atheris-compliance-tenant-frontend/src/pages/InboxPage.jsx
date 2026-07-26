import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse, Checkbox,
  Snackbar, TableContainer, Paper, TablePagination,
} from '@mui/material';
import {
  Visibility, CheckCircle, Cancel, Search, Close, ExpandMore, ExpandLess,
  Article, CalendarToday, CloudUpload as CloudUploadIcon, ArrowBack,
} from '@mui/icons-material';
import { api } from '../services/api';

const RISK_CONFIG = {
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 280 },
  { id: 'regulator', label: 'Regulator', minWidth: 100 },
  { id: 'risk', label: 'Risk', minWidth: 80 },
  { id: 'type', label: 'Type', minWidth: 100 },
  { id: 'published', label: 'Published', minWidth: 110 },
  { id: 'actions', label: 'Actions', minWidth: 180 },
];

export default function InboxPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [checkedObligations, setCheckedObligations] = useState(new Set());
  const [classifying, setClassifying] = useState(false);
  const [snack, setSnack] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.inbox.list(page, rowsPerPage);
      setItems(data.content || []);
    } catch { setError('Failed to load.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]);

  const regulators = useMemo(() => {
    const set = new Set(items.map(i => i.regulatorAbbreviation || i.regulatorName).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [items]);

  const types = useMemo(() => {
    const set = new Set(items.map(i => i.documentType).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (riskFilter !== 'All' && i.platformRiskRating !== riskFilter) return false;
      if (regulatorFilter !== 'All' && (i.regulatorAbbreviation || i.regulatorName) !== regulatorFilter) return false;
      if (typeFilter !== 'All' && i.documentType !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = (i.sourceTitle || '').toLowerCase();
        const reg = (i.regulatorAbbreviation || i.regulatorName || '').toLowerCase();
        if (!title.includes(q) && !reg.includes(q)) return false;
      }
      return true;
    });
  }, [items, riskFilter, regulatorFilter, typeFilter, search]);

  async function openDetail(item) {
    setDetailItem(item);
    setDetailLoading(true);
    setDetailData(null);
    setCheckedObligations(new Set());
    setShowOcr(false);
    try {
      const data = await api.obligations.detail(item.instrumentId);
      setDetailData(data);
    } catch {
      setSnack({ severity: 'error', message: 'Failed to load detail.' });
    } finally { setDetailLoading(false); }
  }

  function closeDetail() {
    setDetailItem(null);
    setDetailData(null);
    setCheckedObligations(new Set());
    setShowOcr(false);
  }

  function toggleObligation(obligationId) {
    setCheckedObligations(prev => {
      const next = new Set(prev);
      if (next.has(obligationId)) next.delete(obligationId);
      else next.add(obligationId);
      return next;
    });
  }

  async function handleClassify(instrumentId, applicability) {
    setClassifying(true);
    try {
      await api.obligations.classify(instrumentId, { applicability });
      setSnack({ severity: 'success', message: `Marked as ${applicability}` });
      closeDetail();
      load();
    } catch (e) {
      setSnack({ severity: 'error', message: e.message });
    } finally { setClassifying(false); }
  }

  function riskChip(rating) {
    const cfg = RISK_CONFIG[rating];
    if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22 }} />;
    return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, fontWeight: 600 }} />;
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ───────────────────────── Detail View ─────────────────────────
  if (detailItem) {
    const d = detailItem;
    const rc = RISK_CONFIG[d.platformRiskRating] || {};
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
          <Button variant="contained" color="success" startIcon={<CheckCircle />}
            disabled={classifying}
            onClick={() => handleClassify(d.instrumentId, 'applicable')}>
            {classifying ? <CircularProgress size={18} /> : 'Mark Applicable'}
          </Button>
          <Button variant="outlined" color="error" startIcon={<Cancel />}
            disabled={classifying}
            onClick={() => handleClassify(d.instrumentId, 'not_applicable')}>
            Not Applicable
          </Button>
        </Box>

        {detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            {/* Metadata */}
            <Paper sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                {riskChip(d.platformRiskRating)}
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {d.regulatorAbbreviation || d.regulatorName}
                </Typography>
                <Chip size="small" label={d.documentType || 'Document'} variant="outlined" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{d.sourceTitle}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Risk Rating</Typography>
                  <Box sx={{ mt: 0.5 }}>{riskChip(d.platformRiskRating)}</Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Regulator</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.regulatorAbbreviation || d.regulatorName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Document Type</Typography>
                  <Typography variant="body2">{d.documentType || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Obligations</Typography>
                  <Typography variant="body2">{d.obligationCount || 0}</Typography>
                </Box>
                {d.effectiveDate && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Effective Date</Typography>
                    <Typography variant="body2">{formatDate(d.effectiveDate)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Published</Typography>
                  <Typography variant="body2">{formatDate(d.publishedAt)}</Typography>
                </Box>
              </Box>
            </Paper>

            {/* AI Summary */}
            {d.aiSummary && (
              <Paper sx={{ p: 3, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>AI Summary</Typography>
                <Typography variant="body2" fontStyle="italic" color="text.secondary">{d.aiSummary}</Typography>
              </Paper>
            )}

            {/* Raw OCR Text */}
            {d.pdfOcrText && (
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
                    {d.pdfOcrText}
                  </Box>
                </Collapse>
              </Paper>
            )}

            {/* Penalties */}
            {d.penaltySummary && (
              <Paper sx={{ p: 3, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Penalties</Typography>
                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>{d.penaltySummary}</Typography>
              </Paper>
            )}

            {/* Obligations */}
            <Paper>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Obligations ({detailData?.obligations?.length || 0})
                </Typography>
                {checkedObligations.size > 0 && (
                  <Button size="small" variant="contained" color="success"
                    onClick={() => {
                      setSnack({ severity: 'success', message: `${checkedObligations.size} obligation(s) marked as applicable` });
                      setCheckedObligations(new Set());
                    }}>
                    Mark {checkedObligations.size} Selected as Applicable
                  </Button>
                )}
              </Box>
              {detailData?.obligations?.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Section</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Effective</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailData.obligations.map(obl => (
                        <TableRow key={obl.obligationId} hover
                          onClick={() => toggleObligation(obl.obligationId)}
                          sx={{ cursor: 'pointer', bgcolor: checkedObligations.has(obl.obligationId) ? '#F0FFF4' : 'inherit' }}>
                          <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={checkedObligations.has(obl.obligationId)}
                              onChange={() => toggleObligation(obl.obligationId)} size="small" />
                          </TableCell>
                          <TableCell>{obl.obligationNumber}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 400 }}>{obl.description}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={obl.sectionReference || '-'} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{obl.obligationType || '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatDate(obl.effectiveDate)}</Typography>
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

  // ───────────────────────── List View ─────────────────────────
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Instruments</Typography>
          <Typography variant="body2" color="text.secondary">
            Review and classify newly published regulatory instruments
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
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 220 }} />
        <TextField select size="small" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
          label="Risk" sx={{ minWidth: 110 }}>
          {['All', 'High', 'Medium', 'Low'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorFilter} onChange={e => setRegulatorFilter(e.target.value)}
          label="Regulator" sx={{ minWidth: 130 }}>
          {regulators.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          label="Type" sx={{ minWidth: 120 }}>
          {types.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        {(search || riskFilter !== 'All' || regulatorFilter !== 'All' || typeFilter !== 'All') && (
          <Button size="small" startIcon={<Close />} onClick={() => {
            setSearch(''); setRiskFilter('All'); setRegulatorFilter('All'); setTypeFilter('All');
          }}>Clear</Button>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">All caught up — no obligations waiting for review.</Typography>
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
                {filtered.map(item => {
                  const rc = RISK_CONFIG[item.platformRiskRating] || {};
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
                        <Typography variant="body2">{item.regulatorAbbreviation || item.regulatorName || '-'}</Typography>
                      </TableCell>
                      <TableCell>{riskChip(item.platformRiskRating)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={item.documentType || '-'} variant="outlined" sx={{ height: 22 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday sx={{ fontSize: 13, color: 'text.secondary' }} />
                          <Typography variant="body2">{formatDate(item.publishedAt)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button size="small" variant="text" startIcon={<Visibility />}
                            onClick={e => { e.stopPropagation(); openDetail(item); }} sx={{ minWidth: 0, px: 1 }}>
                            View
                          </Button>
                          <IconButton size="small" color="success" title="Mark applicable"
                            onClick={e => { e.stopPropagation(); handleClassify(item.instrumentId, 'applicable'); }}>
                            <CheckCircle fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" title="Not applicable"
                            onClick={e => { e.stopPropagation(); handleClassify(item.instrumentId, 'not_applicable'); }}>
                            <Cancel fontSize="small" />
                          </IconButton>
                        </Box>
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

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}