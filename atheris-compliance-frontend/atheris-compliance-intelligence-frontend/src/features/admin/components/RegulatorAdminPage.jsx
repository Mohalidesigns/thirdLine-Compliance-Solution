import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Checkbox, Chip, Button, CircularProgress, Alert, TextField, MenuItem,
  Tooltip, TableContainer, Paper, TablePagination, IconButton, Menu,
} from '@mui/material';
import { Search, Close, Block, ArrowDropDown, AccountBalance, LibraryBooks, Gavel, RequestQuote } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const COLUMNS = [
  { id: 'name', label: 'Regulator', minWidth: 300 },
  { id: 'abbreviation', label: 'Abbrev', minWidth: 100 },
  { id: 'instruments', label: 'Instruments', minWidth: 110 },
  { id: 'obligations', label: 'Obligations', minWidth: 110 },
  { id: 'returns', label: 'Returns', minWidth: 100 },
];

function KpiCard({ label, value, color, icon, breakdown, onSelect, onDrill }) {
  const [anchor, setAnchor] = useState(null);
  const entries = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Paper elevation={0} variant="outlined" onClick={onSelect}
      sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${color}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ color, opacity: 0.55, display: 'flex' }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
        </Box>
        {entries.length > 0 && (
          <IconButton size="small" aria-label={`${label} breakdown`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
            <ArrowDropDown fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color }}>{value}</Typography>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={(e) => e.stopPropagation()}>
        {entries.map(([name, count]) => (
          <MenuItem key={name} dense onClick={() => { setAnchor(null); onDrill(name); }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, width: '100%' }}>
              <span>{name}</span>
              <span style={{ color: '#718096' }}>{count}</span>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}

async function fetchRegulators(search) {
  const params = { activeOnly: false, sortBy: 'name', sortDir: 'asc' };
  if (search) params.search = search;
  const data = await api.platform.regulators.list(params);
  return Array.isArray(data) ? data : (data.content || []);
}

export default function RegulatorAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [scraperFilter, setScraperFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selected, setSelected] = useState(new Set());
  const [bulking, setBulking] = useState(false);

  const { data: regulators, isLoading, error, refetch } = useQuery({
    queryKey: ['regulators', search],
    queryFn: () => fetchRegulators(search),
    staleTime: 30000,
  });

  const all = regulators || [];

  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (statusFilter !== 'All') {
        const active = statusFilter === 'Active';
        if (r.isActive !== active) return false;
      }
      if (scraperFilter !== 'All') {
        const enabled = scraperFilter === 'Enabled';
        if (Boolean(r.scraperEnabled) !== enabled) return false;
      }
      return true;
    });
  }, [all, statusFilter, scraperFilter]);

  const kpis = useMemo(() => {
    const byReg = (field) => {
      const m = {};
      for (const r of all) {
        const v = r[field] || 0;
        if (v) m[r.abbreviation || r.name] = v;
      }
      return m;
    };
    const sum = (field) => all.reduce((acc, r) => acc + (r[field] || 0), 0);
    return {
      total: { value: all.length, breakdown: Object.fromEntries(all.map((r) => [r.abbreviation || r.name, 1])) },
      instruments: { value: sum('instrumentCount'), breakdown: byReg('instrumentCount') },
      obligations: { value: sum('obligationCount'), breakdown: byReg('obligationCount') },
      returns: { value: sum('returnCount'), breakdown: byReg('returnCount') },
    };
  }, [all]);

  function handleToggleSelect(id) {
    setSelected((prev) => {
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
      // surface via refetch error state
    } finally {
      setBulking(false);
    }
  }

  const hasFilters = !!searchInput || statusFilter !== 'All' || scraperFilter !== 'All';
  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Regulators</Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} regulator{filtered.length !== 1 ? 's' : ''} — scraper health and document coverage
          </Typography>
        </Box>
        {selected.size > 0 && (
          <Button variant="contained" color="warning" startIcon={<Block />} onClick={handleBulkDisable} disabled={bulking}>
            {bulking ? 'Disabling...' : `Disable ${selected.size}`}
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

      {/* KPI cards (compliance-focused) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        <KpiCard label="Total Regulators" value={kpis.total.value} color="#2B6CB0"
          icon={<AccountBalance sx={{ fontSize: 18 }} />} breakdown={kpis.total.breakdown}
          onSelect={() => { setSearchInput(''); setSearch(''); setStatusFilter('All'); setScraperFilter('All'); }}
          onDrill={(name) => { setSearchInput(name); setSearch(name); }} />
        <KpiCard label="Instruments" value={kpis.instruments.value} color="#805AD5"
          icon={<LibraryBooks sx={{ fontSize: 18 }} />} breakdown={kpis.instruments.breakdown}
          onSelect={() => { setStatusFilter('All'); setScraperFilter('All'); }}
          onDrill={(name) => { setSearchInput(name); setSearch(name); }} />
        <KpiCard label="Obligations" value={kpis.obligations.value} color="#2D7D46"
          icon={<Gavel sx={{ fontSize: 18 }} />} breakdown={kpis.obligations.breakdown}
          onSelect={() => { setStatusFilter('All'); setScraperFilter('All'); }}
          onDrill={(name) => { setSearchInput(name); setSearch(name); }} />
        <KpiCard label="Returns" value={kpis.returns.value} color="#DD6B20"
          icon={<RequestQuote sx={{ fontSize: 18 }} />} breakdown={kpis.returns.breakdown}
          onSelect={() => { setStatusFilter('All'); setScraperFilter('All'); }}
          onDrill={(name) => { setSearchInput(name); setSearch(name); }} />
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search name or abbreviation..." value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 120 }}>
          {['All', 'Active', 'Disabled'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={scraperFilter} onChange={(e) => { setScraperFilter(e.target.value); setPage(0); }}
          label="Scraper" sx={{ minWidth: 130 }}>
          {['All', 'Enabled', 'Disabled'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter('All'); setScraperFilter('All'); }}>Clear</Button>
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
                        if (selected.size === filtered.length) setSelected(new Set());
                        else setSelected(new Set(filtered.map((r) => r.regulatorId)));
                      }} />
                  </TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>{c.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((reg, i) => (
                  <TableRow key={reg.regulatorId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_REGULATORS}/${reg.regulatorId}`)}
                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC',
                      borderLeft: !reg.isActive ? '3px solid #C53030' : '3px solid transparent' }}>
                    <TableCell sx={{ padding: 0 }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(reg.regulatorId)}
                        onChange={() => handleToggleSelect(reg.regulatorId)} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={reg.name}>
                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {reg.name}
                        </Typography>
                      </Tooltip>
                      {reg.scraperDisabledReason && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {reg.scraperDisabledReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={reg.abbreviation} size="small"
                        sx={{ height: 22, borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{reg.instrumentCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#2D7D46' }}>{reg.obligationCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#DD6B20' }}>{reg.returnCount ?? 0}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}