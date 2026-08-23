import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
          {summary.l1 > 0 && <Chip size="small" label={`L1: ${summary.l1}`} color="warning" />}
          {summary.l2 > 0 && <Chip size="small" label={`L2: ${summary.l2}`} color="error" />}
          {summary.l3 > 0 && <Chip size="small" label={`L3: ${summary.l3}`} sx={{ bgcolor: '#D32F2F', color: '#fff' }} />}
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
              <TableRow key={i} hover sx={{ bgcolor: e.escalationLevel >= 3 ? '#FFF5F5' : e.escalationLevel >= 2 ? '#FFF8E1' : 'inherit' }}>
                <TableCell>{e.returnName}</TableCell>
                <TableCell>{e.regulator}</TableCell>
                <TableCell>{e.department}</TableCell>
                <TableCell>{e.areaOfFocus}</TableCell>
                <TableCell>{e.returnOwner || '-'}</TableCell>
                <TableCell>{e.departmentHead || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={e.escalationLabel}
                    color={e.escalationLevel >= 3 ? 'error' : e.escalationLevel >= 2 ? 'warning' : 'info'} />
                </TableCell>
                <TableCell align="right">{e.daysLate}</TableCell>
                <TableCell>{e.period}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function RenditionTab() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [escalations, setEscalations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState('department');

  const today = new Date();
  const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const qEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) + 3, 0);
  const fmt = (d) => d.toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [grid, esc] = await Promise.allSettled([
        api.dashboard.v2.renditionGrid(fmt(qStart), fmt(qEnd), groupBy),
        api.dashboard.v2.escalationMatrix(),
      ]);
      if (grid.status === 'fulfilled') setData(grid.value);
      if (esc.status === 'fulfilled') setEscalations(esc.value);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [groupBy]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Rendition Tracker</Typography>
          <Typography variant="caption" color="text.secondary">
            Q{Math.floor(today.getMonth() / 3) + 1} {today.getFullYear()} — {data?.summary?.totalReturns || 0} returns
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup size="small" value={groupBy} exclusive
            onChange={(_, v) => { if (v) setGroupBy(v); }}>
            <ToggleButton value="department">Department</ToggleButton>
            <ToggleButton value="areaOfFocus">Area of Focus</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Refresh"><IconButton onClick={loadData}><Refresh /></IconButton></Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        <>
          {data?.groups?.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 160 }}>{groupBy === 'department' ? 'Department' : 'Area of Focus'}</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 180 }}>Return</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Regulator</TableCell>
                    {data.months?.map(m => (
                      <TableCell key={m} sx={{ fontWeight: 700, bgcolor: '#F7FAFC', textAlign: 'center', minWidth: 90 }}>{m}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.groups.map((group, gi) =>
                    group.returns.map((ret, ri) => (
                      <TableRow key={`${gi}-${ri}`} hover>
                        {ri === 0 && (
                          <TableCell rowSpan={group.returns.length} sx={{ fontWeight: 600, bgcolor: '#F7FAFC', verticalAlign: 'top', borderRight: '2px solid #E2E8F0' }}>
                            {group.name}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {group.groupSummary?.submitted}/{group.groupSummary?.total} submitted
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>{ret.returnName}</TableCell>
                        <TableCell>{ret.regulator}</TableCell>
                        {ret.cells?.map((cell, ci) => (
                          <TableCell key={ci} sx={{ textAlign: 'center' }}>
                            {cell.status === 'N/A' ? (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            ) : (
                              <Chip size="small"
                                label={cell.status === 'SUBMITTED' ? 'OK' : cell.status === 'IN_PROGRESS' ? 'IP' : cell.status === 'SUBMITTED_LATE' ? 'Late' : 'NS'}
                                color={STATUS_COLORS[cell.status] || 'default'}
                                sx={{ height: 22, minWidth: 40 }} />
                            )}
                          </TableCell>
                        ))}
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

          <EscalationSection data={escalations} />
        </>
      )}
    </Box>
  );
}
