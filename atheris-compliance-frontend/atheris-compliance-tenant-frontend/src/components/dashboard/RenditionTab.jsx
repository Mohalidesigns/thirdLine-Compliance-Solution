import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import { DataCard, StatusBadge, TL, ArrowPathIcon, ExclamationTriangleIcon } from 'shared';
import { api } from '../../services/api';

const STATUS_TONES = {
  OVERDUE: 'red',
  SUBMITTED: 'green',
  SUBMITTED_LATE: 'orange',
  IN_PROGRESS: 'blue',
  NOT_STARTED: 'gray',
  'N/A': 'gray',
};

const STATUS_LABELS = {
  OVERDUE: 'OD',
  SUBMITTED: 'OK',
  SUBMITTED_LATE: 'Late',
  IN_PROGRESS: 'IP',
  NOT_STARTED: 'NS',
};

const STATUS_NAMES = {
  OVERDUE: 'Overdue',
  SUBMITTED: 'Submitted',
  SUBMITTED_LATE: 'Submitted late',
  IN_PROGRESS: 'In progress',
  NOT_STARTED: 'Not started',
};

// Several periods in a month: "OD 5/17" = 5 of the month's 17 periods overdue; otherwise "NS ×30".
function cellLabel(cell, status) {
  const base = STATUS_LABELS[status] || status;
  if (!cell || !(cell.count > 1)) return base;
  if (status === 'OVERDUE') return `${base} ${cell.overdue}/${cell.count}`;
  return `${base} ×${cell.count}`;
}

// A month cell can hold several periods (daily/weekly returns) — say how many and how they stand.
function cellTooltip(cell, status) {
  const head = STATUS_NAMES[status] || status;
  if (!cell) return head;
  if (cell.count > 1) {
    const parts = [`${cell.count} periods`, `${cell.submitted} submitted`];
    if (cell.overdue) parts.push(`${cell.overdue} overdue`);
    return `${head} — ${parts.join(', ')}${cell.dueDate ? ` · next due ${cell.dueDate}` : ''}`;
  }
  return cell.dueDate ? `${head} · due ${cell.dueDate}` : head;
}

const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function EscalationSection({ data }) {
  if (!data?.escalations?.length) return null;
  const { summary, escalations } = data;
  return (
    <DataCard
      noPadding
      sx={{ mt: 3 }}
      title={(
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <ExclamationTriangleIcon size={16} sx={{ color: '#F97316' }} />
          Escalation Matrix
        </Box>
      )}
      actions={(
        <Box sx={{ display: 'flex', gap: 1 }}>
          {summary?.l1 > 0 && <StatusBadge label={`L1: ${summary.l1}`} tone="amber" />}
          {summary?.l2 > 0 && <StatusBadge label={`L2: ${summary.l2}`} tone="orange" />}
          {summary?.l3 > 0 && <StatusBadge label={`L3: ${summary.l3}`} tone="red" />}
        </Box>
      )}
    >
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Return</TableCell>
              <TableCell>Regulator</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Level</TableCell>
              <TableCell align="right">Days Late</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {escalations.map((e, i) => (
              <TableRow key={e.returnId ? `${e.returnId}-${e.period}-${i}` : i} hover
                sx={{ bgcolor: e.escalationLevel >= 3 ? '#FEF2F2' : e.escalationLevel >= 2 ? '#FFFBEB' : 'inherit' }}>
                {/* 5 columns (UI rule): period, department and area ride as captions */}
                <TableCell>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{e.returnName || '-'}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                    {[e.period, e.department, e.areaOfFocus].filter(Boolean).join(' · ')}
                  </Typography>
                </TableCell>
                <TableCell>{e.regulator || '-'}</TableCell>
                <TableCell>
                  {e.returnOwner || '-'}
                  {e.departmentHead && (
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>Head: {e.departmentHead}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge label={e.escalationLabel}
                    tone={e.escalationLevel >= 3 ? 'red' : e.escalationLevel >= 2 ? 'orange' : 'blue'} />
                </TableCell>
                <TableCell align="right">{e.daysLate ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </DataCard>
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
      {gridQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{gridQuery.error?.message || 'Failed to load rendition grid'}</Alert>
      )}
      {escalationQuery.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>{escalationQuery.error?.message || 'Failed to load escalation matrix'}</Alert>
      )}

      <DataCard
        noPadding
        title="Rendition Tracker"
        subtitle={`Q${quarter} ${year} — ${data?.summary?.totalReturns ?? 0} returns, ${data?.summary?.totalSubmitted ?? 0} submitted, ${data?.summary?.totalOverdue ?? 0} overdue`}
        actions={(
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <ToggleButtonGroup size="small" value={groupBy} exclusive
              onChange={(_, v) => { if (v) setGroupBy(v); }}>
              <ToggleButton value="department">Department</ToggleButton>
              <ToggleButton value="areaOfFocus">Area of Focus</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Refresh"><IconButton size="small" onClick={refresh}><ArrowPathIcon size={16} /></IconButton></Tooltip>
          </Box>
        )}
      >

        {gridQuery.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
          groups.length > 0 ? (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 160 }}>
                      {groupBy === 'department' ? 'Department' : 'Area of Focus'}
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>Return</TableCell>
                    <TableCell>Regulator</TableCell>
                    {months.map(m => (
                      <TableCell key={m} sx={{ textAlign: 'center', minWidth: 90 }}>{m}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group, gi) =>
                    (group.returns || []).map((ret, ri) => (
                      <TableRow key={`${gi}-${ret.returnId ?? ri}`} hover>
                        {ri === 0 && (
                          <TableCell rowSpan={group.returns.length} sx={{ bgcolor: TL.gray50, verticalAlign: 'top', borderRight: `1px solid ${TL.gray100}` }}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>{group.name}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                              {group.groupSummary?.submitted ?? 0}/{group.groupSummary?.total ?? 0} submitted
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{ret.returnName || '-'}</Typography>
                        </TableCell>
                        <TableCell>{ret.regulator || '-'}</TableCell>
                        {months.map((m, ci) => {
                          const cell = ret.cells?.[ci];
                          const status = cell?.status || 'N/A';
                          return (
                            <TableCell key={m} sx={{ textAlign: 'center' }}>
                              {status === 'N/A' ? (
                                <Typography component="span" sx={{ fontSize: '0.75rem', color: TL.gray400 }}>-</Typography>
                              ) : (
                                <Tooltip title={cellTooltip(cell, status)}>
                                  <span>
                                    <StatusBadge
                                      label={cellLabel(cell, status)}
                                      tone={STATUS_TONES[status] || 'gray'}
                                      sx={{ minWidth: 40, justifyContent: 'center' }} />
                                  </span>
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
            <Typography sx={{ p: 4, textAlign: 'center', fontSize: '0.875rem', color: TL.gray500 }}>
              No rendition data for this quarter.
            </Typography>
          )
        )}
      </DataCard>

      {!gridQuery.isPending && <EscalationSection data={escalationQuery.data} />}
    </Box>
  );
}
