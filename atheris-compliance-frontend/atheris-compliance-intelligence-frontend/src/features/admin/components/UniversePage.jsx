import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, TextField, CircularProgress,
  Alert, Chip, InputAdornment, Select, MenuItem, FormControl, InputLabel, Divider,
} from '@mui/material';
import { Search, Public, Description } from '@mui/icons-material';
import api from '../../../services/api';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const riskColors = { High: '#C53030', Medium: '#DD6B20', Low: '#2D7D46' };

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatCard({ icon, label, value, color, sub }) {
  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ color }}>{icon}</Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          {sub && <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '0.62rem' }}>{sub}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function UniversePage() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ regulatorId: '', areaOfFocus: '', riskRating: '', nature: '', status: '' });
  const [regulators, setRegulators] = useState([]);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' })
      .then((data) => setRegulators(data.content || data || []))
      .catch(() => {});
    api.platform.universe.stats()
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: 'instrumentId,desc' });
      if (debouncedSearch) params.set('q', debouncedSearch);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const data = await api.platform.universe.instruments(params.toString());
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const byTop = stats ? Object.entries(stats.byRegulator || {}).sort((a, b) => b[1] - a[1]).slice(0, 6) : [];
  const areas = stats ? Object.entries(stats.byAreaOfFocus || {}).sort((a, b) => b[1] - a[1]) : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Compliance Universe</Typography>
          <Typography variant="body2" color="text.secondary">
            The curated Nigerian regulatory universe seeded from the compliance toolkits.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <StatCard label="Total Instruments" value={stats.total} color="#1A365D" icon={<Public sx={{ fontSize: 28 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard label="High Risk" value={stats.byRiskRating?.High ?? 0} color="#C53030" icon={<Description sx={{ fontSize: 28 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard label="Medium Risk" value={stats.byRiskRating?.Medium ?? 0} color="#DD6B20" icon={<Description sx={{ fontSize: 28 }} />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard label="Low Risk" value={stats.byRiskRating?.Low ?? 0} color="#2D7D46" icon={<Description sx={{ fontSize: 28 }} />} />
          </Grid>
        </Grid>
      )}

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={5}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Top Regulators</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                  {byTop.map(([name, count]) => (
                    <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.74rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4A5568' }}>{name}</Typography>
                      <Box sx={{ flex: 0.6, bgcolor: '#EDF2F7', borderRadius: 1, height: 6 }}>
                        <Box sx={{ width: `${Math.max(6, (count / (stats.total || 1)) * 100)}%`, bgcolor: '#1A365D', borderRadius: 1, height: 6 }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, width: 36, textAlign: 'right' }}>{count}</Typography>
                    </Box>
                  ))}
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Nature Mix</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                  {Object.entries(stats.byNature || {}).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
                    <Chip key={n} label={`${n}: ${c}`} size="small" sx={{ fontSize: '0.62rem', fontWeight: 700, bgcolor: '#F7FAFC', borderRadius: 1 }} />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Areas of Focus</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                  {areas.map(([name, count]) => (
                    <Chip
                      key={name} label={`${name} (${count})`} size="small"
                      clickable
                      onClick={() => setFilters((f) => ({ ...f, areaOfFocus: f.areaOfFocus === name ? '' : name }))}
                      sx={{
                        fontSize: '0.64rem', fontWeight: 700, borderRadius: 1,
                        bgcolor: filters.areaOfFocus === name ? '#1A365D' : '#F7FAFC',
                        color: filters.areaOfFocus === name ? '#fff' : '#4A5568',
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search instruments..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#718096', fontSize: 20 }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel id="u-reg-label">Regulator</InputLabel>
          <Select labelId="u-reg-label" label="Regulator" value={filters.regulatorId}
            onChange={(e) => { setFilters({ ...filters, regulatorId: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            {regulators.map((r) => (
              <MenuItem key={r.regulatorId || r.id} value={r.regulatorId || r.id}>{r.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: 130 }}>
          <InputLabel id="u-risk-label">Risk</InputLabel>
          <Select labelId="u-risk-label" label="Risk" value={filters.riskRating}
            onChange={(e) => { setFilters({ ...filters, riskRating: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: 150 }}>
          <InputLabel id="u-nature-label">Nature</InputLabel>
          <Select labelId="u-nature-label" label="Nature" value={filters.nature}
            onChange={(e) => { setFilters({ ...filters, nature: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Core">Core</MenuItem>
            <MenuItem value="Secondary">Secondary</MenuItem>
            <MenuItem value="Topical/Pertinent">Topical/Pertinent</MenuItem>
            <MenuItem value="Guidance">Guidance</MenuItem>
            <MenuItem value="Others">Others</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: 140 }}>
          <InputLabel id="u-status-label">Status</InputLabel>
          <Select labelId="u-status-label" label="Status" value={filters.status}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Published">Published</MenuItem>
            <MenuItem value="Superseded">Superseded</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 180 }}>Regulator</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 160 }}>Area of Focus</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 80 }}>Risk</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 90 }}>Issued</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 100 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#A0AEC0', fontSize: '0.85rem' }}>
                  {search || Object.values(filters).some(Boolean) ? 'No instruments match your filters' : 'No instruments found'}
                </TableCell></TableRow>
              ) : rows.map((row, i) => (
                <TableRow key={row.instrumentId} hover sx={{ '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC' }}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sourceTitle}</Typography>
                    {row.regulatoryItemType && <Typography variant="caption" sx={{ color: '#A0AEC0', fontSize: '0.62rem', textTransform: 'uppercase' }}>{row.regulatoryItemType}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: '#4A5568' }}>{row.regulatorName || '—'}</TableCell>
                  <TableCell>{row.areaOfFocus ? <Chip label={row.areaOfFocus} size="small" sx={{ fontSize: '0.62rem', fontWeight: 600, bgcolor: '#EBF8FF', color: '#2B6CB0', borderRadius: 1 }} /> : '—'}</TableCell>
                  <TableCell>{row.riskRating ? <Typography variant="caption" sx={{ fontWeight: 700, color: riskColors[row.riskRating] }}>{row.riskRating}</Typography> : '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.72rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(row.dateIssued)}</TableCell>
                  <TableCell>
                    <Chip label={row.status || '—'} size="small" sx={{ fontSize: '0.62rem', fontWeight: 700, bgcolor: row.status === 'Superseded' ? '#FED7D7' : '#E6F4EA', color: row.status === 'Superseded' ? '#C53030' : '#2D7D46', borderRadius: 1 }} />
                  </TableCell>
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