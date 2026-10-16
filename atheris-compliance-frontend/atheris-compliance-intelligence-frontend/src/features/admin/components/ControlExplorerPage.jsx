import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Box, Typography, Tooltip, IconButton, Alert } from '@mui/material';
import { Refresh, FactCheck, Warning, TaskAlt, Category } from '@mui/icons-material';
import { KpiCards, FilterBar, SectionTable } from 'shared';
import api from '../../../services/api';

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

function countOf(map, key) {
  if (!map) return 0;
  return Object.entries(map)
    .filter(([k]) => k.toLowerCase() === key.toLowerCase())
    .reduce((sum, [, v]) => sum + (v || 0), 0);
}

// Control shows the statement (first cleaned point) only — never the internal control code.
const COLUMNS = [
  { id: 'controlSummary', label: 'Control', minWidth: 340,
    render: (r) => {
      const points = Array.isArray(r.controlPoints) ? r.controlPoints : [];
      const text = points[0] || r.controlSummary || '—';
      const cell = <Typography variant="body2" sx={ellipsis(400)}>{text}</Typography>;
      if (points.length <= 1) return cell;
      return (
        <Tooltip
          arrow
          placement="top-start"
          slotProps={{ tooltip: { sx: { maxWidth: 520, p: 1.25 } } }}
          title={
            <Box component="ol" sx={{ m: 0, pl: 2.25 }}>
              {points.map((p, i) => (
                <Box component="li" key={i} sx={{ mb: 0.25, fontSize: '0.78rem', lineHeight: 1.5 }}>{p}</Box>
              ))}
            </Box>
          }
        >
          {cell}
        </Tooltip>
      );
    } },
  { id: 'responsibleOfficer', label: 'Owner', minWidth: 150, sortable: true, sortField: 'responsibleOfficer',
    render: (r) => (r.responsibleOfficer
      ? <Tooltip title={r.responsibleOfficer}><Typography variant="body2" sx={ellipsis(150)}>{r.responsibleOfficer}</Typography></Tooltip>
      : <Typography variant="body2" color="text.secondary">Unassigned</Typography>) },
  { id: 'responsibleOfficer', label: 'Owner', minWidth: 150, sortable: true, sortField: 'responsibleOfficer',
    render: (r) => (r.responsibleOfficer
      ? <Tooltip title={r.responsibleOfficer}><Typography variant="body2" sx={ellipsis(150)}>{r.responsibleOfficer}</Typography></Tooltip>
      : <Typography variant="body2" color="text.secondary">Unassigned</Typography>) },
  // Full theme name only (never the compliance-area abbreviation).
  { id: 'theme', label: 'Theme / Area', minWidth: 200, sortable: true, sortField: 'theme',
    render: (r) => <Typography variant="body2" sx={ellipsis(220)}>{r.theme || '—'}</Typography> },
  { id: 'frequency', label: 'Test Frequency', minWidth: 150, sortable: true, sortField: 'frequency',
    render: (r) => (r.frequency
      ? <Typography variant="body2">{r.frequency}</Typography>
      : <Typography variant="body2" color="text.secondary">Not set</Typography>) },
  // Plain text — no chip / border.
  { id: 'actName', label: 'Act', minWidth: 220, sortable: true, sortField: 'actName',
    render: (r) => <Typography variant="body2" sx={ellipsis(240)}>{r.actName || '—'}</Typography> },
];

export default function ControlExplorerPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const hasFilters = !!search || themeFilter !== 'All' || riskFilter !== 'All' || statusFilter !== 'All';

  const statsQuery = useQuery({
    queryKey: ['controls', 'stats'],
    queryFn: () => api.platform.controls.stats(),
  });
  const stats = statsQuery.data;

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (themeFilter !== 'All') params.theme = themeFilter;
  if (riskFilter !== 'All') params.riskLevel = riskFilter;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['controls', 'list', params],
    queryFn: ({ signal }) => api.platform.controls.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const rows = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements ?? 0;

  function clearFilters() {
    setSearch(''); setThemeFilter('All'); setRiskFilter('All'); setStatusFilter('All'); setPage(0);
  }

  function handleSort(field) {
    if (!field) return;
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  const kpiItems = [
    { key: 'total', label: 'Total Controls', color: '#2B6CB0', icon: <FactCheck sx={{ fontSize: 20 }} />,
      value: stats?.totalControls ?? 0, breakdown: stats?.byStatus },
    { key: 'high', label: 'High / Critical Risk', color: '#E53E3E', icon: <Warning sx={{ fontSize: 20 }} />,
      value: countOf(stats?.byRiskLevel, 'High') + countOf(stats?.byRiskLevel, 'Critical'), breakdown: stats?.byRiskLevel },
    { key: 'open', label: 'Open', color: '#DD6B20', icon: <Warning sx={{ fontSize: 20 }} />,
      value: countOf(stats?.byStatus, 'Open'), breakdown: stats?.byStatus },
    { key: 'closed', label: 'Closed', color: '#2C7A7B', icon: <TaskAlt sx={{ fontSize: 20 }} />,
      value: countOf(stats?.byStatus, 'Closed'), breakdown: stats?.byStatus },
    { key: 'themes', label: 'Themes', color: '#805AD5', icon: <Category sx={{ fontSize: 20 }} />,
      value: (stats?.themes || []).length, breakdown: stats?.byTheme },
  ];

  const onKpiSelect = (key) => {
    setPage(0);
    if (key === 'high') { setRiskFilter('High'); setStatusFilter('All'); }
    else if (key === 'open') { setStatusFilter('Open'); setRiskFilter('All'); }
    else if (key === 'closed') { setStatusFilter('Closed'); setRiskFilter('All'); }
    else clearFilters();
  };

  const onKpiDrill = (key, label) => {
    setPage(0);
    if (key === 'high') setRiskFilter(label);
    else if (key === 'total' || key === 'open' || key === 'closed') setStatusFilter(label);
    else if (key === 'themes') setThemeFilter(label);
  };

  const toOptions = (values) => (values || []).map((v) => ({ value: v, label: v }));
  const filters = [
    { key: 'theme', label: 'Theme', value: themeFilter, onChange: (v) => { setThemeFilter(v); setPage(0); },
      allLabel: 'All themes', options: toOptions(stats?.themes), minWidth: 190 },
    { key: 'riskLevel', label: 'Risk level', value: riskFilter, onChange: (v) => { setRiskFilter(v); setPage(0); },
      allLabel: 'All risk levels', options: toOptions(stats?.riskLevels), minWidth: 160 },
    { key: 'status', label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0); },
      allLabel: 'All statuses', options: toOptions(stats?.statuses), minWidth: 150 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Control Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} compliance control{total !== 1 ? 's' : ''} — monitoring activities across the regulatory universe
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {listQuery.error && <Alert severity="error" sx={{ mb: 2 }}>{listQuery.error.message}</Alert>}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} onDrill={onKpiDrill} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search controls...', minWidth: 240 }}
        filters={filters}
        showClear={hasFilters}
        onClear={clearFilters}
      />

      <SectionTable
        columns={COLUMNS}
        rows={rows}
        total={total}
        page={page}
        size={rowsPerPage}
        loading={listQuery.isLoading}
        error={null}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onPage={setPage}
        onSize={(s) => { setRowsPerPage(s); setPage(0); }}
        onRowClick={(r) => navigate(`/admin/controls/${r.complianceControlId}`)}
        rowKey={(r) => r.complianceControlId}
        emptyMessage="No controls found."
      />
    </Box>
  );
}
