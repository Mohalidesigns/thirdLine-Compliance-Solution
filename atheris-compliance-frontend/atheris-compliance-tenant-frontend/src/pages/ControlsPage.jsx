import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Tooltip, TablePagination, TableSortLabel,
  Snackbar, Alert as MuiAlert, Breadcrumbs, Link, Grid,
  Card, CardContent, CardHeader, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Search, Refresh, Close, Add, Gavel, Visibility, History,
  PlaylistAddCheck, Science, ChevronRight, AccountBalance,
} from '@mui/icons-material';
import { api } from '../services/api';
import OwnerPicker from '../components/org/OwnerPicker';
import CreateControlDialog from '../components/modals/CreateControlDialog';

const RISK_COLORS = { Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success', Extreme: 'error' };

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function actLabel(row) {
  if (!row) return '-';
  if (row.actName) return row.actName;
  if (row.actId) return `Act #${row.actId}`;
  return '-';
}

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

const COLUMNS = [
  { id: 'name', label: 'Control', minWidth: 300, sortField: 'name' },
  { id: 'classification', label: 'Classification', minWidth: 200, sortField: 'complianceArea' },
  { id: 'owner', label: 'Owner', minWidth: 140, sortField: 'ownerName' },
  { id: 'risk', label: 'Risk & Status', minWidth: 150, sortField: 'residualRiskRating' },
  { id: 'testing', label: 'Testing', minWidth: 140, sortField: 'dueDate' },
  { id: 'actions', label: '', minWidth: 60 },
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

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'highRisk') { setRiskFilter('High'); }
    else if (type === 'testsDue') { setStatusFilter('Active'); /* TODO: filter by overdue tests */ }
    else { setRiskFilter('All'); setStatusFilter('All'); }
  }

  const kpis = [
    { key: 'total', label: 'Total Controls', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'active', label: 'Active', value: stats?.active ?? 0, color: '#38A169', bg: '#F0FFF4' },
    { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
    { key: 'testsDue', label: 'Tests Due', value: stats?.testsDue ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
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
          <Button variant="contained" startIcon={<Add />} size="medium" onClick={() => setCreateOpen(true)}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            New Control
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI cards */}
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

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search control, number or owner..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <TextField select size="small" value={themeFilter} onChange={e => { setThemeFilter(e.target.value); setPage(0); }}
          label="Theme" sx={{ minWidth: 130 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.themes || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Residual Risk" sx={{ minWidth: 130 }}>
          {['All', 'Critical', 'High', 'Moderate', 'Low'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 120 }}>
          {['All', 'Active', 'Inactive'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={actFilter} onChange={e => { setActFilter(e.target.value); setPage(0); }}
          label="Act" sx={{ minWidth: 150 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.acts || []).map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Gavel sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No controls found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      if (sortField === 'controlNumber') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else { setSortField('controlNumber'); setSortDir('asc'); }
                      setPage(0);
                    }}>
                    <TableSortLabel active={sortField === 'controlNumber'} direction={sortDir}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: sortField === 'controlNumber' ? 1 : 0.4 } }}>
                      #
                    </TableSortLabel>
                  </TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
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
                {items.map((item, idx) => (
                  <TableRow key={item.controlId} hover
                    onClick={() => setDetailId(item.controlId)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>
                      <Tooltip title={item.name || 'Untitled'}>
                        <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 340,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name || 'Untitled'}
                        </Typography>
                      </Tooltip>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                        {item.controlNumber && (
                          <Typography variant="caption" sx={{ color: '#A0AEC0', fontFamily: 'Roboto Mono, monospace' }}>
                            {item.controlNumber}
                          </Typography>
                        )}
                        <Tooltip title={item.actName || (item.actId ? `Act #${item.actId}` : 'No act linked')}>
                          <Typography variant="caption" color="text.secondary"
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.25, maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <AccountBalance sx={{ fontSize: 13, opacity: 0.6 }} />
                            {actLabel(item)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip size="small" label={item.controlType || 'CMP'}
                          color={item.controlType === 'ADDITIONAL' ? 'info' : 'default'}
                          sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem' }} />
                        {item.theme && (
                          <Chip size="small" label={item.theme} variant="outlined"
                            sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 130 }} />
                        )}
                      </Box>
                      <Tooltip title={item.complianceArea || 'No compliance area'}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25,
                          maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.complianceArea || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {(item.ownerName || item.controlOwnerName)
                        ? <Tooltip title={item.ownerName || item.controlOwnerName}>
                            <Typography variant="body2" sx={{ maxWidth: 130, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.ownerName || item.controlOwnerName}
                            </Typography>
                          </Tooltip>
                        : <Typography variant="body2" color="text.secondary">Unassigned</Typography>}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        {residualRiskChip(item.residualRiskRating || item.residualRisk,
                          item.residualLikelihood, item.residualImpact)}
                        <Chip size="small" label={item.status || '-'}
                          color={item.status === 'Active' ? 'success' : 'default'}
                          variant={item.status === 'Active' ? 'outlined' : 'filled'}
                          sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem' }} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.frequency || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Due {item.dueDate || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Tooltip title="View detail">
                        <IconButton size="small" onClick={() => setDetailId(item.controlId)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      <CreateControlDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); refreshAll(); }} onSnackbar={setSnackbar} />

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
  const obligations = detail.linkedObligations || [];
  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Controls Register</Link>
        <Typography color="text.primary">{detail.controlNumber}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4">{detail.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: '#A0AEC0', fontFamily: 'Roboto Mono, monospace' }}>
              {detail.controlNumber}
            </Typography>
            <Chip size="small" variant="outlined" icon={<AccountBalance sx={{ fontSize: 14 }} />}
              label={actLabel(detail)}
              sx={{ height: 22, borderRadius: '4px', fontSize: '0.72rem' }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<History />} onClick={onEdit}>Edit</Button>
          <Button variant="contained" startIcon={<PlaylistAddCheck />} onClick={onRecordTest}>Record Test</Button>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title="About this Control" />
            <CardContent>
              {detail.whatItDoes && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">What it does</Typography>
                  <Typography variant="body2">{detail.whatItDoes}</Typography>
                </Box>
              )}
              {detail.howTested && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">How it's tested</Typography>
                  <Typography variant="body2">{detail.howTested}</Typography>
                </Box>
              )}
              {detail.description && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                  <Typography variant="body2">{detail.description}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardHeader
              title="Linked Obligations"
              subheader={obligations.length
                ? `${obligations.length} obligation${obligations.length !== 1 ? 's' : ''} traced to this control`
                : 'Traceability from this control back to the register'}
              action={obligations.length > 0
                ? <Chip size="small" label={obligations.length} color="primary" sx={{ height: 22, borderRadius: '4px', mt: 1, mr: 1 }} />
                : null} />
            <CardContent>
              {obligations.length > 0 ? (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Obligation</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Instrument</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: 48 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {obligations.map((o) => (
                        <TableRow key={o.obligationId} hover
                          onClick={() => navigate(`/obligations/${o.obligationId}`)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                          <TableCell sx={{ fontFamily: 'Roboto Mono, monospace', color: '#718096', width: 80 }}>
                            #{o.obligationId}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{o.description || 'Untitled obligation'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{o.instrumentTitle || '-'}</Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Tooltip title="Open obligation">
                              <IconButton size="small"
                                onClick={e => { e.stopPropagation(); navigate(`/obligations/${o.obligationId}`); }}>
                                <ChevronRight fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Gavel sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No obligations are linked to this control yet.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Use Edit to attach obligation IDs and establish traceability.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Control Details</Typography>
              <DetailRow label="Theme" value={detail.theme} />
              <DetailRow label="Type" value={detail.controlType} />
              <DetailRow label="Owner" value={detail.controlOwnerName || 'Unassigned'} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Act / Regulation</Typography>
              <DetailRow label="Act" value={actLabel(detail)} />
              <DetailRow label="Regulatory Requirement" value={detail.regulatoryRequirement} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>CMP Information</Typography>
              <DetailRow label="Compliance Area" value={detail.complianceArea} />
              <DetailRow label="Monitoring Activity" value={detail.monitoringActivity} />
              <DetailRow label="Due Date" value={detail.dueDate} />
              <DetailRow label="Effectiveness Measure" value={detail.controlEffectivenessMeasure} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Risk Assessment</Typography>
              <DetailRow label="Inherent Risk" value={detail.inherentRisk} chip />
              <DetailRow label="Residual Risk" value={detail.residualRisk} chip />
              <DetailRow label="Residual Likelihood" value={detail.residualLikelihood} />
              <DetailRow label="Residual Impact" value={detail.residualImpact} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Residual Risk Rating</Typography>
                {residualRiskChip(detail.residualRiskRating, detail.residualLikelihood, detail.residualImpact)}
              </Box>
              <DetailRow label="Owner" value={detail.ownerName || detail.controlOwnerName} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Testing</Typography>
              <DetailRow label="Frequency" value={detail.testFrequency || 'Not set'} />
              <DetailRow label="Next test due" value={detail.nextTestDueDate ? formatDate(detail.nextTestDueDate) : 'Not scheduled'} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2 }}>
        <CardHeader title="Test History" />
        <CardContent>
          {detail.testHistory && detail.testHistory.length > 0 ? (
            <TableContainer component={Paper} elevation={0}>
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
                  {detail.testHistory.map((t) => (
                    <TableRow key={t.testId}>
                      <TableCell>{formatDate(t.testDate)}</TableCell>
                      <TableCell>{t.testedByName || '-'}</TableCell>
                      <TableCell>
                        <Chip label={t.result} size="small"
                          color={t.result === 'Passed' ? 'success' : t.result === 'Failed' ? 'error' : t.result === 'Partial' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell>{t.failureSeverity || '-'}</TableCell>
                      <TableCell>
                        <Chip label={t.reviewStatus || 'Pending'} size="small"
                          color={t.reviewStatus === 'Accepted' ? 'success' : t.reviewStatus === 'Rejected' ? 'error' : 'default'} />
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
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Science sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No tests recorded yet</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} control={detail}
        onSaved={() => { setEditOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />
      <RecordTestDialog open={recordTestOpen} onClose={() => setRecordTestOpen(false)} controlId={detail.controlId}
        onSaved={() => { setRecordTestOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />
    </Box>
  );
}

function DetailRow({ label, value, chip }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {chip ? <Chip label={value || '-'} size="small" color={RISK_COLORS[value] || 'default'} />
        : <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || '-'}</Typography>}
    </Box>
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
      <DialogTitle>Edit Control — {control?.controlNumber}</DialogTitle>
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
