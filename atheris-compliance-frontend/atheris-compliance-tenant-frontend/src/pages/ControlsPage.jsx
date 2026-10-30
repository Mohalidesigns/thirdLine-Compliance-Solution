import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, Tooltip, Autocomplete,
  Snackbar, Alert as MuiAlert, Link, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { api } from '../services/api';
import {
  KpiCards, FilterBar, FilterField, SectionTable, PageHeader, StatusBadge, StateBadge, RiskBadge, RISK_COLOR, TL,
  ArrowPathIcon, PlusIcon, ArrowUpTrayIcon, EyeIcon, PencilSquareIcon, ClipboardDocumentCheckIcon,
  BuildingLibraryIcon, ScaleIcon, ShieldCheckIcon, ClockIcon, CalendarDaysIcon,
  ExclamationTriangleIcon, ExclamationCircleIcon, DocumentTextIcon, LinkIcon, QueueListIcon,
  ChartBarIcon, UserCircleIcon,
} from 'shared';
import { useAuth } from '../contexts/AuthContext';
import OwnerPicker from '../components/org/OwnerPicker';
import CreateControlDialog from '../components/modals/CreateControlDialog';
import ImportDialog from '../components/modals/ImportDialog';
import { Section, Field, FieldGrid, StatTile, RiskChip } from '../components/detailKit';
import { isReadOnly } from '../utils/roles';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function actLabel(row) {
  if (!row) return '-';
  return row.actName || '-';
}

const TEST_RESULT_TONE = { Passed: 'green', Failed: 'red', Partial: 'orange' };
const REVIEW_TONE = { Accepted: 'green', Rejected: 'red' };

function nextTestDueCell(value) {
  if (!value) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }
  const due = new Date(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) {
    return <StatusBadge label={`Overdue ${Math.abs(days)}d`} tone="red" />;
  }
  if (days <= 7) {
    return <StatusBadge label={`Due in ${days}d`} tone="orange" />;
  }
  return <Typography variant="body2">{formatDate(value)}</Typography>;
}

const COLUMNS = [
  { id: 'name', label: 'Control', minWidth: 340, sortable: true, sortField: 'name', render: (c) => (
    <Tooltip title={c.name || ''}>
      <Typography variant="body2" sx={{ maxWidth: 420, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'primary.main', fontWeight: 500 }}>
        {c.name || 'Untitled control'}
      </Typography>
    </Tooltip>
  ) },
  { id: 'dueDate', label: 'Due Date', minWidth: 140, render: (c) => nextTestDueCell(c.nextTestDueDate) },
  { id: 'openFindings', label: 'Has Finding', minWidth: 120, render: (c) => {
    const n = c.openFindings ?? 0;
    return n > 0
      ? <StatusBadge label={`${n} open`} tone="red" />
      : <Typography variant="body2" color="text.secondary">None</Typography>;
  } },
  { id: 'frequency', label: 'Test Frequency', minWidth: 140, sortable: true, sortField: 'testFrequency', render: (c) => (
    c.frequency
      ? <Typography variant="body2">{c.frequency}</Typography>
      : <Typography variant="body2" color="text.secondary">Not set</Typography>
  ) },
  { id: 'ownerName', label: 'Owner', minWidth: 140, sortable: true, sortField: 'ownerName', render: (c) => (
    (c.ownerName || c.controlOwnerName)
      ? <Tooltip title={c.ownerName || c.controlOwnerName}>
          <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ownerName || c.controlOwnerName}</Typography>
        </Tooltip>
      : <Typography variant="body2" color="text.secondary">Unassigned</Typography>
  ) },
];

