import {
  Alert, Box, Button, Grid, IconButton, MenuItem, TextField, Tooltip, Typography,
} from '@mui/material';
import { DataCard, PlusIcon, TrashIcon, TL } from 'shared';
import {
  ESCALATION_TRIGGERS, NOTIFY_CHANNELS, STEP_ROLES, humanize,
} from '../../../pages/runbooks/runbookConstants';
import { allSteps, emptyEscalation, emptyRollback, escalationProblem, hasSecret } from './builderModel';
import LintHints from './LintHints';

const ROW_SX = { p: 2, border: `1px solid ${TL.gray100}`, borderRadius: '8px' };

/** Step 4 — escalation ladder (M5) and rollback steps (M6). */
export default function EscalationRollbackStep({ tree, onChange, readOnly, criticality, slaMinutes }) {
  const { escalations, rollbackSteps } = tree;
  const setEsc = (list) => onChange({ escalations: list });
  const setRb = (list) => onChange({ rollbackSteps: list });
  const escUpdate = (i, patch) => setEsc(escalations.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const rbUpdate = (i, patch) => setRb(rollbackSteps.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const problem = escalationProblem(escalations);
  const steps = allSteps(tree);
  const codes = new Set(steps.map((s) => s.step.stepCode));
  const needsLadder = (criticality === 'HIGH' || criticality === 'CRITICAL') && escalations.length === 0;
  const needsSla80 = slaMinutes && !escalations.some((e) => e.triggerType === 'SLA_80');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DataCard
        title="Escalation ladder"
        subtitle="Who is notified, and when, if a step fails or the SLA is at risk."
        actions={!readOnly && (
          <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />}
            onClick={() => setEsc([...escalations, emptyEscalation(
              escalations.reduce((m, e) => Math.max(m, Number(e.level) || 0), 0) + 1,
            )])}>
            Add level
          </Button>
        )}
      >
        {needsLadder && <Alert severity="error" sx={{ mb: 2 }}>L6 · {criticality} runbooks need at least one escalation level.</Alert>}
        {needsSla80 && <Alert severity="warning" sx={{ mb: 2 }}>L10 · An SLA is set but no level triggers on SLA_80.</Alert>}
        {problem && <Alert severity="error" sx={{ mb: 2 }}>{problem}</Alert>}
        {escalations.length === 0 && (
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No escalation levels defined.</Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {escalations.map((e, i) => (
            <Box key={e._key} sx={ROW_SX}>
              <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 4, md: 1 }}>
                  <TextField fullWidth size="small" type="number" label="Level" value={e.level ?? ''} disabled={readOnly}
                    onChange={(ev) => escUpdate(i, { level: ev.target.value === '' ? '' : Number(ev.target.value) })}
                    slotProps={{ htmlInput: { min: 1 } }} />
                </Grid>
                <Grid size={{ xs: 8, md: 2.5 }}>
                  <TextField fullWidth select size="small" label="Trigger" value={e.triggerType} disabled={readOnly}
                    onChange={(ev) => escUpdate(i, { triggerType: ev.target.value })}>
                    {ESCALATION_TRIGGERS.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 2.5 }}>
                  <TextField fullWidth select size="small" label="Notify role" value={e.notifyRole || ''} disabled={readOnly}
                    onChange={(ev) => escUpdate(i, { notifyRole: ev.target.value })}>
                    {STEP_ROLES.map((r) => <MenuItem key={r} value={r}>{humanize(r)}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <TextField fullWidth select size="small" label="Channel" value={e.notifyChannel} disabled={readOnly}
                    onChange={(ev) => escUpdate(i, { notifyChannel: ev.target.value })}>
                    {NOTIFY_CHANNELS.map((c) => <MenuItem key={c} value={c}>{humanize(c)}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, md: 1.5 }}>
                  <TextField fullWidth size="small" type="number" label="Wait (min)" value={e.waitMinutes ?? ''} disabled={readOnly}
                    onChange={(ev) => escUpdate(i, { waitMinutes: ev.target.value === '' ? '' : Number(ev.target.value) })}
                    slotProps={{ htmlInput: { min: 0 } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 2.5 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {!readOnly && (
                    <Tooltip title="Remove level">
                      <IconButton size="small" onClick={() => setEsc(escalations.filter((_, j) => j !== i))}><TrashIcon size={16} /></IconButton>
                    </Tooltip>
                  )}
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth size="small" label="Instructions" value={e.instructions} disabled={readOnly}
                    onChange={(ev) => escUpdate(i, { instructions: ev.target.value })}
                    placeholder="e.g. Page the CISO and open a P1 incident ticket." />
                </Grid>
              </Grid>
            </Box>
          ))}
        </Box>
      </DataCard>

      <DataCard
        title="Rollback steps"
        subtitle="How to reverse a step if execution has to be rolled back. Destructive steps need one (lint L5)."
        actions={!readOnly && (
          <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />} onClick={() => setRb([...rollbackSteps, emptyRollback()])}>
            Add rollback step
          </Button>
        )}
      >
        {rollbackSteps.length === 0 && (
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No rollback steps defined.</Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rollbackSteps.map((r, i) => {
            const dangling = r.reversesStepCode && !codes.has(r.reversesStepCode);
            return (
              <Box key={r._key} sx={ROW_SX}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField fullWidth select size="small" label="Reverses step" value={r.reversesStepCode || ''} disabled={readOnly}
                      error={dangling} helperText={dangling ? `Step ${r.reversesStepCode} no longer exists` : undefined}
                      onChange={(ev) => rbUpdate(i, { reversesStepCode: ev.target.value })}>
                      <MenuItem value="">— General rollback —</MenuItem>
                      {dangling && <MenuItem value={r.reversesStepCode} disabled>{r.reversesStepCode} (missing)</MenuItem>}
                      {steps.map(({ step }) => (
                        <MenuItem key={step._key} value={step.stepCode}>
                          <Box component="span" sx={{ fontFamily: TL.mono, mr: 1 }}>{step.stepCode}</Box>{step.title || 'Untitled'}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 11, md: 7.5 }}>
                    <TextField fullWidth size="small" label="Title" required value={r.title} disabled={readOnly}
                      error={!readOnly && !r.title.trim()} onChange={(ev) => rbUpdate(i, { title: ev.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 1, md: 0.5 }} sx={{ textAlign: 'right' }}>
                    {!readOnly && (
                      <IconButton size="small" onClick={() => setRb(rollbackSteps.filter((_, j) => j !== i))}><TrashIcon size={16} /></IconButton>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth multiline minRows={2} size="small" label="Instruction" value={r.instructionMd} disabled={readOnly}
                      onChange={(ev) => rbUpdate(i, { instructionMd: ev.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <TextField fullWidth multiline minRows={2} size="small" label="Command" value={r.commandBlock} disabled={readOnly}
                      onChange={(ev) => rbUpdate(i, { commandBlock: ev.target.value })}
                      slotProps={{ htmlInput: { style: { fontFamily: TL.mono, fontSize: '0.8125rem' }, spellCheck: false } }} />
                    <LintHints hints={hasSecret(r.commandBlock) ? [{ rule: 'L9', severity: 'ERROR',
                      message: 'Command appears to contain a secret (password/token/key).' }] : []} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <TextField fullWidth multiline minRows={2} size="small" label="Verification" value={r.verification} disabled={readOnly}
                      onChange={(ev) => rbUpdate(i, { verification: ev.target.value })}
                      placeholder="How to confirm the rollback worked" />
                  </Grid>
                </Grid>
              </Box>
            );
          })}
        </Box>
      </DataCard>
    </Box>
  );
}
