import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, Alert, IconButton, Paper,
  TextField, MenuItem, FormControlLabel, Checkbox, Tooltip,
  Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  Search, Refresh, Close, Add, Edit as EditIcon, Delete as DeleteIcon,
  InfoOutlined, UploadFile,
} from '@mui/icons-material';
import { api } from '../services/api';
import { SectionTable } from 'shared';
import CreateObligationDialog from '../components/modals/CreateObligationDialog';
import ImportDialog from '../components/modals/ImportDialog';

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

const COLUMNS = [
  { id: 'title', label: 'Obligation', minWidth: 360, sortable: true, sortField: 'name',
    render: (item) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={item.title || item.name || ''}>
          <Typography variant="body2" sx={ellipsis(420)}>
            {item.title || item.name || 'Untitled obligation'}
          </Typography>
        </Tooltip>
        {item.description && (
          <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Box>}>
            <InfoOutlined sx={{ fontSize: 14, color: '#A0AEC0', flexShrink: 0 }} />
          </Tooltip>
        )}
      </Box>
    ) },
  { id: 'regulatorAbbreviation', label: 'Regulator', minWidth: 130, sortable: true,
    render: (item) => (item.regulatorAbbreviation
      ? <Chip size="small" label={item.regulatorAbbreviation}
          sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
  { id: 'returnCount', label: 'Returns', minWidth: 100,
    render: (item) => {
      const count = item.linkedReturnIds?.length ?? 0;
      const names = item.returnNames || [];
      const label = <Typography variant="body2"
        sx={count === 0 ? { color: 'text.secondary' } : { color: '#DD6B20' }}>{count}</Typography>;
      return count > 0 && names.length > 0
        ? <Tooltip title={names.join(', ')}>{label}</Tooltip>
        : label;
    } },
  { id: 'controlCount', label: 'Controls', minWidth: 110,
    render: (item) => {
      const count = item.controlCount ?? 0;
      return <Typography variant="body2"
        sx={count === 0 ? { color: 'text.secondary' } : { color: '#2D7D46' }}>{count}</Typography>;
    } },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 110,
    render: (item) => {
      const sanctions = item.sanctions || [];
      const label = <Typography variant="body2"
        sx={sanctions.length === 0 ? { color: 'text.secondary' } : { color: '#805AD5' }}>{sanctions.length}</Typography>;
      return sanctions.length > 0
        ? <Tooltip title={sanctions.map(s => s.sanctionType || s.description).filter(Boolean).join('; ')}>{label}</Tooltip>
        : label;
    } },
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
  const [importOpen, setImportOpen] = useState(false);
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
          <Button variant="outlined" startIcon={<UploadFile />} size="medium" onClick={() => setImportOpen(true)}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            Import
          </Button>
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
        onRowClick={openDetail}
        rowKey={(item) => item.obligationId}
        emptyMessage="No obligations found."
        actions={(item) => (
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
        )}
      />

    <CreateObligationDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={handleSaved} onSnackbar={setSnackbar}
        editing={!!editTarget} initial={editTarget} />

      <ImportDialog entityType="obligations" entityLabel="obligations" open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(r) => setSnackbar(`Imported ${r?.importedRows ?? 0} obligations.`)} />

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}
