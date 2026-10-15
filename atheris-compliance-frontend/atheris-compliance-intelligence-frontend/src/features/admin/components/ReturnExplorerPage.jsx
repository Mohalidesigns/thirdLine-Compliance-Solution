import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, Button,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StatusBadge,
  ArrowPathIcon, DocumentTextIcon, CalendarDaysIcon, UserGroupIcon, ExclamationCircleIcon,
} from 'shared';
import api from '../../../services/api';

const FREQUENCY_TONE = {
  Daily: 'red',
  Weekly: 'orange',
  Monthly: 'blue',
  Quarterly: 'teal',
  Biannual: 'purple',
  Annual: 'green',
  Adhoc: 'gray',
  'Ad-hoc': 'gray',
  Event: 'purple',
};

const SECTION_CHIP_SX = {
  fontFamily: 'Roboto Mono, monospace',
  fontSize: '0.7rem',
};

const COLUMNS = [
  { id: 'title', label: 'Return', minWidth: 320, sortField: 'title' },
  { id: 'frequency', label: 'Frequency', minWidth: 190, sortField: 'frequencyType' },
  { id: 'deadline', label: 'Deadline', minWidth: 200, sortField: 'deadline' },
  { id: 'actName', label: 'Act', minWidth: 200, sortField: 'actId' },
  { id: 'responsible', label: 'Responsible', minWidth: 200, sortField: 'responsibleUnit' },
];

export default function ReturnExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('All');
  const [unitFilter, setUnitFilter] = useState('All');
  const [sortField, setSortField] = useState('title');
  const [sortDir, setSortDir] = useState('asc');

  const hasFilters = search || frequencyFilter !== 'All' || unitFilter !== 'All';

  const loadStats = useCallback(async (isActive = () => true) => {
    try {
      const data = await api.platform.returns.stats();
      if (isActive()) setStats(data);
    } catch { /* optional */ }
  }, []);

  const loadRows = useCallback(async (isActive = () => true) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
      if (search) params.set('q', search);
      if (frequencyFilter !== 'All') params.set('frequencyType', frequencyFilter);
      if (unitFilter !== 'All') params.set('responsibleUnit', unitFilter);
      const data = await api.platform.returns.list(params.toString());
      if (!isActive()) return;
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      if (isActive()) setError(err.message);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [page, rowsPerPage, search, frequencyFilter, unitFilter, sortField, sortDir]);

  useEffect(() => {
    let active = true;
    loadRows(() => active);
    return () => { active = false; };
  }, [loadRows]);

  useEffect(() => {
    let active = true;
    loadStats(() => active);
    return () => { active = false; };
  }, [loadStats]);

  function clearFilters() {
    setSearch(''); setFrequencyFilter('All'); setUnitFilter('All'); setPage(0);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }

  const kpis = [
    { key: 'total', label: 'Total Returns', value: stats?.totalReturns ?? 0, tone: 'blue', icon: <DocumentTextIcon /> },
    { key: 'frequencies', label: 'Frequency Types', value: stats?.frequencyTypeCount ?? 0, tone: 'teal', icon: <CalendarDaysIcon /> },
    { key: 'units', label: 'Responsible Units', value: stats?.responsibleUnitCount ?? 0, tone: 'purple', icon: <UserGroupIcon /> },
    { key: 'unassigned', label: 'Unassigned', value: stats?.unassignedCount ?? 0, tone: 'orange', icon: <ExclamationCircleIcon /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Return Explorer"
        subtitle={`${total} regulatory return${total !== 1 ? 's' : ''} — filing obligations across the compliance universe`}
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { loadRows(); loadStats(); }}>
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <KpiCards items={kpis} columns={4} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search returns...' }}
        filters={[
          {
            key: 'frequency', label: 'Frequency type', value: frequencyFilter, allLabel: 'All frequencies',
            onChange: (v) => { setFrequencyFilter(v); setPage(0); },
            options: (stats?.frequencyTypes || []).map(f => ({ value: f, label: f })),
          },
          {
            key: 'unit', label: 'Responsible unit', value: unitFilter, allLabel: 'All units', minWidth: 220,
            onChange: (v) => { setUnitFilter(v); setPage(0); },
            options: (stats?.responsibleUnits || []).map(u => ({ value: u, label: u })),
          },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <DocumentTextIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No returns found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth,
                      cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={c.sortField ? () => handleSort(c.sortField) : undefined}>
                      {c.sortField
                        ? <TableSortLabel active={sortField === c.sortField} direction={sortField === c.sortField ? sortDir : 'asc'}
                            sx={{ '& .MuiTableSortLabel-icon': { opacity: sortField === c.sortField ? 1 : 0.4 } }}>
                            {c.label}
                          </TableSortLabel>
                        : c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.returnId} hover
                    onClick={() => navigate(`/admin/returns/${row.returnId}`)}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem' }}>{(page * rowsPerPage) + idx + 1}</TableCell>
                    <TableCell>
                      <Tooltip title={row.title || 'Untitled return'}>
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 380,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.title}
                        </Typography>
                      </Tooltip>
                      {row.sectionReference && (
                        <Chip size="small" variant="outlined" label={row.sectionReference}
                          sx={{ ...SECTION_CHIP_SX, mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {row.frequencyType && (
                        <StatusBadge label={row.frequencyType} tone={FREQUENCY_TONE[row.frequencyType] || 'gray'} />
                      )}
                      {row.frequency && (
                        <Chip size="small" variant="outlined" label={row.frequency}
                          sx={{ ml: row.frequencyType ? 0.5 : 0, maxWidth: 160 }} />
                      )}
                      {!row.frequencyType && !row.frequency && (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.deadline
                        ? <Tooltip title={row.deadline}>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.deadline}
                            </Typography>
                          </Tooltip>
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>
                      {row.actName
                        ? <Chip size="small" label={row.actName} sx={{ maxWidth: 190 }} />
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {row.responsibleUnit || 'Unassigned'}
                      </Typography>
                      {row.responsiblePerson && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>{row.responsiblePerson}</Typography>
                      )}
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
    </Box>
  );
}
