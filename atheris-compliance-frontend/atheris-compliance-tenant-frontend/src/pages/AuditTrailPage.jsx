import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, MenuItem, Button, Paper,
  CircularProgress, Alert, Link,
} from '@mui/material';
import {
  PageHeader, FilterBar, FilterField, StatusBadge, TL,
  ShieldCheckIcon, ExclamationTriangleIcon, ArrowDownTrayIcon, ClockIcon, LinkIcon,
} from 'shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export default function AuditTrailPage() {
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [chainStatus, setChainStatus] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [filters, setFilters] = useState({
    subjectType: '', subjectId: '', actorUserId: '', dateFrom: '', dateTo: ''
  });

  const loadList = useCallback(() => {
    setLoading(true);
    const p = { page, size: rowsPerPage };
    if (filters.subjectType) p.subjectType = filters.subjectType;
    if (filters.subjectId) p.subjectId = filters.subjectId;
    if (filters.actorUserId) p.actorUserId = filters.actorUserId;
    if (filters.dateFrom) p.dateFrom = new Date(filters.dateFrom).toISOString();
    if (filters.dateTo) p.dateTo = new Date(filters.dateTo).toISOString();
    api.audit.register(p).then(res => setData(res))
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
  }, [page, rowsPerPage, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  // Actor filter by name rather than a numeric user id.
  const { data: actors } = useQuery({
    queryKey: ['audit', 'actors'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    api.audit.verify().then(res => setChainStatus(res))
      .catch(() => setChainStatus({ chainValid: false, message: 'Failed to verify chain' }));
  }, []);

  return (
    <Box>
      <PageHeader
        title="Audit Trail"
        subtitle="Tamper-evident event log with hash chain verification"
        actions={(
          <Button variant="outlined" startIcon={<ArrowDownTrayIcon size={16} />} disabled>
            Export Pack
          </Button>
        )}
      />

      {/* Hash chain banner */}
      {chainStatus && (
        <Paper sx={{ mb: 3, px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: chainStatus.chainValid ? '#F0FDF4' : '#FEF2F2', color: chainStatus.chainValid ? TL.success : TL.error,
          }}>
            {chainStatus.chainValid ? <ShieldCheckIcon size={16} /> : <ExclamationTriangleIcon size={16} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: TL.gray700 }}>
            <LinkIcon size={16} sx={{ color: TL.gray400 }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Hash chain</Typography>
          </Box>
          <StatusBadge
            label={chainStatus.chainValid ? 'Verified' : 'Broken — contact your system administrator'}
            tone={chainStatus.chainValid ? 'green' : 'red'}
          />
        </Paper>
      )}

      {/* Filters */}
      <FilterBar>
        <FilterField label="Subject" minWidth={150}>
          <TextField select size="small"
            value={filters.subjectType} onChange={e => { setFilters(f => ({ ...f, subjectType: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="control">Control</MenuItem>
            <MenuItem value="finding">Finding</MenuItem>
            <MenuItem value="return_instance">Return</MenuItem>
            <MenuItem value="control_test">Test</MenuItem>
          </TextField>
        </FilterField>
        <FilterField label="Subject ID" minWidth={120}>
          <TextField size="small" type="number"
            value={filters.subjectId} onChange={e => { setFilters(f => ({ ...f, subjectId: e.target.value })); setPage(0); }} />
        </FilterField>
        <FilterField label="Actor" minWidth={170}>
          <TextField select size="small"
            value={filters.actorUserId} onChange={e => { setFilters(f => ({ ...f, actorUserId: e.target.value })); setPage(0); }}>
            <MenuItem value="">Anyone</MenuItem>
            {(actors || []).map(u => <MenuItem key={u.userId} value={String(u.userId)}>{u.fullName}</MenuItem>)}
          </TextField>
        </FilterField>
        <FilterField label="From" minWidth={150}>
          <TextField type="date" size="small"
            value={filters.dateFrom} onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(0); }} />
        </FilterField>
        <FilterField label="To" minWidth={150}>
          <TextField type="date" size="small"
            value={filters.dateTo} onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(0); }} />
        </FilterField>
      </FilterBar>

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <ClockIcon size={40} sx={{ color: TL.gray300, mb: 1 }} />
            <Typography color="text.secondary">No audit events found</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Evidence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((row) => (
                    <TableRow key={row.eventId} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>
                        {new Date(row.occurredAt).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>{row.actorName || (row.actorUserId ? `User ${row.actorUserId}` : 'System')}</TableCell>
                      <TableCell>{row.actionDescription || row.action}</TableCell>
                      <TableCell>
                        {row.subjectType && (
                          <Chip label={`${row.subjectType} #${row.subjectId}`} size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.evidenceUrl ? (
                          <Link href={row.evidenceUrl} target="_blank" rel="noopener" underline="hover"
                            sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>View</Link>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <TablePagination component="div" count={data.totalElements} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Paper>

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}
