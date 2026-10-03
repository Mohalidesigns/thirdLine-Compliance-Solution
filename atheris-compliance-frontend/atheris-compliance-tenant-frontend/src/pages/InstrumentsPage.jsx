import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Button, CircularProgress, Alert, IconButton, TextField, MenuItem, Menu,
  Collapse, TableContainer, Paper, TablePagination, TableSortLabel, Tooltip,
} from '@mui/material';
import {
  Visibility, Search, Close, ExpandMore, ExpandLess,
  Article, CloudUpload as CloudUploadIcon, ArrowBack, Download,
  InfoOutlined, Gavel, KeyboardArrowDown, KeyboardArrowUp, ArrowDropDown,
} from '@mui/icons-material';
import { api, getToken, API_BASE, pdfErrorMessage } from '../services/api';

// Max 5 columns (UI rule). The reference number is shown under the title.
const COLUMNS = [
  { id: 'title', label: 'Title', minWidth: 300, sortField: 'sourceTitle' },
  { id: 'regulator', label: 'Regulator', minWidth: 100, sortField: 'regulatorAbbreviation' },
  { id: 'risk', label: 'Risk', minWidth: 100, sortField: 'riskRating' },
  { id: 'obligations', label: 'Obligations', minWidth: 100, sortField: 'obligationCount' },
  { id: 'actions', label: 'Actions', minWidth: 80 },
];

const RISK_LEVELS = ['Critical', 'High', 'Moderate', 'Low'];

// harmonized with ReviewEditPage
const RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
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

function regulatorOf(i) {
  return i.regulatorAbbreviation || i.regulatorName;
}

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />;
}

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

