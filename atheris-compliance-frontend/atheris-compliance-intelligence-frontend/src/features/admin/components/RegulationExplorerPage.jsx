import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, CircularProgress, Alert, Chip, InputAdornment,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Search, ArrowUpward, ArrowDownward, UnfoldMore, AccountBalance } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const COLUMNS = [
  { key: 'name', label: 'Regulation', width: undefined },
  { key: 'regulatorName', label: 'Regulator', width: 220 },
  { key: 'status', label: 'Status', width: 110 },
  { key: 'instrumentCount', label: 'Instruments', width: 110 },
  { key: 'obligationCount', label: 'Obligations', width: 110 },
  { key: 'sanctionCount', label: 'Sanctions', width: 110 },
  { key: 'returnCount', label: 'Returns', width: 90 },
];

export default function RegulationExplorerPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('desc');
  const [regulatorId, setRegulatorId] = useState('');
  const [regulators, setRegulators] = useState([]);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' })
      .then((data) => setRegulators(data.content || data || []))
      .catch(() => {});
  }, []);

  function handleSort(key) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  }

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortBy},${sortDir}` });
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (regulatorId) params.set('regulatorId', regulatorId);
      const data = await api.platform.regulations.list(params.toString());
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, sortBy, sortDir, regulatorId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Regulation Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            Browse the curated Nigerian compliance universe — regulations with their instruments, obligations, and sanctions.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small" placeholder="Search regulations..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ color: '#718096', fontSize: 20 }} /></InputAdornment>,
            }}
            sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControl size="small" sx={{ width: 220 }}>
            <InputLabel id="reg-filter-label">Regulator</InputLabel>
            <Select
              labelId="reg-filter-label" label="Regulator"
              value={regulatorId} onChange={(e) => { setRegulatorId(e.target.value); setPage(0); }}
            >
              <MenuItem value="">All regulators</MenuItem>
              {regulators.map((r) => (
                <MenuItem key={r.regulatorId || r.id} value={r.regulatorId || r.id}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col.key}
                    sx={{
                      fontWeight: 700, color: '#4A5568', fontSize: '0.7rem',
                      textTransform: 'uppercase', letterSpacing: 1,
                      cursor: 'pointer', userSelect: 'none', width: col.width,
                      '&:hover': { color: '#1A365D' },
                    }}
                    onClick={() => handleSort(col.key)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {col.label}
                      {sortBy === col.key ? (
                        sortDir === 'asc' ? <ArrowUpward sx={{ fontSize: 14 }} /> : <ArrowDownward sx={{ fontSize: 14 }} />
                      ) : (
                        <UnfoldMore sx={{ fontSize: 14, color: '#CBD5E0' }} />
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={24} />
                </TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#A0AEC0', fontSize: '0.85rem' }}>
                  {search || regulatorId ? 'No regulations match your filters' : 'No regulations found'}
                </TableCell></TableRow>
              ) : rows.map((row, i) => (
                <TableRow
                  key={row.regulationId}
                  hover
                  sx={{ cursor: 'pointer', '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC' }}
                  onClick={() => navigate(`${ROUTES.ADMIN_REGULATIONS}/${row.regulationId}`)}
                >
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', maxWidth: 380 }}>
                    {row.name}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#4A5568' }}>
                    {row.regulatorName || <Typography component="span" sx={{ color: '#A0AEC0' }}>—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip label={row.status || 'Active'} size="small"
                      sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: row.status === 'Superseded' || row.status === 'Outdated' ? '#FED7D7' : '#E6FFFA', color: row.status === 'Superseded' || row.status === 'Outdated' ? '#C53030' : '#2C7A7B', borderRadius: 1 }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.instrumentCount ?? row.instruments ?? 0}</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.obligationCount ?? 0}</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.sanctionCount ?? 0}</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.returnCount ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Card>
    </Box>
  );
}