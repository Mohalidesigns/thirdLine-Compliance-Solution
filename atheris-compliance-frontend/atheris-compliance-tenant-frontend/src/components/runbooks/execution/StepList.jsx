import { Box, LinearProgress, Tooltip, Typography } from '@mui/material';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import UndoIcon from '@mui/icons-material/Undo';
import { TL } from 'shared';
import { groupSteps, isTerminalStep, statusLabel } from './executionUtils';

const ICON = {
  PENDING: { Icon: RadioButtonUncheckedIcon, color: TL.gray400 },
  IN_PROGRESS: { Icon: PlayCircleOutlineIcon, color: '#2B6CB0' },
  AWAITING_VERIFICATION: { Icon: HourglassTopIcon, color: TL.warning },
  PASSED: { Icon: CheckCircleIcon, color: TL.success },
  FAILED: { Icon: CancelIcon, color: TL.error },
  SKIPPED: { Icon: SkipNextIcon, color: TL.gray500 },
  NA: { Icon: DoNotDisturbAltIcon, color: TL.gray500 },
};

export function StepStatusIcon({ status, size = 18 }) {
  const { Icon, color } = ICON[status] || ICON.PENDING;
  return (
    <Tooltip title={statusLabel(status)}>
      <Icon sx={{ fontSize: size, color, flexShrink: 0 }} />
    </Tooltip>
  );
}

/** Left pane: steps grouped by section (rollback last), status icons and overall progress. */
export default function StepList({ steps = [], selectedId, onSelect }) {
  const groups = groupSteps(steps);
  const done = steps.filter((s) => isTerminalStep(s.status)).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <Box>
      <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: `1px solid ${TL.gray100}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: TL.gray500, textTransform: 'uppercase' }}>Progress</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: TL.gray700 }}>{done}/{steps.length}</Typography>
        </Box>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
      </Box>
      {groups.map((g) => (
        <Box key={g.key} sx={{ py: 1 }}>
          <Box sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {g.rollback && <UndoIcon sx={{ fontSize: 14, color: TL.warning }} />}
            <Typography sx={{
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              color: g.rollback ? TL.warning : TL.gray400,
            }}>
              {g.title}
            </Typography>
          </Box>
          {g.steps.map((s) => {
            const selected = s.stepExecId === selectedId;
            return (
              <Box
                key={s.stepExecId}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(s.stepExecId)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(s.stepExecId); }}
                sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1, px: 2, py: 0.875, cursor: 'pointer',
                  borderLeft: `3px solid ${selected ? TL.primary : 'transparent'}`,
                  bgcolor: selected ? '#EEF2F7' : 'transparent',
                  '&:hover': { bgcolor: selected ? '#EEF2F7' : TL.gray50 },
                }}
              >
                <Box sx={{ pt: 0.125 }}><StepStatusIcon status={s.status} /></Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontFamily: TL.mono, color: TL.gray500 }}>
                    {s.stepCode || '–'}{s.dualControl ? ' · dual' : ''}{s.blocking ? ' · blocking' : ''}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.8125rem', fontWeight: selected ? 600 : 500, color: TL.gray800, lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {s.title}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
      {steps.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No steps.</Typography>
      )}
    </Box>
  );
}
