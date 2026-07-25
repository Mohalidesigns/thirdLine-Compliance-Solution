import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, MenuItem, Button,
  Card, CardContent, CardHeader, TableContainer, Paper,
  CircularProgress, Alert, Divider, Link, Tooltip, Grid
} from '@mui/material';
import {
  Verified, Warning as WarningIcon, Download, Schedule
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '@mui/material/styles';

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
  const theme = useTheme();

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

  useEffect(() => {
    api.audit.verify().then(res => setChainStatus(res))
      .catch(() => setChainStatus({ chainValid: false, message: 'Failed to verify chain' }));
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Audit Trail</Typography>
          <Typography variant="body2" color="text.secondary">Tamper-evident event log with hash chain verification</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Download />} disabled>
          Export Pack
        </Button>
      </Box>

      {/* Hash chain banner */}
      {chainStatus && (
        <Card sx={{ mb: 2, bgcolor: chainStatus.chainValid ? 'success.50' : 'error.50' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
            {chainStatus.chainValid
              ? <Verified color="success" />
              : <WarningIcon color="error" />}
            <Typography variant="body2" fontWeight={600} color={chainStatus.chainValid ? 'success.dark' : 'error.dark'}>
              🔗 Hash chain: {chainStatus.chainValid ? 'VERIFIED ✓' : 'BROKEN — contact your system administrator'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pb: '12px !important' }}>
          <TextField select label="Subject" size="small" sx={{ minWidth: 140 }}
            value={filters.subjectType} onChange={e => { setFilters(f => ({ ...f, subjectType: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="control">Control</MenuItem>
            <MenuItem value="finding">Finding</MenuItem>
            <MenuItem value="return_instance">Return</MenuItem>
            <MenuItem value="control_test">Test</MenuItem>
          </TextField>
          <TextField label="Subject ID" size="small" type="number" sx={{ minWidth: 110 }}
            value={filters.subjectId} onChange={e => { setFilters(f => ({ ...f, subjectId: e.target.value })); setPage(0); }} />
          <TextField label="Actor User ID" size="small" type="number" sx={{ minWidth: 120 }}
            value={filters.actorUserId} onChange={e => { setFilters(f => ({ ...f, actorUserId: e.target.value })); setPage(0); }} />
          <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 140 }}
            value={filters.dateFrom} onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(0); }} />
          <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 140 }}
            value={filters.dateTo} onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(0); }} />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Schedule sx={{ fontSize: 48, color: theme.palette.action.disabled, mb: 1 }} />
            <Typography color="text.secondary">No audit events found</Typography>
          </CardContent>
        ) : (
          <>
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actor</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Evidence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((row) => (
                    <TableRow key={row.eventId} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {new Date(row.occurredAt).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>User {row.actorUserId || '-'}</TableCell>
                      <TableCell>{row.actionDescription || row.action}</TableCell>
                      <TableCell>
                        {row.subjectType && (
                          <Chip label={`${row.subjectType} #${row.subjectId}`} size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.evidenceUrl ? (
                          <Link href={row.evidenceUrl} target="_blank" rel="noopener" variant="body2">View</Link>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={data.totalElements} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Card>

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}
