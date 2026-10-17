import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Snackbar, Tooltip, TablePagination, TableSortLabel,
  Collapse, Skeleton,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, DataCard, RiskBadge, StatusBadge, TL,
  ArrowPathIcon, EyeIcon, ChevronRightIcon, ChevronDownIcon, DocumentTextIcon,
  InformationCircleIcon, InboxIcon, GlobeAltIcon, ArrowUpTrayIcon,
} from 'shared';
import { api, API_BASE, getToken, pdfErrorMessage } from '../services/api';

const RISK_CONFIG = {
  Critical: { tone: 'red' },
  Extreme: { tone: 'red' },
  High: { tone: 'orange' },
  Moderate: { tone: 'yellow' },
  Medium: { tone: 'yellow' },
  Low: { tone: 'green' },
};

// harmonized with ReviewEditPage
const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

const SOURCE_CONFIG = {
  intel: { label: 'Intel', tone: 'gray' },
  upload: { label: 'Upload', tone: 'blue' },
};

const COLUMNS = [
  { id: 'document', label: 'Document', minWidth: 320, sortField: 'sourceTitle' },
  { id: 'regulator', label: 'Regulator', minWidth: 120, sortField: 'regulatorAbbreviation' },
  { id: 'risk', label: 'Risk', minWidth: 90, sortField: 'riskRating' },
  { id: 'obligations', label: 'Obligations', minWidth: 110 },
  { id: 'received', label: 'Received', minWidth: 110, sortField: 'createdAt' },
];

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <StatusBadge label={rating || 'Unrated'} tone="gray" />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <span><RiskBadge value={rating} /></span>
    </Tooltip>
  );
}

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <RiskBadge value={null} />;
  return <StatusBadge label={rating} tone={cfg.tone} dot />;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ObligationSummary({ obligations }) {
  if (obligations.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: TL.gray400, py: 3, textAlign: 'center' }}>
        No obligations extracted for this document.
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 36 }}>#</TableCell>
            <TableCell sx={{ minWidth: 260 }}>Obligation (Title + Interpreted)</TableCell>
            <TableCell sx={{ width: 110 }}>Section</TableCell>
            <TableCell sx={{ width: 140 }}>Area</TableCell>
            <TableCell sx={{ width: 120 }}>Risk</TableCell>
            <TableCell sx={{ width: 120 }}>Act</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {obligations.map((o, i) => {
            const excluded = o.applicable === false;
            return (
              <TableRow key={o.obligationNumber ?? i} hover
                sx={{ '& > td': { py: 1 }, opacity: excluded ? 0.45 : 1 }}>
                <TableCell sx={{ color: TL.gray500, fontFamily: TL.mono, fontSize: '0.75rem' }}>
                  {o.obligationNumber ?? i + 1}
                </TableCell>
                <TableCell sx={{ minWidth: 260, maxWidth: 380 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, color: 'primary.main',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 330 }}>
                      {o.title || <span style={{ color: TL.gray400, fontWeight: 400 }}>Untitled obligation</span>}
                    </Typography>
                    {o.description && (
                      <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{o.description}</Box>}>
                        <Box component="span" sx={{ display: 'flex', flexShrink: 0 }}>
                          <InformationCircleIcon size={14} sx={{ color: TL.gray400 }} />
                        </Box>
                      </Tooltip>
                    )}
                    {excluded && (
                      <StatusBadge label="Not applicable" tone="gray" />
                    )}
                  </Box>
                  {o.plainEnglishStatement ? (
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, display: 'block',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                      {o.plainEnglishStatement}
                    </Typography>
                  ) : (
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray300 }}>No interpreted text</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.sectionReference ? (
                    <Chip size="small" label={o.sectionReference.slice(0, 24)} variant="outlined"
                      sx={{ fontFamily: TL.mono, fontSize: '0.7rem' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.areaOfFocus ? (
                    <Chip size="small" variant="outlined" label={o.areaOfFocus} sx={{ maxWidth: 130 }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {inherentRiskChip(o.inherentRiskRating, o.inherentLikelihood, o.inherentImpact)}
                </TableCell>
                <TableCell>
                  {o.actName ? (
                    <Chip size="small" variant="outlined" label={o.actName.slice(0, 22)} sx={{ maxWidth: 110 }} />
                  ) : o.regulationId ? (
                    <Chip size="small" variant="outlined" label={`Reg #${o.regulationId}`} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function ReviewRow({ item, onOpen, onSkip, onViewPdf }) {
  const [open, setOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['review', String(item.reviewId)],
    queryFn: ({ signal }) => api.review.get(item.reviewId, { signal }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const obligations = Array.isArray(detail.data?.obligations) ? detail.data.obligations : [];

  return (
    <>
      <TableRow hover onClick={() => onOpen(item)} sx={{ cursor: 'pointer' }}>
        <TableCell sx={{ width: 36, p: 0.5 }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            title={open ? 'Hide obligations' : 'Show obligations'}>
            <ChevronDownIcon size={18} sx={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StatusBadge label={SOURCE_CONFIG[item.source]?.label || item.source}
              tone={SOURCE_CONFIG[item.source]?.tone || 'gray'} />
            <Tooltip title={item.sourceTitle || 'Untitled document'}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main', maxWidth: 300,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.sourceTitle || 'Untitled document'}
              </Typography>
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell>
          {item.regulatorAbbreviation || item.regulatorName || '-'}
        </TableCell>
        <TableCell>{riskChip(item.riskRating)}</TableCell>
        <TableCell>
          <Chip size="small" variant="outlined"
            label={`${item.obligationCount} obligation${item.obligationCount !== 1 ? 's' : ''}`} />
        </TableCell>
        <TableCell sx={{ color: TL.gray500, whiteSpace: 'nowrap' }}>{formatDate(item.createdAt)}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <Button size="small" variant="contained" endIcon={<ChevronRightIcon size={14} />}
              onClick={(e) => { e.stopPropagation(); onOpen(item); }}>
              Review
            </Button>
            {item.instrumentId && (
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onViewPdf(item); }}
                title="View PDF"><EyeIcon size={16} /></IconButton>
            )}
            <Button size="small" variant="contained" color="error" sx={{ whiteSpace: 'nowrap' }}
              onClick={(e) => { e.stopPropagation(); onSkip(item); }}>
              Not Applicable
            </Button>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box onClick={(e) => e.stopPropagation()} sx={{ p: 2, bgcolor: TL.gray50, borderBottom: `1px solid ${TL.gray100}` }}>
              <Paper sx={{ overflow: 'hidden' }}>
                <Typography sx={{ px: 2, py: 1.5, fontSize: '0.875rem', fontWeight: 600, color: TL.gray800,
                  borderBottom: `1px solid ${TL.gray100}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InformationCircleIcon size={16} sx={{ color: TL.gray400 }} /> Obligation Summary
                </Typography>
                {detail.isPending ? (
                  <Box sx={{ p: 2 }}>
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 1, borderRadius: 1 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 1 }} />
                  </Box>
                ) : detail.isError ? (
                  <Alert severity="error" sx={{ m: 2 }} action={
                    <Button size="small" onClick={() => detail.refetch()}>Retry</Button>
                  }>
                    {detail.error?.message || 'Failed to load obligations.'}
                  </Alert>
                ) : (
                  <ObligationSummary obligations={obligations} />
                )}
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ReviewInboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [snack, setSnack] = useState(null);
  const notify = (severity, message) => setSnack({ severity, message });

  const hasFilters = search || sourceFilter !== 'All' || regulatorFilter !== 'All';

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (sourceFilter !== 'All') params.source = sourceFilter;
  if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['review', 'list', params],
    queryFn: ({ signal }) => api.review.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['review', 'stats'],
    queryFn: ({ signal }) => api.review.stats({ signal }),
  });

  const skipMutation = useMutation({
    mutationFn: (reviewId) => api.review.skip(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] });
      notify('success', 'Review skipped.');
    },
    onError: (e) => notify('error', e.message || 'Failed to skip.'),
  });

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const loading = listQuery.isPending;

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'intel') setSourceFilter('intel');
    else if (type === 'upload') setSourceFilter('upload');
    else setSourceFilter('All');
  }

  const activeKpi = sourceFilter === 'intel' ? 'intel' : sourceFilter === 'upload' ? 'upload' : null;
  const kpis = [
    { key: 'total', label: 'Total Pending', value: stats?.total ?? 0, tone: 'blue', icon: <InboxIcon /> },
    { key: 'intel', label: 'From Intel', value: stats?.intel ?? 0, tone: 'purple', icon: <GlobeAltIcon /> },
    { key: 'upload', label: 'From Upload', value: stats?.upload ?? 0, tone: 'orange', icon: <ArrowUpTrayIcon /> },
  ].map((k) => ({ ...k, active: k.key === activeKpi }));

  function clearFilters() {
    setSearch(''); setSourceFilter('All'); setRegulatorFilter('All'); setPage(0);
  }

  function openReview(item) {
    navigate(`/review/${item.reviewId}`);
  }

  function handleSkip(item) {
    skipMutation.mutate(item.reviewId);
  }

  async function handleViewPdf(item) {
    const id = item?.instrumentId;
    if (!id) { notify('warning', 'No PDF available yet.'); return; }
    try {
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${id}/pdf`, {
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      });
      if (!res.ok) throw new Error(await pdfErrorMessage(res));
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { notify('error', e.message || 'Failed to load PDF.'); }
  }

  const regulators = Array.isArray(stats?.regulators) ? stats.regulators : [];

  return (
    <Box>
      <PageHeader
        title="Review Inbox"
        subtitle={`${total} document${total !== 1 ? 's' : ''} awaiting review — vet obligations before they enter the register`}
        actions={(
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />}
            onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}>
            Refresh
          </Button>
        )}
      />

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {listQuery.error?.message || 'Failed to load review queue.'}
        </Alert>
      )}

      {/* KPI cards */}
      <KpiCards items={kpis} onSelect={applyKpiFilter} columns={3} />

      {/* Filters */}
      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search title or regulator...' }}
        filters={[
          { key: 'source', label: 'Source', value: sourceFilter, onChange: (v) => { setSourceFilter(v); setPage(0); },
            options: [{ value: 'intel', label: 'Intel' }, { value: 'upload', label: 'Upload' }], allLabel: 'All Sources', minWidth: 150 },
          { key: 'regulator', label: 'Regulator', value: regulatorFilter, onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: regulators.map((r) => ({ value: r, label: r })), allLabel: 'All Regulators', minWidth: 160 },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <DocumentTextIcon size={40} sx={{ mb: 1, color: TL.gray300 }} />
          <Typography variant="body1">No documents awaiting review.</Typography>
          <Typography variant="body2" color="text.secondary">New instruments from Intel and uploaded documents will appear here.</Typography>
        </Paper>
      ) : (
        <DataCard title="Pending Documents" noPadding>
          <Box sx={{ overflowX: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 36 }} />
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth,
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(c.sortField);
                            setSortDir('asc');
                          }
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
                  <TableCell sx={{ minWidth: 140 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <ReviewRow key={item.reviewId} item={item} onOpen={openReview}
                    onSkip={handleSkip} onViewPdf={handleViewPdf} />
                ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </DataCard>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