export default function ControlsPage() {
  const { user: currentUser } = useAuth();
  const readOnly = isReadOnly(currentUser?.role);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // "Linked obligation" filter lives in the URL (?obligationId=) so it survives navigation
  // from the obligation detail page and can be cleared with a chip.
  const obligationIdParam = searchParams.get('obligationId');
  const obligationFilter = obligationIdParam && !Number.isNaN(Number(obligationIdParam))
    ? Number(obligationIdParam) : null;

  const [detailId, setDetailId] = useState(null);

  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [actFilter, setActFilter] = useState('All');
  const [obligationInput, setObligationInput] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [recordTestOpen, setRecordTestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  useEffect(() => {
    const cid = searchParams.get('controlId');
    if (cid && !Number.isNaN(Number(cid))) setDetailId(Number(cid));
  }, [searchParams]);

  const hasFilters = search || themeFilter !== 'All' || riskFilter !== 'All'
    || ownerFilter !== 'All' || statusFilter !== 'All' || actFilter !== 'All' || obligationFilter != null;

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (themeFilter !== 'All') params.theme = themeFilter;
  if (riskFilter !== 'All') params.residualRisk = riskFilter;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (actFilter !== 'All') params.actName = actFilter;
  if (obligationFilter != null) params.obligationId = obligationFilter;
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['controls', 'register', params],
    queryFn: () => api.controls.register(params),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['controls', 'stats'],
    queryFn: () => api.controls.stats(),
  });

  // Typeahead source for the "Linked obligation" filter.
  const obligationOptionsQuery = useQuery({
    queryKey: ['controls', 'obligation-options', obligationInput],
    queryFn: () => api.obligations.register({ q: obligationInput.trim(), size: 15 }),
    enabled: obligationInput.trim().length >= 2,
    staleTime: 60 * 1000,
  });

  // Resolve the currently-selected obligation (deep link or chip) to a readable label.
  const selectedObligationQuery = useQuery({
    queryKey: ['obligations', 'detail', String(obligationFilter)],
    queryFn: ({ signal }) => api.obligations.obligationDetail(obligationFilter, signal),
    enabled: obligationFilter != null,
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ['controls', 'detail', String(detailId)],
    queryFn: () => api.controls.detail(detailId),
    enabled: detailId != null,
    staleTime: 5 * 60 * 1000,
  });

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const loading = listQuery.isPending;
  const error = listQuery.error?.message || '';

  const obligationOptions = obligationOptionsQuery.data?.content || [];
  const selectedObligation = selectedObligationQuery.data;
  const obligationChipLabel = obligationFilter == null ? ''
    : (selectedObligation?.title || selectedObligation?.name || `Obligation #${obligationFilter}`);
  const obligationAutocompleteValue = obligationFilter == null ? null
    : (obligationOptions.find((o) => o.obligationId === obligationFilter)
        || { obligationId: obligationFilter, title: obligationChipLabel });

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['controls'] });

  function setObligationFilter(id) {
    const next = new URLSearchParams(searchParams);
    if (id == null) next.delete('obligationId'); else next.set('obligationId', String(id));
    setSearchParams(next, { replace: true });
    setObligationInput('');
    setPage(0);
  }

  function clearFilters() {
    setSearch(''); setThemeFilter('All'); setRiskFilter('All');
    setOwnerFilter('All'); setStatusFilter('All'); setActFilter('All');
    setObligationFilter(null);
    setPage(0);
  }

  const kpis = [
    { key: 'total', label: 'Total Controls', value: stats?.total ?? 0, tone: 'blue', icon: <ShieldCheckIcon />,
      breakdown: stats?.byStatus, drill: (label) => setStatusFilter(label) },
    { key: 'testsDue', label: 'Tests Due (30 days)', value: stats?.testsDue ?? 0, tone: 'orange', icon: <ClockIcon />,
      breakdown: stats?.byTheme, drill: (label) => setThemeFilter(label) },
    { key: 'failing', label: 'Failing Controls', value: stats?.failingControls ?? 0, tone: 'red', icon: <ExclamationTriangleIcon />,
      breakdown: stats?.byRiskLevel, drill: (label) => setRiskFilter(label) },
    { key: 'openFindings', label: 'Open Findings', value: stats?.openFindings ?? 0, tone: 'purple', icon: <ExclamationCircleIcon />,
      breakdown: stats?.findingsBySeverity, drill: (label) => navigate(`/findings?severity=${label}`) },
  ];

  const kpiItems = kpis.map((k) => ({
    key: k.key, label: k.label, tone: k.tone, icon: k.icon, value: k.value, breakdown: k.breakdown,
    active: k.key === 'failing' && riskFilter === 'High',
  }));

  const onKpiSelect = (key) => {
    setPage(0);
    if (key === 'testsDue') { setSortField(''); return; }
    if (key === 'openFindings') { navigate('/findings'); return; }
    if (key === 'failing') { setRiskFilter('High'); return; }
    clearFilters();
  };

  const onKpiDrill = (key, label) => {
    setPage(0);
    const hit = kpis.find((k) => k.key === key);
    if (hit?.drill) hit.drill(label);
  };

  const filters = [
    { key: 'theme', label: 'Theme', minWidth: 140, value: themeFilter,
      onChange: (v) => { setThemeFilter(v); setPage(0); }, allLabel: 'All themes',
      options: (stats?.themes || []).map((t) => ({ value: t, label: t })) },
    { key: 'risk', label: 'Residual Risk', minWidth: 150, value: riskFilter,
      onChange: (v) => { setRiskFilter(v); setPage(0); }, allLabel: 'All risks',
      options: ['Critical', 'High', 'Moderate', 'Low'].map((r) => ({ value: r, label: r })) },
    { key: 'status', label: 'Status', minWidth: 130, value: statusFilter,
      onChange: (v) => { setStatusFilter(v); setPage(0); }, allLabel: 'All statuses',
      options: ['Active', 'Inactive'].map((s) => ({ value: s, label: s })) },
    { key: 'act', label: 'Act', minWidth: 180, value: actFilter,
      onChange: (v) => { setActFilter(v); setPage(0); }, allLabel: 'All acts',
      options: (stats?.acts || []).map((a) => ({ value: a, label: a })) },
  ];

  if (detailId != null) {
    const goBack = () => { setDetailId(null); setEditOpen(false); setRecordTestOpen(false); };
    if (detailQuery.isPending) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
    }
    if (detailQuery.error || !detailQuery.data) {
      return (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>{detailQuery.error?.message || 'Failed to load control.'}</Alert>
          <Button onClick={goBack}>Back to Controls Register</Button>
        </Box>
      );
    }
    return (
      <DetailView
        detail={detailQuery.data}
        onBack={goBack}
        onRefresh={refreshAll}
        onEdit={() => setEditOpen(true)}
        onRecordTest={() => setRecordTestOpen(true)}
        editOpen={editOpen} setEditOpen={setEditOpen}
        recordTestOpen={recordTestOpen} setRecordTestOpen={setRecordTestOpen}
        onSnackbar={setSnackbar} saving={saving} setSaving={setSaving}
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title="Controls Register"
        subtitle={`${total} control${total !== 1 ? 's' : ''} — inventory, testing and risk assessment`}
        actions={(
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={refreshAll}><ArrowPathIcon size={18} /></IconButton>
            </Tooltip>
            {!readOnly && (
              <>
                <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setImportOpen(true)}>
                  Import
                </Button>
                <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
                  New Control
                </Button>
              </>
            )}
          </>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search control, number or owner...', minWidth: 260 }}
        filters={filters}
        showClear={hasFilters}
        onClear={clearFilters}
      >
        <FilterField label="Linked Obligation" minWidth={260}>
          <Autocomplete
            size="small"
            options={obligationOptions}
            value={obligationAutocompleteValue}
            onChange={(_, opt) => setObligationFilter(opt ? opt.obligationId : null)}
            onInputChange={(_, v) => setObligationInput(v)}
            getOptionLabel={(o) => o.title || o.name || `Obligation #${o.obligationId}`}
            isOptionEqualToValue={(o, v) => o.obligationId === v.obligationId}
            filterOptions={(x) => x}
            loading={obligationOptionsQuery.isFetching}
            noOptionsText={obligationInput.trim().length >= 2 ? 'No obligations found' : 'Type to search obligations'}
            renderInput={(params) => <TextField {...params} placeholder="Search obligation…" />}
            sx={{ minWidth: 260 }}
          />
        </FilterField>
      </FilterBar>

      {obligationFilter != null && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            color="primary"
            variant="outlined"
            label={`Linked obligation: ${obligationChipLabel}`}
            onDelete={() => setObligationFilter(null)}
          />
          <Typography variant="caption" color="text.secondary">
            Showing controls traced to this obligation
          </Typography>
        </Box>
      )}
      <SectionTable
        columns={COLUMNS}
        rows={items}
        total={total}
        page={page}
        size={rowsPerPage}
        loading={loading}
        error={null}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field) => {
          if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
          } else {
            setSortField(field);
            setSortDir('asc');
          }
          setPage(0);
        }}
        onPage={setPage}
        onSize={(s) => { setRowsPerPage(s); setPage(0); }}
        onRowClick={(c) => setDetailId(c.controlId)}
        rowKey={(c) => c.controlId}
        emptyMessage="No controls found."
      />

      <CreateControlDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); refreshAll(); }} onSnackbar={setSnackbar} />

      <ImportDialog entityType="controls" entityLabel="controls" open={importOpen}
        itemLabel="Control" contextLabel="Theme / Frequency / Links"
        invalidateKeys={[['controls'], ['obligations'], ['dashboard']]}
        onClose={() => setImportOpen(false)}
        onImported={(r) => setSnackbar(`Imported ${r?.importedRows ?? 0} controls.`)} />

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}

