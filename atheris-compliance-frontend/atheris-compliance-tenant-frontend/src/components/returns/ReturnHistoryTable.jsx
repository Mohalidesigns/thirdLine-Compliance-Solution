import {
  Box, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip,
} from '@mui/material';
import { StatusBadge } from 'shared';
import { formatDate, statusBadge, isCompletedStatus, STATUS_LABEL } from './returnCommon';

export default function ReturnHistoryTable({ filings, selectedId, onOpen, loading }) {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (!filings.length) return <Alert severity="info">No completed filings yet — open periods are in the Filings tab.</Alert>;
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell>Due date</TableCell>
            <TableCell>Stage</TableCell>
            <TableCell>Status</TableCell>
            <TableCell sx={{ width: 150 }}>Review</TableCell>
            <TableCell sx={{ width: 90 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {filings.map((f) => {
            const st = f.isOverdue && !isCompletedStatus(f.status) ? 'Overdue' : f.status;
            return (
              <TableRow key={f.instanceId} hover selected={f.instanceId === selectedId}
                sx={{ cursor: 'pointer', bgcolor: f.isOverdue ? '#FFF5F5' : 'inherit' }}
                onClick={() => onOpen(f.instanceId)}>
                <TableCell>{f.triggerDate ? `Event · ${formatDate(f.triggerDate)}` : (f.period || '—')}</TableCell>
                <TableCell>
                  {formatDate(f.dueDate)}
                  {f.dueDateAdjusted && (
                    <Tooltip title="Moved to the next working day">
                      <span><StatusBadge label="Adjusted" tone="gray" sx={{ ml: 1 }} /></span>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{f.currentStage || '—'}</TableCell>
                <TableCell>{statusBadge(st)}</TableCell>
                <TableCell>
                  {f.pendingReview
                    ? <StatusBadge label="Awaiting review" tone="amber" />
                    : f.reviewDecision === 'ACCEPTED' ? <StatusBadge label="Accepted" tone="green" />
                      : f.reviewDecision === 'REJECTED' ? <StatusBadge label="Data rejected" tone="red" />
                        : f.reviewDecision === 'CHANGES_REQUESTED' ? <StatusBadge label="Changes requested" tone="orange" />
                          : isCompletedStatus(f.status) ? <StatusBadge label={STATUS_LABEL[f.status] || 'Completed'} tone="green" />
                            : '—'}
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(f.instanceId); }}>Open</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
