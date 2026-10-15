import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, CircularProgress, Alert, Tooltip,
  TableSortLabel, Button,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StateBadge,
  ArrowPathIcon, ScaleIcon, DocumentTextIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, CalendarDaysIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const COLUMNS = [
  { id: 'name', label: 'Act', minWidth: 300, sortField: 'name' },
  { id: 'regulatorName', label: 'Regulator', minWidth: 180, sortField: 'regulatorName' },
  { id: 'obligationCount', label: 'Obligations', minWidth: 100, sortField: 'obligationCount' },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 100, sortField: 'sanctionCount' },
  { id: 'returnCount', label: 'Returns', minWidth: 90, sortField: 'returnCount' },
];

export default function RegulationExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('desc');

  const hasFilters = search || regulatorFilter !== 'All';

  const loadStats = useCallback(async () => {
    try { setStats(await api.platform.acts.stats()); } catch { /* optional */ }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
      if (search) params.set('q', search);
      if (regulatorFilter !== 'All') params.set('regulatorId', regulatorFilter);
      const data = await api.platform.acts.list(params.toString());
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, regulatorFilter, sortField, sortDir]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadStats(); }, []);

  function clearFilters() {
    setSearch(''); setRegulatorFilter('All'); setPage(0);
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
    { key: 'total', label: 'Total Acts', value: stats?.totalActs ?? 0, tone: 'blue', icon: <ScaleIcon /> },
    { key: 'instruments', label: 'Instruments', value: stats?.totalInstruments ?? 0, tone: 'teal', icon: <DocumentTextIcon /> },
    { key: 'obligations', label: 'Obligations', value: stats?.totalObligations ?? 0, tone: 'purple', icon: <ClipboardDocumentListIcon /> },
    { key: 'sanctions', label: 'Sanctions', value: stats?.totalSanctions ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'returns', label: 'Returns', value: stats?.totalReturns ?? 0, tone: 'orange', icon: <CalendarDaysIcon /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Act Explorer"
        subtitle={`${total} act${total !== 1 ? 's' : ''} — browse the curated Nigerian compliance universe`}
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { loadRows(); loadStats(); }}>
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <KpiCards items={kpis} columns={5} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search acts...' }}
        filters={[
          {
            key: 'regulator', label: 'Regulator', value: regulatorFilter, allLabel: 'All regulators', minWidth: 200,
            onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: (stats?.regulators || []).map(r => ({ value: r, label: r })),
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
          <ScaleIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No acts found.</Typography>
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
                  <TableRow key={row.regulationId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_ACTS}/${row.regulationId}`)}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem' }}>{total - (page * rowsPerPage) - idx}</TableCell>
                    <TableCell>
                      <Tooltip title={row.name || 'Untitled act'}>
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 360,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </Typography>
                      </Tooltip>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <StateBadge value={row.status || 'Active'} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {row.instrumentCount ?? 0} instrument{(row.instrumentCount ?? 0) !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.regulatorName
                        ? <Typography variant="body2">{row.regulatorName}</Typography>
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>{row.obligationCount ?? 0}</TableCell>
                    <TableCell>{row.sanctionCount ?? 0}</TableCell>
                    <TableCell>{row.returnCount ?? 0}</TableCell>
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
