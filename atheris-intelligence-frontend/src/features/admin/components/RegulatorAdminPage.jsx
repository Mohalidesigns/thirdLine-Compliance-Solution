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
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RegulatorAdminPage() {
  const navigate = useNavigate();
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [nameFilter, setNameFilter] = useState('');
  const [abbrFilter, setAbbrFilter] = useState('');
  const [minDocs, setMinDocs] = useState('');
  const [maxDocs, setMaxDocs] = useState('');
  const [lastDocFrom, setLastDocFrom] = useState('');
  const [lastDocTo, setLastDocTo] = useState('');

  const debouncedName = useDebounce(nameFilter, 300);
  const debouncedAbbr = useDebounce(abbrFilter, 300);
  const debouncedMinDocs = useDebounce(minDocs, 300);
  const debouncedMaxDocs = useDebounce(maxDocs, 300);
  const debouncedFrom = useDebounce(lastDocFrom, 300);
  const debouncedTo = useDebounce(lastDocTo, 300);

  const fetchRegulators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (debouncedName) params.name = debouncedName;
      if (debouncedAbbr) params.abbreviation = debouncedAbbr;
      if (debouncedMinDocs) params.minDocs = parseInt(debouncedMinDocs, 10);
      if (debouncedMaxDocs) params.maxDocs = parseInt(debouncedMaxDocs, 10);
      if (debouncedFrom) params.lastDocFrom = new Date(debouncedFrom).toISOString();
      if (debouncedTo) params.lastDocTo = new Date(debouncedTo).toISOString();
      params.activeOnly = true;
      const data = await api.platform.regulators.list(params);
      setRegulators(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedName, debouncedAbbr, debouncedMinDocs, debouncedMaxDocs, debouncedFrom, debouncedTo]);

  useEffect(() => {
    fetchRegulators();
  }, [fetchRegulators]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Regulators</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, pb: 0.5 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, pb: 0.5, width: 130 }}>Abbreviation</TableCell>
                <TableCell sx={{ fontWeight: 700, pb: 0.5, width: 120 }}>Documents</TableCell>
                <TableCell sx={{ fontWeight: 700, pb: 0.5, width: 200 }}>Last Document</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pt: 0.5, borderTop: 'none' }}>
                  <TextField
                    size="small" placeholder="Search name..." value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)} fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: '#718096' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                  />
                </TableCell>
                <TableCell sx={{ pt: 0.5, borderTop: 'none' }}>
                  <TextField
                    size="small" placeholder="Filter..." value={abbrFilter}
                    onChange={(e) => setAbbrFilter(e.target.value)} fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                  />
                </TableCell>
                <TableCell sx={{ pt: 0.5, borderTop: 'none' }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <TextField size="small" placeholder="Min" value={minDocs}
                      onChange={(e) => setMinDocs(e.target.value)} type="number"
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' }, width: '50%' }} />
                    <TextField size="small" placeholder="Max" value={maxDocs}
                      onChange={(e) => setMaxDocs(e.target.value)} type="number"
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' }, width: '50%' }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ pt: 0.5, borderTop: 'none' }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <TextField size="small" type="date" value={lastDocFrom}
                      onChange={(e) => setLastDocFrom(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }} />
                    <TextField size="small" type="date" value={lastDocTo}
                      onChange={(e) => setLastDocTo(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }} />
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell></TableRow>
              ) : regulators.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: '#718096' }}>
                  No regulators found
                </TableCell></TableRow>
              ) : regulators.map((reg) => (
                <TableRow
                  key={reg.regulatorId} hover sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`${ROUTES.ADMIN_REGULATORS}/${reg.regulatorId}`)}
                >
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{reg.name}</TableCell>
                  <TableCell>
                    <Chip label={reg.abbreviation} size="small"
                      sx={{ fontWeight: 700, bgcolor: '#1A365D', color: '#fff', fontSize: '0.7rem' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{reg.instrumentCount ?? '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: '#718096' }}>
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
