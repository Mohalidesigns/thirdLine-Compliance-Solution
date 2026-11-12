import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, Alert, IconButton,
  Tooltip, Snackbar, Alert as MuiAlert,
} from '@mui/material';
import { api } from '../services/api';
import {
  SectionTable, PageHeader, KpiCards, FilterBar, StatusBadge,
  ArrowPathIcon, PlusIcon, PencilSquareIcon, TrashIcon, InformationCircleIcon, ArrowUpTrayIcon,
  ScaleIcon, ExclamationTriangleIcon, ShieldCheckIcon, ExclamationCircleIcon, EyeIcon, CalendarDaysIcon,
  CheckCircleIcon,
} from 'shared';
import CreateObligationDialog from '../components/modals/CreateObligationDialog';
import ImportDialog from '../components/modals/ImportDialog';
import { useAuth } from '../contexts/AuthContext';
import { isReadOnly } from '../utils/roles';

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

const STATE_TONE = { COMPLIANT: 'green', PARTIAL: 'amber', NON_COMPLIANT: 'red', GAP: 'red', NO_REQUIREMENTS: 'gray' };
const STATE_LABEL = {
  COMPLIANT: 'Compliant', PARTIAL: 'Partial', NON_COMPLIANT: 'Non-compliant',
  GAP: 'No control', NO_REQUIREMENTS: 'No requirements',
};

