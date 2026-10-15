import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Tooltip, TablePagination,
  Snackbar, Alert as MuiAlert, Breadcrumbs, Link, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Search, Refresh, Close, Add, Gavel, Visibility, History,
  PlaylistAddCheck, Science, AccountBalance, UploadFile,
  Category, TrendingUp, PersonOutline, Description as DescriptionIcon,
  Link as LinkIcon, Schedule, WarningAmber, VerifiedUser, EventAvailable,
} from '@mui/icons-material';
import { RISK_COLOR } from 'shared';
import { api } from '../services/api';
import { KpiCards, FilterBar, SectionTable } from 'shared';
import { useAuth } from '../contexts/AuthContext';
import OwnerPicker from '../components/org/OwnerPicker';
import CreateControlDialog from '../components/modals/CreateControlDialog';
import ImportDialog from '../components/modals/ImportDialog';
import { Section, Field, FieldGrid, StatTile, RiskChip } from '../components/detailKit';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function actLabel(row) {
  if (!row) return '-';
  return row.actName || '-';
}

const RISK_COLORS = { Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success', Extreme: 'error' };

function residualRiskChip(rating, likelihood, impact) {
  const color = RISK_COLORS[rating];
  if (!rating) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  const chip = (
    <Chip size="small" label={rating} color={color || 'default'} variant={color ? 'filled' : 'outlined'}
      sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
  );
  if (!likelihood && !impact) return chip;
  return <Tooltip title={`${likelihood || '-'} × ${impact || '-'}`}>{chip}</Tooltip>;
}

function nextTestDueCell(value) {
  if (!value) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }
  const due = new Date(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) {
    return <Chip size="small" label={`Overdue ${Math.abs(days)}d`} color="error"
      sx={{ height: 22, borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }} />;
  }
  if (days <= 7) {
    return <Chip size="small" label={`Due in ${days}d`} color="warning" variant="outlined"
      sx={{ height: 22, borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }} />;
  }
  return <Typography variant="body2">{formatDate(value)}</Typography>;
}

const COLUMNS = [
  { id: 'name', label: 'Control', minWidth: 340, sortable: true, sortField: 'name', render: (c) => (
    <Tooltip title={c.name || ''}>
      <Typography variant="body2" sx={{ maxWidth: 420, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.name || 'Untitled control'}
      </Typography>
    </Tooltip>
  ) },
  { id: 'ownerName', label: 'Owner', minWidth: 140, sortable: true, sortField: 'ownerName', render: (c) => (
    (c.ownerName || c.controlOwnerName)
      ? <Tooltip title={c.ownerName || c.controlOwnerName}>
          <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ownerName || c.controlOwnerName}</Typography>
        </Tooltip>
      : <Typography variant="body2" color="text.secondary">Unassigned</Typography>
  ) },
  { id: 'risk', label: 'Risk', minWidth: 110, sortable: true, sortField: 'residualRiskRating', render: (c) => (
    residualRiskChip(c.residualRiskRating || c.residualRisk, c.residualLikelihood, c.residualImpact)
  ) },
  { id: 'frequency', label: 'Test Frequency', minWidth: 140, sortable: true, sortField: 'testFrequency', render: (c) => (
    c.frequency
      ? <Typography variant="body2">{c.frequency}</Typography>
      : <Typography variant="body2" color="text.secondary">Not set</Typography>
  ) },
  { id: 'nextTestDueDate', label: 'Next Test Due', minWidth: 140, render: (c) => nextTestDueCell(c.nextTestDueDate) },
];

