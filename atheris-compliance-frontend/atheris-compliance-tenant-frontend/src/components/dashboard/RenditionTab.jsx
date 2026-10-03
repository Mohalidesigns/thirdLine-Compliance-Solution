import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Chip, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import { Refresh, WarningAmber } from '@mui/icons-material';
import { api } from '../../services/api';

const STATUS_COLORS = {
  SUBMITTED: 'success',
  SUBMITTED_LATE: 'warning',
  IN_PROGRESS: 'info',
  NOT_STARTED: 'error',
  'N/A': 'default',
};

const STATUS_LABELS = {
  SUBMITTED: 'OK',
  SUBMITTED_LATE: 'Late',
  IN_PROGRESS: 'IP',
  NOT_STARTED: 'NS',
};

const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function EscalationSection({ data }) {
  if (!data?.escalations?.length) return null;
  const { summary, escalations } = data;
  return (
    <Paper variant="outlined" sx={{ mt: 2 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber sx={{ color: '#FF9800' }} />
          <Typography variant="h6">Escalation Matrix</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {summary?.l1 > 0 && <Chip size="small" label={`L1: ${summary.l1}`} color="warning" />}
          {summary?.l2 > 0 && <Chip size="small" label={`L2: ${summary.l2}`} color="error" />}
          {summary?.l3 > 0 && <Chip size="small" label={`L3: ${summary.l3}`} sx={{ bgcolor: '#D32F2F', color: '#fff' }} />}
        </Box>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Return</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Regulator</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Area of Focus</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Owner</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Dept Head</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Days Late</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Period</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {escalations.map((e, i) => (
              <TableRow key={e.returnId ? `${e.returnId}-${e.period}-${i}` : i} hover
                sx={{ bgcolor: e.escalationLevel >= 3 ? '#FFF5F5' : e.escalationLevel >= 2 ? '#FFF8E1' : 'inherit' }}>
                <TableCell>{e.returnName || '-'}</TableCell>
                <TableCell>{e.regulator || '-'}</TableCell>
                <TableCell>{e.department || '-'}</TableCell>
                <TableCell>{e.areaOfFocus || '-'}</TableCell>
                <TableCell>{e.returnOwner || '-'}</TableCell>
                <TableCell>{e.departmentHead || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={e.escalationLabel}
                    color={e.escalationLevel >= 3 ? 'error' : e.escalationLevel >= 2 ? 'warning' : 'info'} />
                </TableCell>
                <TableCell align="right">{e.daysLate ?? 0}</TableCell>
                <TableCell>{e.period || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function RenditionTab() {
  const [groupBy, setGroupBy] = useState('department');

  const { from, to, quarter, year } = useMemo(() => {
    const today = new Date();
    const firstMonth = Math.floor(today.getMonth() / 3) * 3;
    return {
      from: fmtDate(new Date(today.getFullYear(), firstMonth, 1)),
      to: fmtDate(new Date(today.getFullYear(), firstMonth + 3, 0)),
      quarter: firstMonth / 3 + 1,
      year: today.getFullYear(),
    };
  }, []);

  const gridQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'renditionGrid', from, to, groupBy],
    queryFn: ({ signal }) => api.dashboard.v2.renditionGrid(from, to, groupBy, { signal }),
    placeholderData: keepPreviousData,
  });

  const escalationQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'escalationMatrix'],
    queryFn: ({ signal }) => api.dashboard.v2.escalationMatrix({ signal }),
  });

  const data = gridQuery.data;
  const months = data?.months || [];
  const groups = data?.groups || [];

  const refresh = () => { gridQuery.refetch(); escalationQuery.refetch(); };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Rendition Tracker</Typography>
          <Typography variant="caption" color="text.secondary">
            Q{quarter} {year} — {data?.summary?.totalReturns ?? 0} returns,{' '}
            {data?.summary?.totalSubmitted ?? 0} submitted, {data?.summary?.totalOverdue ?? 0} overdue
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup size="small" value={groupBy} exclusive
            onChange={(_, v) => { if (v) setGroupBy(v); }}>
            <ToggleButton value="department">Department</ToggleButton>
            <ToggleButton value="areaOfFocus">Area of Focus</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Refresh"><IconButton onClick={refresh}><Refresh /></IconButton></Tooltip>
        </Box>
      </Box>

      {gridQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{gridQuery.error?.message || 'Failed to load rendition grid'}</Alert>
      )}
      {escalationQuery.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>{escalationQuery.error?.message || 'Failed to load escalation matrix'}</Alert>
      )}

      {gridQuery.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        <>
          {groups.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 160 }}>
                      {groupBy === 'department' ? 'Department' : 'Area of Focus'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 180 }}>Return</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Regulator</TableCell>
                    {months.map(m => (
                      <TableCell key={m} sx={{ fontWeight: 700, bgcolor: '#F7FAFC', textAlign: 'center', minWidth: 90 }}>{m}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group, gi) =>
                    (group.returns || []).map((ret, ri) => (
                      <TableRow key={`${gi}-${ret.returnId ?? ri}`} hover>
                        {ri === 0 && (
                          <TableCell rowSpan={group.returns.length} sx={{ fontWeight: 600, bgcolor: '#F7FAFC', verticalAlign: 'top', borderRight: '2px solid #E2E8F0' }}>
                            {group.name}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {group.groupSummary?.submitted ?? 0}/{group.groupSummary?.total ?? 0} submitted
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>{ret.returnName || '-'}</TableCell>
                        <TableCell>{ret.regulator || '-'}</TableCell>
                        {months.map((m, ci) => {
                          const cell = ret.cells?.[ci];
                          const status = cell?.status || 'N/A';
                          return (
                            <TableCell key={m} sx={{ textAlign: 'center' }}>
                              {status === 'N/A' ? (
                                <Typography variant="caption" color="text.secondary">-</Typography>
                              ) : (
                                <Tooltip title={cell?.dueDate ? `Due ${cell.dueDate}` : status}>
                                  <Chip size="small"
                                    label={STATUS_LABELS[status] || status}
                                    color={STATUS_COLORS[status] || 'default'}
                                    sx={{ height: 22, minWidth: 40 }} />
                                </Tooltip>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>No rendition data for this quarter.</Typography>
            </Paper>
          )}

          <EscalationSection data={escalationQuery.data} />
        </>
      )}
    </Box>
  );
}
