import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, CircularProgress, Alert, Chip, InputAdornment,
} from '@mui/material';
import { Search } from '@mui/icons-material';
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

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RegulatorAdminPage() {
  const navigate = useNavigate();
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const fetchRegulators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { activeOnly: true };
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await api.platform.regulators.list(params);
      setRegulators(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchRegulators();
  }, [fetchRegulators]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Regulators</Typography>
        <TextField
          size="small" placeholder="Search by name or abbreviation..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: '#718096', fontSize: 20 }} /></InputAdornment>,
          }}
          sx={{ width: 320, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 130 }}>Abbreviation</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 120 }}>Documents</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 160 }}>Last Document</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={24} />
                </TableCell></TableRow>
              ) : regulators.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6, color: '#A0AEC0', fontSize: '0.85rem' }}>
                  {search ? 'No regulators match your search' : 'No regulators found'}
                </TableCell></TableRow>
              ) : regulators.map((reg, i) => (
                <TableRow
                  key={reg.regulatorId}
                  hover
                  sx={{ cursor: 'pointer', '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC' }}
                  onClick={() => navigate(`${ROUTES.ADMIN_REGULATORS}/${reg.regulatorId}`)}
                >
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{reg.name}</TableCell>
                  <TableCell>
                    <Chip label={reg.abbreviation} size="small"
                      sx={{ fontWeight: 700, bgcolor: '#1A365D', color: '#fff', fontSize: '0.7rem', borderRadius: 1 }} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{reg.instrumentCount ?? 0}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#718096' }}>
                    {formatDt(reg.lastInstrumentDiscoveredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
