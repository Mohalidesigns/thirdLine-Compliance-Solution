import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, FormControlLabel, Checkbox, Tooltip,
  TablePagination, TableSortLabel, Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  Search, Refresh, Close, Add, Edit as EditIcon, Delete as DeleteIcon,
  Warning as WarningIcon, Article, InfoOutlined,
} from '@mui/icons-material';
import { api } from '../services/api';
import CreateObligationDialog from '../components/modals/CreateObligationDialog';

// harmonized with ReviewEditPage / ReviewInboxPage
const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

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

function prettify(v) {
  return v ? String(v).replace(/_/g, ' ') : '';
}

const COLUMNS = [
  { id: 'obligation', label: 'Obligation (Title + Interpreted)', minWidth: 340, sortField: 'name' },
  { id: 'source', label: 'Regulator / Act', minWidth: 160 },
  { id: 'risk', label: 'Risk', minWidth: 100, sortField: 'tenantRiskRating' },
  { id: 'owner', label: 'Owner', minWidth: 120 },
  { id: 'controls', label: 'Controls', minWidth: 140 },
  { id: 'actions', label: 'Actions', minWidth: 80 },
];

export default function ObligationsRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // filters — initialize from URL params when navigated from dashboard
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') || 'All');
  const [regulatorFilter, setRegulatorFilter] = useState(searchParams.get('regulator') || 'All');
  const [areaFilter, setAreaFilter] = useState(searchParams.get('areaOfFocus') || 'All');
  const [ownerFilter, setOwnerFilter] = useState(searchParams.get('owner') || 'All');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [hasGapFilter, setHasGapFilter] = useState(searchParams.get('hasGap') === 'true');
  const [noControl, setNoControl] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  // dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [snackbar, setSnackbar] = useState('');

  const hasFilters = search || riskFilter !== 'All' || regulatorFilter !== 'All'
    || areaFilter !== 'All' || ownerFilter !== 'All' || statusFilter !== 'All' || hasGapFilter || noControl;

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (riskFilter !== 'All') params.risk = riskFilter;
  if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
  if (areaFilter !== 'All') params.areaOfFocus = areaFilter;
  if (ownerFilter !== 'All') params.owner = ownerFilter;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (hasGapFilter) params.hasGap = 'true';
  if (noControl) params.noControl = 'true';
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['obligations', 'register', params],
    queryFn: ({ signal }) => api.obligations.register(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['obligations', 'stats'],
    queryFn: ({ signal }) => api.obligations.stats({ signal }),
  });

  const deleteMutation = useMutation({
    mutationFn: (obligationId) => api.obligations.remove(obligationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
      setSnackbar('Obligation deleted.');
    },
    onError: (e) => setSnackbar(e.message || 'Failed to delete obligation.'),
  });

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const loading = listQuery.isPending;
  const error = listQuery.error?.message || '';

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['obligations'] });
  }

  function clearFilters() {
    setSearch(''); setRiskFilter('All'); setRegulatorFilter('All');
    setAreaFilter('All'); setOwnerFilter('All'); setStatusFilter('All'); setHasGapFilter(false); setNoControl(false);
    setPage(0);
  }

  function openDetail(row) {
    navigate(`/obligations/${row.obligationId}`);
  }

  function openCreate() { setEditTarget(null); setCreateOpen(true); }

  function openEdit(row) {
    setEditTarget(row);
    setCreateOpen(true);
  }

  function handleDelete(row) {
    if (!window.confirm(`Delete obligation #${row.obligationNumber}?\n\n"${row.title || row.name || row.description}"`)) return;
    deleteMutation.mutate(row.obligationId);
  }

  function handleSaved() {
    setSnackbar('Obligation saved.');
    refresh();
  }

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'highRisk') { setRiskFilter('High'); setStatusFilter('All'); }
    else if (type === 'gaps') { setNoControl(true); setHasGapFilter(false); }
    else if (type === 'underReview') { setStatusFilter('unclassified'); setHasGapFilter(false); setNoControl(false); }
    else { setRiskFilter('All'); setHasGapFilter(false); setNoControl(false); setStatusFilter('All'); }
  }

  const kpis = [
    { key: 'total', label: 'Total Obligations', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
    { key: 'gaps', label: 'No Control', value: stats?.gaps ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
    { key: 'underReview', label: 'Under Review', value: stats?.underReview ?? 0, color: '#805AD5', bg: '#FAF5FF' },
  ];

  const riskLevels = stats?.riskLevels?.length ? stats.riskLevels : ['Critical', 'High', 'Moderate', 'Low'];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Obligations Register</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} obligation{total !== 1 ? 's' : ''} — assign owners, rate risk and track control gaps
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} size="medium" onClick={openCreate}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            New Obligation
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
        <TextField size="small" placeholder="Search obligation, title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk" sx={{ minWidth: 110 }}>
          {['All', ...riskLevels].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorFilter} onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 130 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.regulators || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={areaFilter} onChange={e => { setAreaFilter(e.target.value); setPage(0); }}
          label="Domain" sx={{ minWidth: 160 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.themes || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setPage(0); }}
          label="Owner" sx={{ minWidth: 140 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.owners || []).map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 120 }}>
          {['All', 'active', 'unclassified', 'under_review'].map(s =>
            <MenuItem key={s} value={s}>{s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
        </TextField>
        <FormControlLabel control={
          <Checkbox size="small" checked={hasGapFilter} onChange={e => { setHasGapFilter(e.target.checked); setPage(0); }} />
        } label={<Typography variant="body2">Has gap</Typography>} />
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No obligations found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
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
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const rating = item.tenantRiskRating || item.inherentRiskRating;
                  const controlCount = item.controlCount ?? 0;
                  const rowHasGap = item.hasGap;
                  const heading = item.title || item.name;
                  return (
                    <TableRow key={item.obligationId} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer', '& > td': { py: 1 }, '&:hover': { bgcolor: '#F7FAFC' } }}>
                      <TableCell sx={{ color: 'text.secondary' }}>{total - (page * rowsPerPage) - idx}</TableCell>
                      <TableCell sx={{ minWidth: 340, maxWidth: 420 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, maxWidth: 360,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {heading || <span style={{ color: '#A0AEC0', fontWeight: 400 }}>Untitled obligation</span>}
                          </Typography>
                          {item.description && (
                            <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Box>}>
                              <InfoOutlined sx={{ fontSize: 14, color: '#A0AEC0', flexShrink: 0 }} />
                            </Tooltip>
                          )}
                        </Box>
                        {item.plainEnglishStatement ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.plainEnglishStatement}
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>
                        )}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {item.sectionReference && (
                            <Chip size="small" variant="outlined" label={item.sectionReference.slice(0, 24)}
                              sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
                          )}
                          {item.areaOfFocus && (
                            <Chip size="small" variant="outlined" label={item.areaOfFocus}
                              sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 150 }} />
                          )}
                          {item.obligationType && (
                            <Chip size="small" variant="outlined" label={prettify(item.obligationType)}
                              sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
                          )}
                          {item.recurringDeadlineType && (
                            <Chip size="small" variant="outlined" label={prettify(item.recurringDeadlineType)}
                              sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        {item.regulatorAbbreviation
                          ? <Chip size="small" label={item.regulatorAbbreviation}
                              sx={{ height: 22, fontWeight: 600, borderRadius: '4px', bgcolor: '#1A365D', color: '#fff' }} />
                          : <Typography variant="body2" color="text.secondary">-</Typography>}
                        {(item.actName || item.regulationId) && (
                          <Tooltip title={item.actName || `Reg #${item.regulationId}`}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, maxWidth: 180,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.actName || `Reg #${item.regulationId}`}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>{inherentRiskChip(rating, item.inherentLikelihood, item.inherentImpact)}</TableCell>
                      <TableCell>
                        {item.assignedOwnerName
                          ? <Typography variant="body2">{item.assignedOwnerName}</Typography>
                          : <Typography variant="body2" color="text.secondary">-</Typography>}
                      </TableCell>
                      <TableCell>
                        {controlCount === 0 ? (
                          <Chip size="small" label="No controls" color="error"
                            icon={<WarningIcon sx={{ fontSize: 14 }} />}
                            sx={{ height: 22, borderRadius: '4px', border: 'none' }} />
                        ) : rowHasGap ? (
                          <Chip size="small" label={`${controlCount} controls`} color="warning"
                            icon={<WarningIcon sx={{ fontSize: 14 }} />}
                            sx={{ height: 22, borderRadius: '4px', border: 'none' }} />
                        ) : (
                          <Typography variant="body2" color="black">{controlCount} controls</Typography>
                        )}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Tooltip title="Edit obligation">
                            <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete obligation">
                            <IconButton size="small" color="error" onClick={() => handleDelete(item)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

    <CreateObligationDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={handleSaved} onSnackbar={setSnackbar}
        editing={!!editTarget} initial={editTarget} />

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}