const COLUMNS = [
  { id: 'title', label: 'Obligation', minWidth: 360, sortable: true, sortField: 'name',
    render: (item) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={item.name || ''}>
          <Typography variant="body2" sx={{ ...ellipsis(420), color: 'primary.main', fontWeight: 500 }}>
            {item.name || 'Untitled obligation'}
          </Typography>
        </Tooltip>
        {item.description && (
          <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Box>}>
            <Box component="span" sx={{ display: 'inline-flex', color: '#A0AEC0', flexShrink: 0 }}><InformationCircleIcon size={14} /></Box>
          </Tooltip>
        )}
      </Box>
    ) },
  { id: 'regulatorAbbreviation', label: 'Regulator', minWidth: 130, sortable: true,
    render: (item) => (item.regulatorAbbreviation
      ? <Chip size="small" label={item.regulatorAbbreviation} />
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
  { id: 'complianceState', label: 'Compliance', minWidth: 150,
    render: (item) => (
      <Tooltip title={item.requirementCount
        ? `${item.coveredRequirementCount ?? 0} of ${item.requirementCount} requirements covered`
        : 'No requirements'}>
        <span>
          <StatusBadge tone={STATE_TONE[item.complianceState] || 'gray'}
            label={STATE_LABEL[item.complianceState] || item.complianceState || '—'}
            dot={item.complianceState === 'NON_COMPLIANT' || item.complianceState === 'GAP'} />
        </span>
      </Tooltip>
    ) },
  { id: 'controlCount', label: 'Controls', minWidth: 110,
    render: (item) => {
      const count = item.controlCount ?? 0;
      return <Typography variant="body2"
        sx={count === 0 ? { color: 'text.secondary' } : { color: '#2D7D46' }}>{count}</Typography>;
    } },
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
];

export default function ObligationsRegisterPage() {
  const { user } = useAuth();
  const readOnly = isReadOnly(user?.role);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // filters — initialize from URL params when navigated from dashboard
  const [search, setSearch] = useState(searchParams.get('q') || '');
  // The top-bar search routes here as /obligations?q=…; follow it even when already mounted.
  const urlQuery = searchParams.get('q');
  useEffect(() => { if (urlQuery != null) setSearch(urlQuery); }, [urlQuery]);
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') || 'All');
  const [regulatorFilter, setRegulatorFilter] = useState(searchParams.get('regulator') || 'All');
  const [areaFilter, setAreaFilter] = useState(searchParams.get('areaOfFocus') || 'All');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || 'All');
  const [noControl, setNoControl] = useState(() => searchParams.get('noControl') === 'true');
  const [withReturns, setWithReturns] = useState(() => searchParams.get('hasReturns') === 'true');
  // Risk-heatmap drill-down (dashboard → register): the clicked cells, the heatmap view, and a label.
  const [heatmapDrill, setHeatmapDrill] = useState(() => (searchParams.get('cells')
    ? { cells: searchParams.get('cells'), riskView: searchParams.get('riskView') || 'inherent', label: searchParams.get('drill') || 'Selected cells' }
    : null));
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
    || areaFilter !== 'All' || statusFilter !== 'All' || stateFilter !== 'All'
    || noControl || withReturns || heatmapDrill;

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (riskFilter !== 'All') params.risk = riskFilter;
  if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
  if (areaFilter !== 'All') params.areaOfFocus = areaFilter;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (stateFilter !== 'All') params.state = stateFilter;
  if (noControl) params.noControl = 'true';
  if (withReturns) params.hasReturns = 'true';
  if (heatmapDrill) { params.cells = heatmapDrill.cells; params.riskView = heatmapDrill.riskView; }
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
    setAreaFilter('All'); setStatusFilter('All'); setStateFilter('All'); setNoControl(false); setWithReturns(false);
    clearHeatmapDrill();
    setPage(0);
  }

  function clearHeatmapDrill() {
    setHeatmapDrill(null);
    setPage(0);
    if (searchParams.has('cells')) {
      const next = new URLSearchParams(searchParams);
      ['cells', 'riskView', 'drill'].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    }
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
    if (!window.confirm(`Delete obligation #${row.obligationNumber}?\n\n"${row.name}"`)) return;
    deleteMutation.mutate(row.obligationId);
  }

  function handleSaved() {
    setSnackbar('Obligation saved.');
    refresh();
  }

  function applyKpiFilter(type) {
    setRiskFilter('All'); setRegulatorFilter('All'); setAreaFilter('All');
    setStatusFilter('All'); setStateFilter('All'); setNoControl(false); setWithReturns(false);
    clearHeatmapDrill();
    if (type === 'highRisk') { setRiskFilter('High'); }
    else if (type === 'compliant') { setStateFilter('COMPLIANT'); }
    else if (type === 'partial') { setStateFilter('PARTIAL'); }
    else if (type === 'nonCompliant') { setStateFilter('NON_COMPLIANT'); }
    else if (type === 'gaps') { setNoControl(true); }
    setPage(0);
  }

  const activeKpi = stateFilter === 'COMPLIANT' ? 'compliant'
    : stateFilter === 'PARTIAL' ? 'partial'
      : stateFilter === 'NON_COMPLIANT' ? 'nonCompliant'
        : riskFilter === 'High' ? 'highRisk'
          : noControl ? 'gaps' : null;
  const kpis = [
    { key: 'total', label: 'Total Obligations', value: stats?.total ?? 0, tone: 'blue', icon: <ScaleIcon /> },
    { key: 'compliant', label: 'Compliant', value: stats?.compliant ?? 0, tone: 'green', icon: <CheckCircleIcon /> },
    { key: 'partial', label: 'Partial', value: stats?.partial ?? 0, tone: 'amber', icon: <InformationCircleIcon /> },
    { key: 'nonCompliant', label: 'Non-compliant', value: stats?.nonCompliant ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'gaps', label: 'No Control', value: stats?.gaps ?? 0, tone: 'orange', icon: <ShieldCheckIcon /> },
  ].map((k) => ({ ...k, active: k.key === activeKpi }));

  const riskLevels = stats?.riskLevels?.length ? stats.riskLevels : ['Critical', 'High', 'Moderate', 'Low'];
  const opts = (list) => (list || []).map((v) => ({ value: v, label: v }));

  return (
    <Box>
      <PageHeader
        title="Obligations Register"
        subtitle={`${total} obligation${total !== 1 ? 's' : ''} — rate risk and track control gaps`}
        actions={(
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton>
            </Tooltip>
            {!readOnly && (
              <>
                <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setImportOpen(true)}>
                  Import
                </Button>
                <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={openCreate}>
                  New Obligation
                </Button>
              </>
            )}
          </>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <KpiCards items={kpis} onSelect={applyKpiFilter} columns={5} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search obligation, title or regulator...' }}
        filters={[
          { key: 'risk', label: 'Risk', value: riskFilter, onChange: (v) => { setRiskFilter(v); setPage(0); }, options: opts(riskLevels), allLabel: 'All', minWidth: 130 },
          { key: 'regulator', label: 'Regulator', value: regulatorFilter, onChange: (v) => { setRegulatorFilter(v); setPage(0); }, options: opts(stats?.regulators), allLabel: 'All', minWidth: 140 },
          { key: 'area', label: 'Domain', value: areaFilter, onChange: (v) => { setAreaFilter(v); setPage(0); }, options: opts(stats?.themes), allLabel: 'All', minWidth: 160 },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {heatmapDrill && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            color="primary"
            variant="outlined"
            label={`Risk heatmap (${heatmapDrill.riskView}): ${heatmapDrill.label}`}
            onDelete={clearHeatmapDrill}
          />
          <Typography variant="caption" color="text.secondary">
            Applicable obligations in the selected heatmap cell{heatmapDrill.cells.includes(';') ? 's' : ''}
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
        onRowClick={openDetail}
        rowKey={(item) => item.obligationId}
        emptyMessage="No obligations found."
        actions={(item) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {(item.activeFindingsCount ?? 0) > 0 ? (
              <Tooltip title={`${item.activeFindingsCount} finding${item.activeFindingsCount === 1 ? '' : 's'} on this obligation`}>
                <IconButton size="small"
                  onClick={() => navigate(`/findings?findingId=${item.latestActiveFindingId}`)}
                  sx={{ color: 'primary.main', bgcolor: '#EEF2FF', '&:hover': { bgcolor: '#E0E7FF' } }}>
                  <EyeIcon size={16} />
                </IconButton>
              </Tooltip>
            ) : (item.controlCount ?? 0) === 0 && (
              <Tooltip title="Raise gap finding (no control)">
                <IconButton size="small"
                  onClick={() => navigate(`/findings?raise=gap&obligationId=${item.obligationId}`)}
                  sx={{ color: 'error.main', bgcolor: '#FEF2F2', '&:hover': { bgcolor: '#FEE2E2' } }}>
                  <ExclamationCircleIcon size={16} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit obligation">
              <IconButton size="small" onClick={() => openEdit(item)}><PencilSquareIcon size={16} /></IconButton>
            </Tooltip>
            <Tooltip title="Delete obligation">
              <IconButton size="small" onClick={() => handleDelete(item)}>
                <TrashIcon size={16} />
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
