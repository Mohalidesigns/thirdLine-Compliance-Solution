import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, IconButton, Button, MenuItem,
} from '@mui/material';
import {
  Search, Refresh, Close, RequestQuote, EventRepeat, Groups, HelpOutline,
} from '@mui/icons-material';
import api from '../../../services/api';

const FREQUENCY_COLOR = {
  Daily: '#C53030',
  Weekly: '#DD6B20',
  Monthly: '#2B6CB0',
  Quarterly: '#2C7A7B',
  Biannual: '#6B46C1',
  Annual: '#2D7D46',
  Adhoc: '#718096',
  'Ad-hoc': '#718096',
  Event: '#805AD5',
};

const SECTION_CHIP_SX = {
  fontFamily: 'Roboto Mono, monospace',
  fontSize: '0.7rem',
  height: 22,
  borderRadius: '4px',
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
    { key: 'total', label: 'Total Returns', value: stats?.totalReturns ?? 0, color: '#DD6B20', icon: <RequestQuote sx={{ fontSize: 20 }} /> },
    { key: 'frequencies', label: 'Frequency Types', value: stats?.frequencyTypeCount ?? 0, color: '#2B6CB0', icon: <EventRepeat sx={{ fontSize: 20 }} /> },
    { key: 'units', label: 'Responsible Units', value: stats?.responsibleUnitCount ?? 0, color: '#2C7A7B', icon: <Groups sx={{ fontSize: 20 }} /> },
    { key: 'unassigned', label: 'Unassigned', value: stats?.unassignedCount ?? 0, color: '#805AD5', icon: <HelpOutline sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Return Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} regulatory return{total !== 1 ? 's' : ''} — filing obligations across the compliance universe
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { loadRows(); loadStats(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            sx={{ p: 2, borderLeft: `3px solid ${k.color}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
              <Box sx={{ color: k.color, opacity: 0.5 }}>{k.icon}</Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search returns..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <TextField select size="small" value={frequencyFilter}
          onChange={e => { setFrequencyFilter(e.target.value); setPage(0); }}
          label="Frequency type" sx={{ minWidth: 180 }}>
          <MenuItem value="All">All frequencies</MenuItem>
          {(stats?.frequencyTypes || []).map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={unitFilter}
          onChange={e => { setUnitFilter(e.target.value); setPage(0); }}
          label="Responsible unit" sx={{ minWidth: 220 }}>
          <MenuItem value="All">All units</MenuItem>
          {(stats?.responsibleUnits || []).map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <RequestQuote sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No returns found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
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
                    <TableCell sx={{ color: 'text.secondary' }}>{(page * rowsPerPage) + idx + 1}</TableCell>
                    <TableCell>
                      <Tooltip title={row.title || 'Untitled return'}>
                        <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 380,
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
                        <Chip size="small" label={row.frequencyType}
                          sx={{ height: 22, fontWeight: 700, fontSize: '0.65rem',
                            bgcolor: `${FREQUENCY_COLOR[row.frequencyType] || '#718096'}14`,
                            color: FREQUENCY_COLOR[row.frequencyType] || '#718096' }} />
                      )}
                      {row.frequency && (
                        <Chip size="small" variant="outlined" label={row.frequency}
                          sx={{ height: 22, fontSize: '0.65rem', ml: row.frequencyType ? 0.5 : 0, maxWidth: 160 }} />
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
                        ? <Chip size="small" label={row.actName}
                            sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600, maxWidth: 190,
                              bgcolor: '#EBF8FF', color: '#2B6CB0' }} />
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.responsibleUnit || 'Unassigned'}
                      </Typography>
                      {row.responsiblePerson && (
                        <Typography variant="caption" color="text.secondary">{row.responsiblePerson}</Typography>
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
