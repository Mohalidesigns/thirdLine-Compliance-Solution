import { Box, Button, Chip, Typography } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { DataCard, StatusBadge, TL } from 'shared';
import { SlaTimer } from './Countdown';
import { formatDateTime, TERMINAL_EXECUTION_STATUSES } from './executionUtils';
import { humanize } from '../../../pages/runbooks/runbookConstants';

/** Right pane: SLA timer + milestones, escalations (ack / escalate now), prerequisites, operator notes. */
export default function ConsoleSidePanel({ execution, canAct, onAck, onEscalate, ackingId }) {
  const escalations = execution.escalations || [];
  const prereqs = execution.prerequisites || [];
  const notes = (execution.steps || []).filter((s) => s.operatorNotes);
  const stopped = TERMINAL_EXECUTION_STATUSES.includes(execution.status) || execution.status === 'PENDING_SIGNOFF';
  const openEsc = escalations.filter((e) => !e.acknowledgedAt).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DataCard title="SLA" subtitle={execution.slaMinutes ? `${execution.slaMinutes} min window` : undefined}>
        <SlaTimer
          startedAt={execution.startedAt}
          createdAt={execution.createdAt}
          dueAt={execution.dueAt}
          sla50At={execution.sla50At}
          sla80At={execution.sla80At}
          milestones={execution.milestones || []}
          stopped={stopped}
        />
      </DataCard>

      <DataCard
        title="Escalations"
        subtitle={escalations.length ? `${openEsc} open of ${escalations.length}` : 'None raised'}
        actions={canAct ? <Button size="small" color="error" onClick={onEscalate}>Escalate now</Button> : null}
      >
        {escalations.length === 0 && <Typography variant="body2" color="text.secondary">No escalations.</Typography>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {escalations.map((e) => (
            <Box key={e.execEscId} sx={{ borderLeft: `3px solid ${e.acknowledgedAt ? TL.gray300 : TL.error}`, pl: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <StatusBadge label={`L${e.level}`} tone={e.acknowledgedAt ? 'gray' : 'red'} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{humanize(e.triggerType)}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray600, mt: 0.25 }}>
                → {e.notifiedName || humanize(e.notifiedRole) || '–'} via {humanize(e.channel)} · {formatDateTime(e.sentAt)}
              </Typography>
              {e.notes && <Typography sx={{ fontSize: '0.75rem', color: TL.gray700, mt: 0.25 }}>{e.notes}</Typography>}
              {e.acknowledgedAt ? (
                <Typography sx={{ fontSize: '0.6875rem', color: TL.gray500 }}>
                  Acknowledged by {e.acknowledgedByName || '–'} · {formatDateTime(e.acknowledgedAt)}
                </Typography>
              ) : canAct && (
                <Button size="small" sx={{ mt: 0.5, px: 1, minWidth: 0 }} disabled={ackingId === e.execEscId}
                  onClick={() => onAck(e.execEscId)}>
                  Acknowledge
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </DataCard>

      <DataCard title="Prerequisites" subtitle={execution.preflightCompletedAt ? `Pre-flight ${formatDateTime(execution.preflightCompletedAt)}` : 'Pre-flight pending'}>
        {prereqs.length === 0 && <Typography variant="body2" color="text.secondary">None declared.</Typography>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {prereqs.map((p) => (
            <Box key={p.prereqId} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              {p.acknowledged
                ? <CheckBoxIcon sx={{ fontSize: 18, color: TL.success }} />
                : <CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: TL.gray400 }} />}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: TL.gray800 }}>
                  {p.label}
                  {p.mandatory && <Chip size="small" label="M" sx={{ ml: 0.5, height: 16, fontSize: '0.625rem' }} />}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: TL.gray500 }}>{humanize(p.prereqType)}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </DataCard>

      <DataCard title="Operator notes">
        {notes.length === 0 && <Typography variant="body2" color="text.secondary">No notes recorded yet.</Typography>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {notes.map((s) => (
            <Box key={s.stepExecId}>
              <Typography sx={{ fontSize: '0.6875rem', fontFamily: TL.mono, color: TL.gray500 }}>{s.stepCode}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: TL.gray800, whiteSpace: 'pre-wrap' }}>{s.operatorNotes}</Typography>
            </Box>
          ))}
        </Box>
      </DataCard>
    </Box>
  );
}
