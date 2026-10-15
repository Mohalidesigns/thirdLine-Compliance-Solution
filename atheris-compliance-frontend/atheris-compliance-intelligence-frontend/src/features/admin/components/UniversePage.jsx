import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Table, TableBody, TableCell, Paper,
  TableContainer, TableHead, TableRow, TablePagination, CircularProgress,
  Alert, Chip, Select, MenuItem, Divider,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, FilterField, DataCard, RiskBadge, StateBadge, TL,
  GlobeAltIcon, ExclamationTriangleIcon, ExclamationCircleIcon, CheckCircleIcon,
} from 'shared';
import api from '../../../services/api';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
      <PageHeader
        title="Compliance Universe"
        subtitle="The curated Nigerian regulatory universe seeded from the compliance toolkits."
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {stats && (
        <KpiCards
          columns={4}
          items={[
            { key: 'total', label: 'Total Instruments', value: stats.total, tone: 'blue', icon: <GlobeAltIcon /> },
            { key: 'high', label: 'High Risk', value: stats.byRiskRating?.High ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
            { key: 'medium', label: 'Medium Risk', value: stats.byRiskRating?.Medium ?? 0, tone: 'amber', icon: <ExclamationCircleIcon /> },
            { key: 'low', label: 'Low Risk', value: stats.byRiskRating?.Low ?? 0, tone: 'green', icon: <CheckCircleIcon /> },
          ]}
        />
      )}

      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <DataCard title="Top Regulators" sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {byTop.map(([name, count]) => (
                    <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.8125rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TL.gray700 }}>{name}</Typography>
                      <Box sx={{ flex: 0.6, bgcolor: TL.gray100, borderRadius: 9999, height: 6 }}>
                        <Box sx={{ width: `${Math.max(6, (count / (stats.total || 1)) * 100)}%`, bgcolor: TL.primary, borderRadius: 9999, height: 6 }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, width: 36, textAlign: 'right', color: TL.gray700 }}>{count}</Typography>
                    </Box>
                  ))}
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>Nature Mix</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {Object.entries(stats.byNature || {}).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
                    <Chip key={n} label={`${n}: ${c}`} size="small" />
                  ))}
                </Box>
            </DataCard>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <DataCard title="Areas of Focus" subtitle="Click an area to filter the table" sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {areas.map(([name, count]) => (
                    <Chip
                      key={name} label={`${name} (${count})`} size="small"
                      clickable
                      onClick={() => setFilters((f) => ({ ...f, areaOfFocus: f.areaOfFocus === name ? '' : name }))}
                      color={filters.areaOfFocus === name ? 'primary' : 'default'}
                    />
                  ))}
                </Box>
            </DataCard>
          </Grid>
        </Grid>
      )}

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search instruments...', minWidth: 220 }}
      >
        <FilterField label="Regulator" minWidth={200}>
          <Select size="small" displayEmpty value={filters.regulatorId} sx={{ height: 40 }}
            onChange={(e) => { setFilters({ ...filters, regulatorId: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            {regulators.map((r) => (
              <MenuItem key={r.regulatorId || r.id} value={r.regulatorId || r.id}>{r.name}</MenuItem>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Risk" minWidth={130}>
          <Select size="small" displayEmpty value={filters.riskRating} sx={{ height: 40 }}
            onChange={(e) => { setFilters({ ...filters, riskRating: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </Select>
        </FilterField>
        <FilterField label="Nature" minWidth={150}>
          <Select size="small" displayEmpty value={filters.nature} sx={{ height: 40 }}
            onChange={(e) => { setFilters({ ...filters, nature: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Core">Core</MenuItem>
            <MenuItem value="Secondary">Secondary</MenuItem>
            <MenuItem value="Topical/Pertinent">Topical/Pertinent</MenuItem>
            <MenuItem value="Guidance">Guidance</MenuItem>
            <MenuItem value="Others">Others</MenuItem>
          </Select>
        </FilterField>
        <FilterField label="Status" minWidth={140}>
          <Select size="small" displayEmpty value={filters.status} sx={{ height: 40 }}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Published">Published</MenuItem>
            <MenuItem value="Superseded">Superseded</MenuItem>
          </Select>
        </FilterField>
      </FilterBar>

      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell sx={{ width: 180 }}>Regulator</TableCell>
                <TableCell sx={{ width: 180 }}>Area of Focus</TableCell>
                <TableCell sx={{ width: 110 }}>Risk</TableCell>
                <TableCell sx={{ width: 120 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {search || Object.values(filters).some(Boolean) ? 'No instruments match your filters' : 'No instruments found'}
                </TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.instrumentId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sourceTitle}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                      {[row.regulatoryItemType, `Issued ${formatDt(row.dateIssued)}`].filter(Boolean).join(' · ')}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.regulatorName || '—'}</TableCell>
                  <TableCell>{row.areaOfFocus ? <Chip label={row.areaOfFocus} size="small" /> : '—'}</TableCell>
                  <TableCell>{row.riskRating ? <RiskBadge value={row.riskRating} /> : '—'}</TableCell>
                  <TableCell>
                    <StateBadge value={row.status} emptyLabel="—" />
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
      </Paper>
    </Box>
  );
}