// KPI card with a dropdown that breaks the card's subset down by regulator.
function KpiCard({ kpi, onSelect }) {
  const [anchor, setAnchor] = useState(null);
  const breakdown = Object.entries(kpi.byRegulator || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Paper elevation={0} variant="outlined"
      onClick={() => onSelect(kpi.key)}
      sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${kpi.color}`,
        transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{kpi.label}</Typography>
        <IconButton size="small" aria-label={`${kpi.label} breakdown`}
          onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }} sx={{ p: 0.25 }}>
          <ArrowDropDown fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>{kpi.value}</Typography>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}>
        <MenuItem disabled dense>
          <Typography variant="caption">By regulator (this page)</Typography>
        </MenuItem>
        {breakdown.length === 0 ? (
          <MenuItem disabled dense>No instruments</MenuItem>
        ) : breakdown.map(([reg, count]) => (
          <MenuItem key={reg} dense onClick={() => { setAnchor(null); onSelect(kpi.key, reg); }}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
            <span>{reg}</span><strong>{count}</strong>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}

// Max 5 columns: area, type, deadline, owner and status ride as chips under the obligation.
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
              <TableCell sx={{ minWidth: 300, maxWidth: 460 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
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
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 440 }}>
                    {o.plainEnglishStatement}
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {o.areaOfFocus && (
                    <Chip size="small" variant="outlined" label={o.areaOfFocus}
                      sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem', maxWidth: 180 }} />
                  )}
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
                  {o.controlOwner && (
                    <Chip size="small" variant="outlined" label={`Owner: ${o.controlOwner}`}
                      sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem', maxWidth: 200 }} />
                  )}
                  <Chip size="small" variant="outlined" label={o.status || 'active'}
                    sx={{ height: 18, borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
                      color: 'success.main', borderColor: 'success.main' }} />
                </Box>
              </TableCell>
              <TableCell>
                {o.sectionReference ? (
                  <Tooltip title={o.sectionReference}>
                    <Chip size="small" label={o.sectionReference.slice(0, 24)} variant="outlined" sx={MONO_CHIP_SX} />
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.secondary">-</Typography>
                )}
              </TableCell>
              <TableCell>
                {inherentRiskChip(o.inherentRiskRating, o.inherentLikelihood, o.inherentImpact)}
              </TableCell>
              <TableCell>
                {o.actName ? (
                  <Tooltip title={o.actName}>
                    <Chip size="small" variant="outlined" label={o.actName.slice(0, 22)}
                      sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 110 }} />
                  </Tooltip>
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

// InstrumentDetailResponse.SanctionItem uses `amountNaira` (not `sanctionAmountNaira`).
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
        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', color: 'error.main' }}>
          {s.amountNaira != null
            ? `${formatNaira(s.amountNaira)}${s.sanctionAmountPerDay ? ' /day' : ''}`
            : 'Amount not stated'}
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [detailItem, setDetailItem] = useState(null);
  const [showOcr, setShowOcr] = useState(false);
  const [sanctionsOpen, setSanctionsOpen] = useState(true);

  // Debounce the server-side search so each keystroke doesn't fire (and cancel) a request.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const listQuery = useQuery({
    queryKey: ['instruments', 'list', { page, size: rowsPerPage, q: debouncedSearch }],
    queryFn: ({ signal }) => api.instruments.list(page, rowsPerPage, debouncedSearch, { signal }),
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

  const hasFilters = search || riskFilter !== 'All' || regulatorFilter !== 'All';

  const regulatorsList = useMemo(() => {
    const s = new Set(items.map(regulatorOf).filter(Boolean));
    return ['All', ...Array.from(s).sort()];
  }, [items]);

  // Risk / regulator filters and sorting apply to the current server page.
  const filtered = useMemo(() => {
    let result = items;
    if (regulatorFilter !== 'All') result = result.filter(i => regulatorOf(i) === regulatorFilter);
    if (riskFilter !== 'All') {
      result = result.filter(i => riskFilter === 'Critical'
        ? (i.riskRating === 'Critical' || i.riskRating === 'Extreme')
        : riskFilter === 'Moderate'
          ? (i.riskRating === 'Moderate' || i.riskRating === 'Medium')
          : i.riskRating === riskFilter);
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        if (sortField === 'obligationCount') {
          const an = Number(a.obligationCount) || 0;
          const bn = Number(b.obligationCount) || 0;
          return sortDir === 'asc' ? an - bn : bn - an;
        }
        const av = String(a[sortField] ?? '').toLowerCase();
        const bv = String(b[sortField] ?? '').toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return result;
  }, [items, regulatorFilter, riskFilter, sortField, sortDir]);

  const kpis = useMemo(() => {
    const countByRegulator = list => list.reduce((acc, i) => {
      const r = regulatorOf(i) || 'Unknown';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const critical = items.filter(i => i.riskRating === 'Critical' || i.riskRating === 'Extreme');
    const high = items.filter(i => i.riskRating === 'High');
    const withObligations = items.filter(i => (i.obligationCount ?? 0) > 0);
    return [
      { key: 'total', label: 'Total Instruments', value: total, color: '#2B6CB0', byRegulator: countByRegulator(items) },
      { key: 'critical', label: 'Critical Risk', value: critical.length, color: '#E53E3E', byRegulator: countByRegulator(critical) },
      { key: 'high', label: 'High Risk', value: high.length, color: '#DD6B20', byRegulator: countByRegulator(high) },
      { key: 'withObligations', label: 'With Obligations', value: withObligations.length, color: '#38A169', byRegulator: countByRegulator(withObligations) },
    ];
  }, [items, total]);

  function applyKpiFilter(key, regulator) {
    setPage(0);
    if (key === 'critical') setRiskFilter('Critical');
    else if (key === 'high') setRiskFilter('High');
    else setRiskFilter('All');
    setRegulatorFilter(regulator || 'All');
  }

  function clearFilters() {
    setSearch('');
    setRiskFilter('All');
    setRegulatorFilter('All');
    setPage(0);
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

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
    if (!res.ok) throw new Error(await pdfErrorMessage(res));
    return await res.blob();
  }

  async function handleViewInstrument(item) {
    try {
      const blob = await fetchPdfBlob(item.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message || 'Failed to load PDF.');
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
    } catch (e) {
      setError(e.message || 'Failed to download PDF.');
    }
  }

  // ── Detail View ──
  if (detailItem) {
    const d = detailItem;
    const regulator = detailData?.regulatorAbbreviation || detailData?.regulatorName || regulatorOf(d) || '-';
    const obligations = Array.isArray(detailData?.obligations) ? detailData.obligations : [];
    const sanctions = Array.isArray(detailData?.sanctions) ? detailData.sanctions : [];
    const riskRating = detailData?.riskRating || d.riskRating;
    const status = detailData?.status || d.status;
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
                {riskChip(riskRating)}
                {status && (
                  <Chip size="small" variant="outlined" label={status}
                    sx={{ height: 22, borderRadius: '4px', textTransform: 'capitalize' }} />
                )}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{detailData?.sourceTitle || d.sourceTitle}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Regulator</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{regulator}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Reference No</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {d.sourceReferenceNumber || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Document Type</Typography>
                  <Typography variant="body2">{detailData?.documentType || d.documentType || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Risk</Typography>
                  <Typography variant="body2">{riskRating || 'Unrated'}</Typography>
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
                  <Typography variant="body2">{formatDate(detailData?.publishedAt || d.publishedAt || d.createdAt)}</Typography>
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

      {/* KPI cards — each has a regulator breakdown dropdown */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2, mt: 1.5 }}>
        {kpis.map(k => <KpiCard key={k.key} kpi={k} onSelect={applyKpiFilter} />)}
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk" sx={{ minWidth: 110 }}>
          {['All', ...RISK_LEVELS].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">
            {hasFilters
              ? 'No instruments match the current filters.'
              : 'No confirmed instruments yet. Review and save items from the Review Inbox.'}
          </Typography>
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
                        onClick={c.sortField ? () => toggleSort(c.sortField) : undefined}>
                        {c.sortField ? (
                          <TableSortLabel active={active} direction={active ? sortDir : 'asc'}
                            sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                            {c.label}
                          </TableSortLabel>
                        ) : c.label}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} hover
                    onClick={() => openDetail(item)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                    <TableCell>
                      <Tooltip title={item.sourceTitle || ''}>
                        <Typography variant="body2" sx={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sourceTitle || '-'}
                        </Typography>
                      </Tooltip>
                      {item.sourceReferenceNumber && (
                        <Typography variant="caption" color="text.secondary"
                          sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: 340,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sourceReferenceNumber}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.regulatorAbbreviation ? (
                        <Tooltip title={item.regulatorName || item.regulatorAbbreviation}>
                          <Chip size="small" label={item.regulatorAbbreviation}
                            sx={{ height: 22, fontWeight: 600, borderRadius: '4px', bgcolor: '#1A365D', color: '#fff' }} />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.regulatorName || '-'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{riskChip(item.riskRating)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={item.obligationCount ?? 0} sx={{ height: 22, fontWeight: 600, borderRadius: '4px' }} />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="text" startIcon={<Visibility />}
                        onClick={e => { e.stopPropagation(); openDetail(item); }} sx={{ minWidth: 0, px: 1 }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