export default function ControlsPage() {
  const [searchParams] = useSearchParams();
  const obligationIdParam = searchParams.get('obligationId');
  const queryClient = useQueryClient();

  const [detailId, setDetailId] = useState(null);

  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [actFilter, setActFilter] = useState('All');
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

  const hasFilters = search || themeFilter !== 'All' || riskFilter !== 'All'
    || ownerFilter !== 'All' || statusFilter !== 'All' || actFilter !== 'All';

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (themeFilter !== 'All') params.theme = themeFilter;
  if (riskFilter !== 'All') params.residualRisk = riskFilter;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (actFilter !== 'All') params.actName = actFilter;
  if (obligationIdParam) params.obligationId = obligationIdParam;
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

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['controls'] });

  function clearFilters() {
    setSearch(''); setThemeFilter('All'); setRiskFilter('All');
    setOwnerFilter('All'); setStatusFilter('All'); setActFilter('All');
    setPage(0);
  }

  const kpis = [
    { key: 'total', label: 'Total Controls', value: stats?.total ?? 0, color: '#2B6CB0',
      breakdown: stats?.byStatus, drill: (label) => setStatusFilter(label) },
    { key: 'testsDue', label: 'Tests Due', value: stats?.testsDue ?? 0, color: '#DD6B20',
      breakdown: stats?.byTheme, drill: (label) => setThemeFilter(label) },
    { key: 'failing', label: 'Failing Controls', value: stats?.failingControls ?? 0, color: '#E53E3E',
      breakdown: stats?.byRiskLevel, drill: (label) => setRiskFilter(label) },
    { key: 'openFindings', label: 'Open Findings', value: stats?.openFindings ?? 0, color: '#805AD5',
      breakdown: stats?.findingsBySeverity, drill: (label) => navigate(`/findings?severity=${label}`) },
  ];

  const kpiItems = kpis.map((k) => ({
    key: k.key, label: k.label, color: k.color, value: k.value, breakdown: k.breakdown,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Controls Register</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} control{total !== 1 ? 's' : ''} — inventory, testing and risk assessment
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={refreshAll}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<UploadFile />} size="medium" onClick={() => setImportOpen(true)}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            Import
          </Button>
          <Button variant="contained" startIcon={<Add />} size="medium" onClick={() => setCreateOpen(true)}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            New Control
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search control, number or owner...', minWidth: 260 }}
        filters={filters}
        showClear={hasFilters}
        onClear={clearFilters}
      />

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
        actions={(c) => (
          <Tooltip title="View detail">
            <IconButton size="small" onClick={() => setDetailId(c.controlId)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
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
  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Controls Register</Link>
        <Typography color="text.primary">{detail.name || 'Control'}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">{detail.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" icon={<AccountBalance sx={{ fontSize: 14 }} />}
              label={actLabel(detail)}
              sx={{ height: 22, borderRadius: '4px', fontSize: '0.72rem' }} />
            {detail.status && (
              <Chip size="small" label={detail.status} color={detail.status === 'Active' ? 'success' : 'default'}
                variant={detail.status === 'Active' ? 'outlined' : 'filled'}
                sx={{ height: 22, borderRadius: '4px', fontSize: '0.72rem' }} />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<History />} onClick={onEdit}>Edit</Button>
          <Button variant="contained" startIcon={<PlaylistAddCheck />} onClick={onRecordTest}>Record Test</Button>
        </Box>
      </Box>

      {/* Headline numbers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatTile icon={<WarningAmber fontSize="small" />} label="Inherent Risk"
          accent={RISK_COLOR[detail.inherentRisk] || '#2B6CB0'} chip={<RiskChip rating={detail.inherentRisk} />} />
        <StatTile icon={<VerifiedUser fontSize="small" />} label="Residual Risk"
          accent={RISK_COLOR[detail.residualRiskRating] || '#2B6CB0'}
          chip={<RiskChip rating={detail.residualRiskRating || detail.residualRisk}
            likelihood={detail.residualLikelihood} impact={detail.residualImpact} />} />
        <StatTile icon={<Schedule fontSize="small" />} label="Test Frequency" value={detail.testFrequency || 'Not set'} />
        <StatTile icon={<EventAvailable fontSize="small" />} label="Next Test Due"
          value={detail.nextTestDueDate ? formatDate(detail.nextTestDueDate) : 'Not scheduled'} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <Box>
          <Section icon={<DescriptionIcon fontSize="small" />} title="About this Control">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {detail.whatItDoes && <Field label="What it does" value={detail.whatItDoes} />}
              {detail.howTested && <Field label="How it's tested" value={detail.howTested} />}
              {detail.description && <Field label="Description" value={detail.description} />}
              {!detail.whatItDoes && !detail.howTested && !detail.description && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Not recorded.</Typography>
              )}
            </Box>
          </Section>

          <Section icon={<LinkIcon fontSize="small" />} title="Linked Obligations"
            subtitle={obligations.length
              ? `${obligations.length} obligation${obligations.length !== 1 ? 's' : ''} traced to this control`
              : 'Traceability from this control back to the register'}
            action={obligations.length > 0
              ? <Chip size="small" label={obligations.length} color="primary" sx={{ height: 22, borderRadius: '4px' }} />
              : null}>
            {obligations.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {obligations.map((o) => (
                  <Tooltip key={o.obligationId} arrow
                    title={o.instrumentTitle ? `Instrument: ${o.instrumentTitle}` : (o.description || '')}>
                    <Chip clickable size="small"
                      label={o.title || o.name || o.description || 'Untitled obligation'}
                      onClick={() => navigate(`/obligations/${o.obligationId}`)}
                      sx={{ height: 'auto', py: 0.4, borderRadius: '4px', bgcolor: '#EDF2F7',
                        '& .MuiChip-label': { display: 'block', whiteSpace: 'normal', maxWidth: 460, fontSize: '0.75rem', lineHeight: 1.35, py: 0.25 } }} />
                  </Tooltip>
                ))}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Gavel sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No obligations are linked to this control yet.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Use Edit to attach obligation IDs and establish traceability.
                </Typography>
              </Box>
            )}
          </Section>

          <Section icon={<Science fontSize="small" />} title="Test History"
            action={testHistory.length > 0
              ? <Chip size="small" label={testHistory.length} color="primary" sx={{ height: 22, borderRadius: '4px' }} />
              : null}>
            {testHistory.length > 0 ? (
              <TableContainer component={Paper} elevation={0} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Tester</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Review</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Evidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {testHistory.map((t) => (
                      <TableRow key={t.testId}>
                        <TableCell>{formatDate(t.testDate)}</TableCell>
                        <TableCell>{t.testedByName || '-'}</TableCell>
                        <TableCell>
                          <Chip label={t.result} size="small"
                            color={t.result === 'Passed' ? 'success' : t.result === 'Failed' ? 'error' : t.result === 'Partial' ? 'warning' : 'default'} />
                        </TableCell>
                        <TableCell>{t.failureSeverity || '-'}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label={t.reviewStatus || 'Pending'} size="small"
                              color={t.reviewStatus === 'Accepted' ? 'success' : t.reviewStatus === 'Rejected' ? 'error' : 'default'} />
                            {t.reviewStatus === 'Pending' && canReview && t.testedByUserId !== user?.userId && (
                              <Tooltip title="Review this test result">
                                <IconButton size="small" color="warning" onClick={() => setReviewTarget(t)}>
                                  <Gavel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {t.reviewStatus === 'Pending' && t.testedByUserId === user?.userId && (
                              <Tooltip title="You recorded this test — a different analyst must review it">
                                <span><IconButton size="small" disabled><Gavel fontSize="small" /></IconButton></span>
                              </Tooltip>
                            )}
                          </Box>
                          {t.reviewNotes && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                              {t.reviewNotes}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.evidenceUrl ? <Link href={t.evidenceUrl} target="_blank" rel="noopener">View</Link> : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Science sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No tests recorded yet</Typography>
              </Box>
            )}
          </Section>
        </Box>

        <Box>
          <Section icon={<Category fontSize="small" />} title="Classification">
            <FieldGrid min={130}>
              <Field label="Theme" value={detail.theme} />
              <Field label="Type" value={detail.controlType} />
              <Field label="Status" value={detail.status} />
              <Field label="Compliance Area" value={detail.complianceArea} />
            </FieldGrid>
          </Section>

          <Section icon={<TrendingUp fontSize="small" />} title="Risk Assessment">
            <FieldGrid min={130}>
              <Field label="Inherent Risk"><RiskChip rating={detail.inherentRisk} /></Field>
              <Field label="Residual Risk">
                <RiskChip rating={detail.residualRiskRating || detail.residualRisk}
                  likelihood={detail.residualLikelihood} impact={detail.residualImpact} />
              </Field>
              <Field label="Residual Likelihood" value={detail.residualLikelihood} />
              <Field label="Residual Impact" value={detail.residualImpact} />
            </FieldGrid>
          </Section>

          <Section icon={<PersonOutline fontSize="small" />} title="Ownership">
            <FieldGrid min={130}>
              <Field label="Control Owner" value={detail.controlOwnerName || detail.ownerName || 'Unassigned'} />
              {detail.ownerName && detail.controlOwnerName && detail.ownerName !== detail.controlOwnerName && (
                <Field label="Owner" value={detail.ownerName} />
              )}
            </FieldGrid>
          </Section>

          <Section icon={<AccountBalance fontSize="small" />} title="Act / Regulation">
            <FieldGrid min={130}>
              <Field label="Act" value={actLabel(detail)} />
              <Field label="Regulatory Requirement" value={detail.regulatoryRequirement} />
              <Field label="Monitoring Activity" value={detail.monitoringActivity} />
              <Field label="Due Date" value={detail.dueDate} />
              <Field label="Effectiveness Measure" value={detail.controlEffectivenessMeasure} />
            </FieldGrid>
          </Section>
        </Box>
      </Box>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} control={detail}
        onSaved={() => { setEditOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />
      <RecordTestDialog open={recordTestOpen} onClose={() => setRecordTestOpen(false)} controlId={detail.controlId}
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
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
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
      linkedObligationIds: control.linkedObligations?.map(o => o.obligationId).join(', ') || '',
      inherentRisk: control.inherentRisk || '',
    });
  }, [control]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.controlOwnerId) body.controlOwnerId = null;
      if (body.testFrequencyDays) body.testFrequencyDays = parseInt(body.testFrequencyDays, 10);
      if (body.linkedObligationIds) body.linkedObligationIds = body.linkedObligationIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      else body.linkedObligationIds = [];
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
          <Grid size={{ xs: 8 }}><TextField label="Linked Obligation IDs (comma-separated)" fullWidth size="small" value={form.linkedObligationIds}
            onChange={e => setForm(f => ({ ...f, linkedObligationIds: e.target.value }))} /></Grid>
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
function RecordTestDialog({ open, onClose, controlId, onSaved, onSnackbar, saving, setSaving }) {
  const [form, setForm] = useState({
    testDate: new Date().toISOString().split('T')[0], result: '', resultDescription: '',
    failureDetails: '', failureSeverity: '', evidenceUrl: '', remediationRequired: false,
    remediationOwnerId: null, remediationDeadline: '',
  });
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
