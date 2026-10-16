import { Box, LinearProgress, Tooltip, Typography } from '@mui/material';
import { StatusBadge, TL } from 'shared';
import { formatCountdown, formatDateTime, formatDuration, useNow } from './executionUtils';

/**
 * Register "Due" cell: a live countdown chip. Red when overdue, amber when less than 20%
 * of the window (start → due) is left. "—" when the execution has no due date.
 * Finished executions show the due date (red "Late" when completed after it).
 */
export function DueChip({ dueAt, startedAt, createdAt, completedAt, overdue, active = true }) {
  if (!dueAt) return <Typography variant="body2" color="text.secondary">—</Typography>;
  if (!active) {
    const late = completedAt && new Date(completedAt) > new Date(dueAt);
    return (
      <Tooltip title={`Due ${formatDateTime(dueAt)}`}>
        <span>
          {late
            ? <StatusBadge label="Late" tone="red" />
            : <Typography variant="body2" color="text.secondary">{formatDateTime(dueAt)}</Typography>}
        </span>
      </Tooltip>
    );
  }
  return <LiveDueChip dueAt={dueAt} startedAt={startedAt || createdAt} overdue={overdue} />;
}

function LiveDueChip({ dueAt, startedAt, overdue }) {
  const now = useNow();
  const due = new Date(dueAt).getTime();
  const start = startedAt ? new Date(startedAt).getTime() : null;
  const left = due - now;
  const late = overdue || left < 0;
  const windowMs = start != null && due > start ? due - start : null;
  const amber = !late && windowMs != null && left / windowMs < 0.2;
  const tone = late ? 'red' : amber ? 'orange' : 'blue';
  const label = late ? `Overdue ${formatDuration(-left)}` : `${formatCountdown(left)} left`;
  return (
    <Tooltip title={`Due ${formatDateTime(dueAt)}`}>
      <span><StatusBadge label={label} tone={tone} sx={{ fontVariantNumeric: 'tabular-nums' }} /></span>
    </Tooltip>
  );
}

/** Small live "in 3h 04:05" / "overdue 2h" text used in milestone lists. */
export function LiveRemaining({ at, sx }) {
  const now = useNow();
  if (!at) return null;
  const left = new Date(at).getTime() - now;
  return (
    <Typography component="span" sx={{
      fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
      color: left < 0 ? TL.error : TL.gray600, ...sx,
    }}>
      {left < 0 ? `overdue ${formatDuration(-left)}` : `in ${formatCountdown(left)}`}
    </Typography>
  );
}

/**
 * SLA timer: big live countdown to `dueAt`, a % elapsed bar with the 50% / 80% escalation
 * markers (positioned from sla50At / sla80At when present) and the milestone list.
 */
export function SlaTimer({ startedAt, createdAt, dueAt, sla50At, sla80At, milestones = [], stopped }) {
  const now = useNow();
  if (!dueAt) {
    return <Typography variant="body2" color="text.secondary">No SLA set for this execution.</Typography>;
  }
  const due = new Date(dueAt).getTime();
  const start = new Date(startedAt || createdAt || dueAt).getTime();
  const span = Math.max(due - start, 1);
  const ref = stopped ? Math.min(now, due) : now;
  const pct = Math.max(0, Math.min(100, ((ref - start) / span) * 100));
  const left = due - now;
  const late = left < 0 && !stopped;
  const markerPct = (at, fallback) => {
    if (!at) return fallback;
    return Math.max(0, Math.min(100, ((new Date(at).getTime() - start) / span) * 100));
  };
  const markers = [
    { label: '50%', pct: markerPct(sla50At, 50), at: sla50At },
    { label: '80%', pct: markerPct(sla80At, 80), at: sla80At },
  ];
  const barColor = late || pct >= 80 ? 'error' : pct >= 50 ? 'warning' : 'primary';

  return (
    <Box>
      <Typography sx={{
        fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, fontFamily: TL.mono,
        color: late ? TL.error : TL.textPrimary, fontVariantNumeric: 'tabular-nums',
      }}>
        {stopped ? 'Stopped' : late ? `-${formatCountdown(left)}` : formatCountdown(left)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {late ? 'SLA breached — ' : ''}Due {formatDateTime(dueAt)}
      </Typography>
      <Box sx={{ position: 'relative', mt: 1.5, mb: 2.5 }}>
        <LinearProgress variant="determinate" value={pct} color={barColor} sx={{ height: 8, borderRadius: 4 }} />
        {markers.map((m) => (
          <Tooltip key={m.label} title={m.at ? `${m.label} at ${formatDateTime(m.at)}` : `${m.label} elapsed`}>
            <Box sx={{ position: 'absolute', left: `${m.pct}%`, top: -3, transform: 'translateX(-1px)' }}>
              <Box sx={{ width: 2, height: 14, bgcolor: TL.gray700 }} />
              <Typography sx={{ fontSize: '0.625rem', color: TL.gray500, transform: 'translateX(-50%)', mt: 0.25 }}>
                {m.label}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">{Math.round(pct)}% of SLA elapsed</Typography>
      {milestones.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {milestones.map((m, i) => (
            <Box key={`${m.label}-${i}`} sx={{
              display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline',
              borderTop: `1px solid ${TL.gray100}`, pt: 1,
            }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TL.gray800 }}>{m.label}</Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: TL.gray500 }}>
                  {[m.frameworkCode, m.clauseRef].filter(Boolean).join(' ')}
                  {m.dueAt ? ` · ${formatDateTime(m.dueAt)}` : ''}
                </Typography>
              </Box>
              {!stopped && <LiveRemaining at={m.dueAt} />}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
