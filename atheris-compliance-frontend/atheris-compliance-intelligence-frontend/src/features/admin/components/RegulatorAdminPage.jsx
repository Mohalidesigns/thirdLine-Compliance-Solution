import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Checkbox, Button, CircularProgress, Alert,
  Tooltip, TableContainer, Paper, TablePagination,
} from '@mui/material';
import { PageHeader, FilterBar, StatusBadge, TL, XMarkIcon } from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const COLUMNS = [
  { id: 'name', label: 'Regulator', minWidth: 280 },
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
  const [actionError, setActionError] = useState('');

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

  return (
    <Box>
      <PageHeader
        title="Regulators"
        subtitle={regulators ? `${filtered.length} of ${regulators.length} platform regulators` : 'Browse all platform regulators'}
        actions={selected.size > 0 && (
          <Button variant="contained" color="error" startIcon={<XMarkIcon size={16} />}
            onClick={handleBulkDisable} disabled={bulking}>
            {bulking ? 'Disabling...' : `Disable ${selected.size}`}
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load regulators'}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search name or abbreviation...' }}
        filters={[
          { key: 'status', label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0); }, options: [{ value: 'Active', label: 'Active' }, { value: 'Disabled', label: 'Disabled' }], allLabel: 'All', minWidth: 150 },
        ]}
        showClear={!!(search || statusFilter !== 'All')}
        onClear={() => { setSearch(''); setStatusFilter('All'); }}
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
                        if (selected.size === filtered.length) {
                          setSelected(new Set());
                        } else {
                          setSelected(new Set(filtered.map(r => r.regulatorId)));
                        }
                      }} />
                  </TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((reg) => (
                  <TableRow key={reg.regulatorId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_REGULATORS}/${reg.regulatorId}`)}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
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
                    </TableCell>
                    <TableCell>{(reg.instrumentCount ?? 0) + (reg.pendingDownloadCount ?? 0)}</TableCell>
                    <TableCell>
                      <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.success }}>{reg.instrumentCount ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      {(reg.pendingDownloadCount ?? 0) > 0 ? (
                        <StatusBadge label={reg.pendingDownloadCount} tone="red" />
                      ) : (
                        <Typography component="span" sx={{ fontSize: '0.875rem', color: TL.gray400 }}>0</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: TL.gray500, whiteSpace: 'nowrap' }}>
                      {formatDt(reg.lastInstrumentDiscoveredAt)}
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