/* ───────── Detail View ───────── */
function DetailView({ detail, onBack, onRefresh, onEdit, onRecordTest, editOpen, setEditOpen, recordTestOpen, setRecordTestOpen, onSnackbar, saving, setSaving }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReview = ['ANALYST', 'CCO', 'TENANT_ADMIN'].includes(user?.role);
  const [reviewTarget, setReviewTarget] = useState(null);
  const obligations = detail.linkedObligations || [];
  const testHistory = detail.testHistory || [];
  const findings = detail.findings || [];
  return (
    <Box>
      <PageHeader
        title={detail.name || 'Control'}
        onBack={onBack}
        backLabel="Back to Controls Register"
        actions={(
          <>
            <Button variant="outlined" startIcon={<PencilSquareIcon size={16} />} onClick={onEdit}>Edit</Button>
            <Button variant="contained" startIcon={<ClipboardDocumentCheckIcon size={16} />} onClick={onRecordTest}>Record Test</Button>
          </>
        )}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" variant="outlined" icon={<BuildingLibraryIcon size={14} />}
            label={actLabel(detail)} />
          {detail.status && <StateBadge value={detail.status} />}
        </Box>
      </PageHeader>

      {/* Headline numbers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatTile icon={<ExclamationTriangleIcon />} label="Inherent Risk"
          accent={RISK_COLOR[detail.inherentRisk] || TL.primary} chip={<RiskChip rating={detail.inherentRisk} />} />
        <StatTile icon={<ShieldCheckIcon />} label="Residual Risk"
          accent={RISK_COLOR[detail.residualRiskRating] || TL.primary}
          chip={<RiskChip rating={detail.residualRiskRating || detail.residualRisk}
            likelihood={detail.residualLikelihood} impact={detail.residualImpact} />} />
        <StatTile icon={<ClockIcon />} label="Test Frequency" value={detail.testFrequency || 'Not set'} />
        <StatTile icon={<CalendarDaysIcon />} label="Due Date"
          value={detail.nextTestDueDate ? formatDate(detail.nextTestDueDate) : 'Not scheduled'} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <Box>
          <Section icon={<DocumentTextIcon />} title="About this Control">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {detail.whatItDoes && <Field label="What it does" value={detail.whatItDoes} />}
              {detail.howTested && <Field label="How it's tested" value={detail.howTested} />}
              {detail.description && <Field label="Description" value={detail.description} />}
              {!detail.whatItDoes && !detail.howTested && !detail.description && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Not recorded.</Typography>
              )}
            </Box>
          </Section>

          <Section icon={<LinkIcon />} title="Linked Obligations"
            subtitle={obligations.length
              ? `${obligations.length} obligation${obligations.length !== 1 ? 's' : ''} traced to this control`
              : 'Traceability from this control back to the register'}
            action={obligations.length > 0
              ? <StatusBadge label={obligations.length} tone="blue" />
              : null}>
            {obligations.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {obligations.map((o) => (
                  <Tooltip key={o.obligationId} arrow
                    title={o.instrumentTitle ? `Instrument: ${o.instrumentTitle}` : (o.description || '')}>
                    <Chip clickable size="small"
                      label={o.title || o.name || o.description || 'Untitled obligation'}
                      onClick={() => navigate(`/obligations/${o.obligationId}`)}
                      sx={{ height: 'auto', py: 0.4, borderRadius: '6px', bgcolor: TL.gray100, color: TL.gray700,
                        '& .MuiChip-label': { display: 'block', whiteSpace: 'normal', maxWidth: 460, fontSize: '0.75rem', lineHeight: 1.35, py: 0.25 } }} />
                  </Tooltip>
                ))}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <ScaleIcon size={40} sx={{ opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No obligations are linked to this control yet.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Link this control from an obligation — obligations are the source of truth for the link.
                </Typography>
              </Box>
            )}
          </Section>

          <Section icon={<ExclamationTriangleIcon />} title="Findings"
            subtitle={findings.length
              ? `${findings.length} finding${findings.length !== 1 ? 's' : ''} raised from this control`
              : 'Gaps raised automatically when this control fails a test'}
            action={findings.length > 0 ? <StatusBadge label={findings.length} tone="red" /> : null}
            contentSx={findings.length > 0 ? { p: 0 } : undefined}>
            {findings.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Finding</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Owner</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Deadline</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {findings.map((f) => (
                      <TableRow key={f.findingId} hover sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/findings?findingId=${f.findingId}`)}>
                        <TableCell sx={{ maxWidth: 380 }}>
                          <Typography variant="body2" sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: 'primary.main' }}>
                            {f.displayId}
                          </Typography>
                          <Tooltip title={f.description || ''}>
                            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.description}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell><RiskBadge value={f.severity} /></TableCell>
                        <TableCell>{f.assignedToName || '-'}</TableCell>
                        <TableCell><StateBadge value={f.status} /></TableCell>
                        <TableCell>{f.remediationDeadline ? formatDate(f.remediationDeadline) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <ExclamationTriangleIcon size={40} sx={{ opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No findings raised from this control</Typography>
                <Typography variant="caption" color="text.secondary">A failed control test raises a finding here automatically.</Typography>
              </Box>
            )}
          </Section>

          <Section icon={<ClipboardDocumentCheckIcon />} title="Test History"
            action={testHistory.length > 0
              ? <StatusBadge label={testHistory.length} tone="blue" />
              : null}
            contentSx={testHistory.length > 0 ? { p: 0 } : undefined}>
            {testHistory.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Tester</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Review</TableCell>
                      <TableCell>Evidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {testHistory.map((t) => (
                      <TableRow key={t.testId}>
                        <TableCell>{formatDate(t.testDate)}</TableCell>
                        <TableCell>{t.testedByName || '-'}</TableCell>
                        <TableCell>
                          <StatusBadge label={t.result} tone={TEST_RESULT_TONE[t.result] || 'gray'} />
                          {t.failureSeverity && (
                            <Typography sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem', color: TL.gray500 }}>
                              Severity: {t.failureSeverity}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StatusBadge label={t.reviewStatus === 'Pending' ? 'Pending review' : (t.reviewStatus || 'Pending review')}
                              tone={REVIEW_TONE[t.reviewStatus] || 'gray'} />
                            {t.reviewStatus === 'Pending' && canReview && t.testedByUserId !== user?.userId && (
                              <Tooltip title="Review this test result">
                                <IconButton size="small" color="warning" onClick={() => setReviewTarget(t)}>
                                  <ScaleIcon size={16} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {t.reviewStatus === 'Pending' && t.testedByUserId === user?.userId && (
                              <Tooltip title="You recorded this test — a different analyst must review it">
                                <span><IconButton size="small" disabled><ScaleIcon size={16} /></IconButton></span>
                              </Tooltip>
                            )}
                          </Box>
                          {t.reviewStatus === 'Pending' && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                              {t.testedByUserId === user?.userId
                                ? 'Awaiting review by another Analyst/CCO/Admin'
                                : 'Awaiting independent review'}
                            </Typography>
                          )}
                          {t.reviewNotes && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                              {t.reviewNotes}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.evidenceUrl ? <Link href={t.evidenceUrl} target="_blank" rel="noopener" underline="hover" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>View</Link> : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <ClipboardDocumentCheckIcon size={40} sx={{ opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No tests recorded yet</Typography>
              </Box>
            )}
          </Section>
        </Box>

        <Box>
          <Section icon={<QueueListIcon />} title="Classification">
            <FieldGrid min={130}>
              <Field label="Theme" value={detail.theme} />
              <Field label="Type" value={detail.controlType} />
              <Field label="Status" value={detail.status} />
              <Field label="Compliance Area" value={detail.complianceArea} />
            </FieldGrid>
          </Section>

          <Section icon={<ChartBarIcon />} title="Risk Assessment">
            <FieldGrid min={130}>
              <Field label="Inherent Risk"><RiskChip rating={detail.inherentRisk} /></Field>
              <Field label="Residual Risk">
                <RiskChip rating={detail.residualRiskRating || detail.residualRisk}
                  likelihood={detail.residualLikelihood} impact={detail.residualImpact} />
              </Field>
              <Field label="Residual Likelihood" value={detail.residualLikelihood} />
              <Field label="Residual Impact" value={detail.residualImpact} />
            </FieldGrid>
            {detail.residualRiskReason && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                {detail.residualRiskReason}
              </Typography>
            )}
          </Section>

          <Section icon={<UserCircleIcon />} title="Ownership">
            <FieldGrid min={130}>
              <Field label="Control Owner" value={detail.controlOwnerName || detail.ownerName || 'Unassigned'} />
              {detail.ownerName && detail.controlOwnerName && detail.ownerName !== detail.controlOwnerName && (
                <Field label="Owner" value={detail.ownerName} />
              )}
            </FieldGrid>
          </Section>

          <Section icon={<BuildingLibraryIcon />} title="Act / Regulation">
            <FieldGrid min={130}>
              <Field label="Act" value={actLabel(detail)} />
              <Field label="Regulatory Requirement" value={detail.regulatoryRequirement} />
              <Field label="Monitoring Activity" value={detail.monitoringActivity} />
              <Field label="Effectiveness Measure" value={detail.controlEffectivenessMeasure} />
            </FieldGrid>
          </Section>
        </Box>
      </Box>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} control={detail}
        onSaved={() => { setEditOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />
      <RecordTestDialog open={recordTestOpen} onClose={() => setRecordTestOpen(false)} controlId={detail.controlId}
        controlOwnerId={detail.controlOwnerId}
        onSaved={() => { setRecordTestOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />

      <TestReviewDialog open={!!reviewTarget} test={reviewTarget} controlId={detail.controlId}
        onClose={() => setReviewTarget(null)}
        onSaved={() => { setReviewTarget(null); onRefresh(); }}
        onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />
    </Box>
  );
}

/* ───────── Test Review Dialog ───────── */
function TestReviewDialog({ open, test, controlId, onClose, onSaved, onSnackbar, saving, setSaving }) {
  const [decision, setDecision] = useState('Accepted');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) { setDecision('Accepted'); setNotes(''); } }, [open]);
  if (!test) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.controls.reviewTest(controlId, test.testId, decision, notes.trim() || undefined);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review Test Result</DialogTitle>
      <DialogContent>
        <Alert severity={decision === 'Accepted' ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {decision === 'Accepted'
            ? 'Accepting records this result as reviewed.'
            : 'Rejecting reopens the control and lines up a fresh test task.'}
        </Alert>
        <Box sx={{ mb: 2, p: 1.5, bgcolor: TL.gray50, borderRadius: '8px' }}>
          <Typography variant="body2"><strong>{test.result}</strong> · recorded by {test.testedByName || 'unknown'} on {formatDate(test.testDate)}</Typography>
          {test.resultDescription && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{test.resultDescription}</Typography>
          )}
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField select label="Decision" fullWidth size="small" value={decision}
              onChange={e => setDecision(e.target.value)}>
              <MenuItem value="Accepted">Accept</MenuItem>
              <MenuItem value="Rejected">Reject</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Review notes" fullWidth size="small" multiline minRows={3} value={notes}
              onChange={e => setNotes(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={decision === 'Accepted' ? 'success' : 'warning'}
          onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : decision === 'Accepted' ? 'Accept' : 'Reject'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ───────── Edit Dialog ───────── */
function EditDialog({ open, onClose, control, onSaved, onSnackbar, saving, setSaving }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (control) setForm({
      name: control.name || '', description: control.description || '', whatItDoes: control.whatItDoes || '',
      howTested: control.howTested || '', controlOwnerId: control.controlOwnerId ?? null,
      testFrequency: control.testFrequency || '', testFrequencyDays: control.testFrequencyDays?.toString() || '',
      inherentRisk: control.inherentRisk || '',
    });
  }, [control]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.controlOwnerId) body.controlOwnerId = null;
      if (body.testFrequencyDays) body.testFrequencyDays = parseInt(body.testFrequencyDays, 10);
      await api.controls.update(control.controlId, body);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Control — {control?.name}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}><TextField label="Name" fullWidth size="small" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="Description" fullWidth size="small" multiline minRows={2} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="What it does" fullWidth size="small" multiline minRows={2} value={form.whatItDoes}
            onChange={e => setForm(f => ({ ...f, whatItDoes: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="How it's tested" fullWidth size="small" multiline minRows={2} value={form.howTested}
            onChange={e => setForm(f => ({ ...f, howTested: e.target.value }))} /></Grid>
          <Grid size={{ xs: 8 }}><OwnerPicker value={form.controlOwnerId} onChange={id => setForm(f => ({ ...f, controlOwnerId: id }))} label="Owner" /></Grid>
          <Grid size={{ xs: 4 }}>
            <TextField select label="Test Frequency" fullWidth size="small" value={form.testFrequency}
              onChange={e => setForm(f => ({ ...f, testFrequency: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Quarterly">Quarterly</MenuItem>
              <MenuItem value="Semi-Annual">Semi-Annual</MenuItem>
              <MenuItem value="Annual">Annual</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 4 }}><TextField label="Frequency Days" fullWidth size="small" type="number" value={form.testFrequencyDays}
            onChange={e => setForm(f => ({ ...f, testFrequencyDays: e.target.value }))} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ───────── Record Test Dialog ───────── */
function RecordTestDialog({ open, onClose, controlId, controlOwnerId, onSaved, onSnackbar, saving, setSaving }) {
  const [form, setForm] = useState({
    testDate: new Date().toISOString().split('T')[0], result: '', resultDescription: '',
    failureDetails: '', failureSeverity: '', evidenceUrl: '', remediationRequired: false,
    remediationOwnerId: null, remediationDeadline: '',
  });
  useEffect(() => {
    if (open) setForm(f => ({ ...f, remediationOwnerId: controlOwnerId ?? null }));
  }, [open, controlOwnerId]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.remediationOwnerId) body.remediationOwnerId = null;
      if (!body.remediationDeadline) delete body.remediationDeadline;
      await api.controls.recordTest(controlId, body);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Test Result</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}><TextField label="Test Date" type="date" fullWidth size="small" required
            InputLabelProps={{ shrink: true }} value={form.testDate}
            onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))} /></Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Result" fullWidth size="small" required value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Passed">Passed</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
              <MenuItem value="Partial">Partial</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}><TextField label="Result Description" fullWidth size="small" multiline minRows={2} value={form.resultDescription}
            onChange={e => setForm(f => ({ ...f, resultDescription: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="Failure Details" fullWidth size="small" multiline minRows={2} value={form.failureDetails}
            onChange={e => setForm(f => ({ ...f, failureDetails: e.target.value }))} /></Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Failure Severity" fullWidth size="small" value={form.failureSeverity}
              onChange={e => setForm(f => ({ ...f, failureSeverity: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}><TextField label="Evidence URL" fullWidth size="small" value={form.evidenceUrl}
            onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} /></Grid>
          <Grid size={{ xs: 6 }}><OwnerPicker value={form.remediationOwnerId} label="Remediation Owner"
            onChange={id => setForm(f => ({ ...f, remediationOwnerId: id }))} /></Grid>
          <Grid size={{ xs: 6 }}><TextField label="Remediation Deadline" type="date" fullWidth size="small"
            InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
            onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.testDate || !form.result}>
          {saving ? 'Saving...' : 'Record Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
