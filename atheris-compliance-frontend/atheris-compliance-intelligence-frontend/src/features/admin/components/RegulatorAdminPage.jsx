import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Checkbox, Chip, Button, CircularProgress, Alert, TextField, MenuItem,
  Tooltip, TableContainer, Paper, TablePagination,
} from '@mui/material';
import { Search, Close, Block } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const COLUMNS = [
  { id: 'name', label: 'Name', minWidth: 260 },
  { id: 'abbreviation', label: 'Abbreviation', minWidth: 110 },
  { id: 'instrumentCount', label: 'Discovered', minWidth: 90 },
  { id: 'downloaded', label: 'Downloaded', minWidth: 90 },
  { id: 'failed', label: 'Failed', minWidth: 70 },
  { id: 'lastInstrumentDiscoveredAt', label: 'Last Document', minWidth: 140 },
];

function formatDt(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function fetchRegulators(search, statusFilter) {
  const params = { activeOnly: false };
  if (search) params.search = search;
  const data = await api.platform.regulators.list(params);
  return Array.isArray(data) ? data : (data.content || []);
}

export default function RegulatorAdminPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [selected, setSelected] = useState(new Set());
  const [bulking, setBulking] = useState(false);

  const { data: regulators, isLoading, error, refetch } = useQuery({
    queryKey: ['regulators', search, statusFilter],
    queryFn: () => fetchRegulators(search, statusFilter),
    staleTime: 30000,
  });

  const filtered = useMemo(() => {
    if (!regulators) return [];
    return regulators.filter(r => {
      if (statusFilter !== 'All') {
        const active = statusFilter === 'Active';
        if (r.isActive !== active) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!(r.name || '').toLowerCase().includes(q) && !(r.abbreviation || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [regulators, statusFilter, search]);

  function handleToggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkDisable() {
    setBulking(true);
    try {
      await api.platform.regulators.bulkDisable([...selected]);
      setSelected(new Set());
      refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulking(false);
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Regulators</Typography>
          <Typography variant="body2" color="text.secondary">
            Browse all platform regulators
          </Typography>
        </Box>
        {selected.size > 0 && (
          <Button variant="contained" color="warning" startIcon={<Block />}
            onClick={handleBulkDisable} disabled={bulking}>
            {bulking ? 'Disabling...' : `Disable ${selected.size}`}
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search name or abbreviation..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 220 }} />
        <TextField select size="small" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 110 }}>
          {['All', 'Active', 'Disabled'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {(search || statusFilter !== 'All') && (
          <Button size="small" startIcon={<Close />} onClick={() => { setSearch(''); setStatusFilter('All'); }}>Clear</Button>
        )}
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Typography variant="body1">No regulators found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40, padding: 0, fontWeight: 700, bgcolor: '#F7FAFC' }}>
                    <Checkbox size="small"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      indeterminate={selected.size > 0 && selected.size < filtered.length}
                      onChange={() => {
                        if (selected.size === filtered.length) {
                          setSelected(new Set());
                        } else {
                          setSelected(new Set(filtered.map(r => r.regulatorId)));
                        }
                      }} />
                  </TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((reg, i) => (
                  <TableRow key={reg.regulatorId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_REGULATORS}/${reg.regulatorId}`)}
                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC',
                      borderLeft: !reg.isActive ? '3px solid #C53030' : '3px solid transparent',
                    }}>
                    <TableCell sx={{ padding: 0 }} onClick={e => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(reg.regulatorId)}
                        onChange={() => handleToggleSelect(reg.regulatorId)} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={reg.name}>
                        <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {reg.name}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip label={reg.abbreviation} size="small"
                        sx={{ fontWeight: 700, bgcolor: '#1A365D', color: '#fff', fontSize: '0.7rem', borderRadius: 1 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{(reg.instrumentCount ?? 0) + (reg.pendingDownloadCount ?? 0)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2D7D46' }}>{reg.instrumentCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      {(reg.pendingDownloadCount ?? 0) > 0 ? (
                        <Chip label={reg.pendingDownloadCount} size="small" sx={{ fontWeight: 700, bgcolor: '#FED7D7', color: '#C53030', fontSize: '0.7rem', borderRadius: 1 }} />
                      ) : (
                        <Typography variant="body2" sx={{ color: '#A0AEC0' }}>0</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#718096' }}>
                      <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#718096' }}>
                        {formatDt(reg.lastInstrumentDiscoveredAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        </Paper>
      )}
    </Box>
  );
}
