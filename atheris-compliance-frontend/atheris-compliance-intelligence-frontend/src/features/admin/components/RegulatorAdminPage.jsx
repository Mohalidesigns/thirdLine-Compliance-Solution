import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Checkbox, Button, CircularProgress, Alert,
  Tooltip, TableContainer, Paper, TablePagination,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StatusBadge, TL, XMarkIcon,
  BuildingLibraryIcon, BookOpenIcon, ScaleIcon, CalendarDaysIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const COLUMNS = [
  { id: 'name', label: 'Regulator', minWidth: 300 },
  { id: 'instruments', label: 'Instruments', minWidth: 110 },
  { id: 'obligations', label: 'Obligations', minWidth: 110 },
  { id: 'returns', label: 'Returns', minWidth: 100 },
];

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
  const [actionError, setActionError] = useState('');

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
    setActionError('');
    try {
      await api.platform.regulators.bulkDisable([...selected]);
      setSelected(new Set());
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to disable regulators');
    } finally {
      setBulking(false);
    }
  }

  const hasFilters = !!searchInput || statusFilter !== 'All' || scraperFilter !== 'All';
  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      <PageHeader
        title="Regulators"
        subtitle={`${filtered.length} regulator${filtered.length !== 1 ? 's' : ''} — scraper health and document coverage`}
        actions={selected.size > 0 && (
          <Button variant="contained" color="error" startIcon={<XMarkIcon size={16} />}
            onClick={handleBulkDisable} disabled={bulking}>
            {bulking ? 'Disabling...' : `Disable ${selected.size}`}
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load regulators'}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

      {/* KPI cards (compliance-focused) with per-regulator breakdown dropdowns */}
      <KpiCards
        columns={4}
        items={[
          { key: 'total', label: 'Total Regulators', value: kpis.total.value, tone: 'blue', icon: <BuildingLibraryIcon />, breakdown: kpis.total.breakdown },
          { key: 'instruments', label: 'Instruments', value: kpis.instruments.value, tone: 'purple', icon: <BookOpenIcon />, breakdown: kpis.instruments.breakdown },
          { key: 'obligations', label: 'Obligations', value: kpis.obligations.value, tone: 'green', icon: <ScaleIcon />, breakdown: kpis.obligations.breakdown },
          { key: 'returns', label: 'Returns', value: kpis.returns.value, tone: 'orange', icon: <CalendarDaysIcon />, breakdown: kpis.returns.breakdown },
        ]}
        onSelect={(key) => {
          if (key === 'total') { setSearchInput(''); setSearch(''); }
          setStatusFilter('All'); setScraperFilter('All');
        }}
        onDrill={(_key, name) => { setSearchInput(name); setSearch(name); }}
      />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setSearch(v); setPage(0); }, placeholder: 'Search name or abbreviation...' }}
        filters={[
          { key: 'status', label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0); }, options: [{ value: 'Active', label: 'Active' }, { value: 'Disabled', label: 'Disabled' }], allLabel: 'All', minWidth: 150 },
          { key: 'scraper', label: 'Scraper', value: scraperFilter, onChange: (v) => { setScraperFilter(v); setPage(0); }, options: [{ value: 'Enabled', label: 'Enabled' }, { value: 'Disabled', label: 'Disabled' }], allLabel: 'All', minWidth: 150 },
        ]}
        showClear={hasFilters}
        onClear={() => { setSearchInput(''); setSearch(''); setStatusFilter('All'); setScraperFilter('All'); }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">No regulators found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox size="small"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      indeterminate={selected.size > 0 && selected.size < filtered.length}
                      onChange={() => {
                        if (selected.size === filtered.length) setSelected(new Set());
                        else setSelected(new Set(filtered.map((r) => r.regulatorId)));
                      }} />
                  </TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((reg) => (
                  <TableRow key={reg.regulatorId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_REGULATORS}/${reg.regulatorId}`)}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(reg.regulatorId)}
                        onChange={() => handleToggleSelect(reg.regulatorId)} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{reg.abbreviation}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Tooltip title={reg.name}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
                            {reg.name}
                          </Typography>
                        </Tooltip>
                        {!reg.isActive && <StatusBadge label="Disabled" tone="red" />}
                      </Box>
                      {reg.scraperDisabledReason && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {reg.scraperDisabledReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray700 }}>{reg.instrumentCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.success }}>{reg.obligationCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.warning }}>{reg.returnCount ?? 0}</Typography>
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