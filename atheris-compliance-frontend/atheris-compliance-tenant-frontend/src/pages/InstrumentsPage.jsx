import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem,
  Collapse, TableContainer, Paper, TablePagination, Tooltip,
} from '@mui/material';
import {
  Visibility, Search, Close, ExpandMore, ExpandLess,
  Article, CloudUpload as CloudUploadIcon, ArrowBack, Download,
  InfoOutlined, Gavel, KeyboardArrowDown, KeyboardArrowUp,
} from '@mui/icons-material';
import { api, getToken, API_BASE } from '../services/api';

const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 280 },
  { id: 'reference', label: 'Reference No', minWidth: 140 },
  { id: 'regulator', label: 'Regulator', minWidth: 100 },
  { id: 'obligations', label: 'Obligations', minWidth: 100 },
  { id: 'actions', label: 'Actions', minWidth: 100 },
];

// harmonized with ReviewEditPage
const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

const MONO_CHIP_SX = {
  height: 22, borderRadius: '4px',
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNaira(amount) {
  if (amount == null) return '-';
  try {
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount);
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch { return String(amount); }
}

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

function ObligationSummary({ obligations }) {
  if (obligations.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No obligations saved for this instrument.</Typography>
      </Box>
    );
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 36 }}>#</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', minWidth: 300 }}>Obligation (Title + Interpreted)</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 110 }}>Section</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 140 }}>Area</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 120 }}>Risk</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 120 }}>Act</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {obligations.map((o, i) => (
            <TableRow key={o.obligationId ?? o.obligationNumber ?? i} hover sx={{ '& > td': { py: 1 } }}>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {o.obligationNumber ?? i + 1}
              </TableCell>
              <TableCell sx={{ minWidth: 300, maxWidth: 420 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                    {o.title || <span style={{ color: '#A0AEC0', fontWeight: 400 }}>Untitled obligation</span>}
                  </Typography>
                  {o.description && (
                    <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{o.description}</Box>}>
                      <InfoOutlined sx={{ fontSize: 14, color: '#A0AEC0', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                </Box>
                {o.plainEnglishStatement ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                    {o.plainEnglishStatement}
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {o.obligationType && (
                    <Chip size="small" variant="outlined" label={o.obligationType}
                      sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem', textTransform: 'capitalize' }} />
                  )}
                  {o.recurringDeadlineType && (
                    <Chip size="small" variant="outlined" label={o.recurringDeadlineType}
                      sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem', textTransform: 'capitalize' }} />
                  )}
                  {o.effectiveDate && (
                    <Chip size="small" variant="outlined" label={`Eff. ${formatDate(o.effectiveDate)}`}
                      sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem' }} />
                  )}
                  <Chip size="small" variant="outlined" label={o.status || 'active'}
                    sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
                      color: 'success.main', borderColor: 'success.main' }} />
                </Box>
              </TableCell>
              <TableCell>
                {o.sectionReference ? (
                  <Chip size="small" label={o.sectionReference.slice(0, 24)} variant="outlined" sx={MONO_CHIP_SX} />
                ) : (
                  <Typography variant="caption" color="text.secondary">-</Typography>
                )}
              </TableCell>
              <TableCell>
                {o.areaOfFocus ? (
                  <Chip size="small" variant="outlined" label={o.areaOfFocus}
                    sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 130 }} />
                ) : (
                  <Typography variant="caption" color="text.secondary">-</Typography>
                )}
              </TableCell>
              <TableCell>
                {inherentRiskChip(o.inherentRiskRating, o.inherentLikelihood, o.inherentImpact)}
              </TableCell>
              <TableCell>
                {o.actName ? (
                  <Chip size="small" variant="outlined" label={o.actName.slice(0, 22)}
                    sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 110 }} />
                ) : o.regulationId ? (
                  <Chip size="small" variant="outlined" label={`Reg #${o.regulationId}`} sx={{ height: 22, borderRadius: '4px' }} />
                ) : (
                  <Typography variant="caption" color="text.secondary">-</Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SanctionCard({ sanction: s }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(s.description || s.riskExplanation || s.penaltyDetails);
  const roles = Array.isArray(s.liableRoles) ? s.liableRoles : [];

  return (
    <Paper variant="outlined" sx={{ mb: 1.5, borderColor: '#FED7D7' }}>
      <Box onClick={() => hasDetail && setOpen(!open)}
        sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          cursor: hasDetail ? 'pointer' : 'default', userSelect: 'none',
          '&:hover': { bgcolor: hasDetail ? '#FFF5F5' : 'inherit' } }}>
        <Chip size="small" label={s.sanctionType || 'sanction'} color="error" variant="outlined"
          sx={{ height: 22, borderRadius: '4px', fontWeight: 600, textTransform: 'capitalize' }} />
        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          {formatNaira(s.amountNaira)}{s.sanctionAmountPerDay ? ' /day' : ''}
        </Typography>
        {s.sourceSectionReference && (
          <Chip size="small" variant="outlined" label={s.sourceSectionReference.slice(0, 24)} sx={MONO_CHIP_SX} />
        )}
        {s.severityScore != null && (
          <Chip size="small" label={`Sev ${s.severityScore}`}
            color={s.severityScore > 7 ? 'error' : s.severityScore > 4 ? 'warning' : 'default'}
            sx={{ height: 22, borderRadius: '4px' }} />
        )}
        <Chip size="small" variant="outlined" label={s.hasBeenEnforced ? 'Enforced' : 'Not enforced'}
          sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem',
            color: s.hasBeenEnforced ? 'error.main' : 'text.secondary',
            borderColor: s.hasBeenEnforced ? 'error.main' : 'divider' }} />
        {(s.actName || s.regulationId != null) && (
          <Chip size="small" variant="outlined" label={s.actName ? s.actName.slice(0, 22) : `Reg #${s.regulationId}`}
            sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
        )}
        <Box sx={{ flex: 1 }} />
        {hasDetail && (open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />)}
      </Box>

      {roles.length > 0 && (
        <Box sx={{ px: 1.5, pb: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">Liable:</Typography>
          {roles.map(r => (
            <Chip key={r} size="small" label={r} sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem' }} />
          ))}
        </Box>
      )}

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, py: 1.5, bgcolor: '#FFFAFA', borderTop: '1px solid', borderColor: 'divider' }}>
          {s.description && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Violation</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{s.description}</Typography>
            </Box>
          )}
          {s.penaltyDetails && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Penalty</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{s.penaltyDetails}</Typography>
            </Box>
          )}
          {s.riskExplanation && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Impact</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{s.riskExplanation}</Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function InstrumentsPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [showOcr, setShowOcr] = useState(false);
  const [sanctionsOpen, setSanctionsOpen] = useState(true);

  const listQuery = useQuery({
    queryKey: ['instruments', 'list', { page, size: rowsPerPage, q: search }],
    queryFn: ({ signal }) => api.instruments.list(page, rowsPerPage, search, { signal }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ['instruments', String(detailItem?.id ?? '')],
    queryFn: ({ signal }) => api.instruments.get(detailItem.id, { signal }),
    enabled: !!detailItem,
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => listQuery.data?.content || [], [listQuery.data]);
  const total = listQuery.data?.totalElements ?? items.length;
  const loading = listQuery.isPending;
  const detailData = detailItem ? detailQuery.data : null;
  const detailLoading = !!detailItem && detailQuery.isPending;

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

  function openDetail(item) {
    setDetailItem(item);
    setShowOcr(false);
    setSanctionsOpen(true);
  }

  function closeDetail() {
    setDetailItem(null);
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
    const obligations = Array.isArray(detailData?.obligations) ? detailData.obligations : [];
    const sanctions = Array.isArray(detailData?.sanctions) ? detailData.sanctions : [];
    const riskRating = detailData?.riskRating || d.riskRating;
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

        {detailQuery.isError && (
          <Alert severity="error" sx={{ mb: 2 }}
            action={<Button size="small" onClick={() => detailQuery.refetch()}>Retry</Button>}>
            {detailQuery.error?.message || 'Failed to load detail.'}
          </Alert>
        )}

        {detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            <Paper sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {regulator}
                </Typography>
                <Chip size="small" label={detailData?.documentType || d.documentType || 'Document'} variant="outlined" />
                {riskRating && (
                  <Chip size="small" label={riskRating} color={INHERENT_RISK_CONFIG[riskRating]?.color || 'default'}
                    sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
                )}
                {(detailData?.status || d.status) && (
                  <Chip size="small" variant="outlined" label={detailData?.status || d.status}
                    sx={{ height: 22, borderRadius: '4px', textTransform: 'capitalize' }} />
                )}
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
                  <Typography variant="body2">{obligations.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Sanctions</Typography>
                  <Typography variant="body2">{sanctions.length}</Typography>
                </Box>
                {obligations.some(o => o.effectiveDate) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Effective Date</Typography>
                    <Typography variant="body2">{formatDate(obligations.find(o => o.effectiveDate).effectiveDate)}</Typography>
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

            <Paper sx={{ mb: 2 }}>
              <Box onClick={() => setSanctionsOpen(!sanctionsOpen)}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  px: 2, py: 1.25, bgcolor: sanctions.length > 0 ? '#FFF5F5' : '#F7FAFC', cursor: 'pointer', userSelect: 'none',
                  borderBottom: sanctionsOpen ? '1px solid' : 'none', borderColor: 'divider',
                  '&:hover': { bgcolor: sanctions.length > 0 ? '#FFF0F0' : '#EDF2F7' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Gavel sx={{ fontSize: 18, color: sanctions.length > 0 ? '#E53E3E' : '#A0AEC0' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Sanctions {sanctions.length > 0 ? `(${sanctions.length})` : ''}
                  </Typography>
                </Box>
                {sanctionsOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </Box>
              <Collapse in={sanctionsOpen}>
                {sanctions.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#A0AEC0' }}>No sanctions extracted</Typography>
                    <Typography variant="caption" color="text.secondary">
                      If the instrument contained penalties, they will appear here after harmonization.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 2 }}>
                    {sanctions.map((s, i) => (
                      <SanctionCard key={s.sanctionId ?? i} sanction={s} />
                    ))}
                  </Box>
                )}
              </Collapse>
            </Paper>

            <Paper>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Obligations ({obligations.length})
                </Typography>
              </Box>
              <ObligationSummary obligations={obligations} />
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

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {listQuery.error?.message || 'Failed to load instruments.'}
        </Alert>
      )}

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
                {filtered.map(item => {
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
                        <Tooltip title={item.sourceReferenceNumber || '-'}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sourceReferenceNumber || '-'}
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
                        <Chip size="small" label={item.obligationCount ?? 0} sx={{ height: 22, fontWeight: 600 }} />
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
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        </Paper>
      )}
    </Box>
  );
}
