import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, Grid, IconButton, MenuItem, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import { PlusIcon, TrashIcon, TL } from 'shared';
import { COMMAND_LANGS, EVIDENCE_TYPES, STEP_ROLES, humanize } from '../../../pages/runbooks/runbookConstants';
import LintHints from './LintHints';
import { emptyEvidenceReq, lintStep } from './builderModel';

const SUB = { fontSize: '0.75rem', fontWeight: 700, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1 };

/**
 * M3 — Add/Edit Step. Mount with a fresh `key` per open so the draft initialises from `step`.
 * `serverIssues` are the server lint issues for this step; `saveError` a rejected-save message.
 */
export default function StepDialog({
  open, step, autoCode, isNew, onClose, onSave, readOnly, mappedClauses = [], serverIssues = [], saveError,
}) {
  const [d, setD] = useState(() => ({ ...step, evidenceReqs: [...(step?.evidenceReqs || [])] }));
  const [touched, setTouched] = useState(false);
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const hints = useMemo(() => lintStep(d), [d]);
  const hintsFor = (field) => hints.filter((h) => h.field === field);

  const evUpdate = (i, patch) => set({ evidenceReqs: d.evidenceReqs.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const evRemove = (i) => set({ evidenceReqs: d.evidenceReqs.filter((_, j) => j !== i) });

  const errors = {
    title: !d.title?.trim() ? 'Title is required.' : '',
    instructionMd: !d.instructionMd?.trim() ? 'Instruction is required.' : '',
    evidence: d.evidenceReqs.some((e) => e.mandatory && !e.label?.trim()) ? 'Mandatory evidence requirements need a label.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const clauseOptions = mappedClauses;
  const clauseValue = clauseOptions.filter((c) => (d.clauseIds || []).includes(c.clauseId));
  const orphanClauseIds = (d.clauseIds || []).filter((id) => !clauseOptions.some((c) => c.clauseId === id));

  const save = () => {
    setTouched(true);
    if (invalid) return;
    onSave({ ...d, stepCode: d._manualCode ? d.stepCode.trim() : autoCode });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {readOnly ? 'Step' : isNew ? 'Add step' : 'Edit step'}
        <Box component="span" sx={{ ml: 1, fontFamily: TL.mono, fontSize: '0.875rem', color: TL.gray500 }}>
          {d._manualCode ? d.stepCode : autoCode}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
        {serverIssues.length > 0 && (
          <Alert severity={serverIssues.some((i) => i.severity === 'ERROR') ? 'error' : 'warning'} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.5 }}>Server lint (as of last save)</Typography>
            {serverIssues.map((i) => (
              <Typography key={`${i.rule}-${i.message}`} sx={{ fontSize: '0.8125rem' }}>
                <b>{i.rule}</b> · {i.message}
              </Typography>
            ))}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth size="small" label="Step code" disabled={readOnly}
              value={d._manualCode ? d.stepCode : autoCode}
              onChange={(e) => set({ stepCode: e.target.value, _manualCode: true })}
              helperText={d._manualCode
                ? <Box component="span">Custom · <Box component="a" sx={{ cursor: 'pointer', color: TL.primary }}
                    onClick={() => !readOnly && set({ _manualCode: false, stepCode: autoCode })}>reset to auto</Box></Box>
                : 'Auto-numbered'}
              slotProps={{ htmlInput: { style: { fontFamily: TL.mono } } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 9 }}>
            <TextField fullWidth size="small" label="Title" required value={d.title} disabled={readOnly}
              onChange={(e) => set({ title: e.target.value })}
              error={touched && !!errors.title} helperText={touched ? errors.title : ''} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={3} size="small" label="Instruction (markdown)" required
              value={d.instructionMd} disabled={readOnly} onChange={(e) => set({ instructionMd: e.target.value })}
              error={touched && !!errors.instructionMd}
              helperText={touched && errors.instructionMd ? errors.instructionMd : `${(d.instructionMd || '').length}/400 · start with a verb`}
              placeholder="Export the list of active users from the core banking user table." />
            <LintHints hints={hintsFor('instructionMd')} />
          </Grid>
          <Grid size={{ xs: 12, md: 9 }}>
            <TextField fullWidth multiline minRows={3} size="small" label="Command block" value={d.commandBlock}
              disabled={readOnly} onChange={(e) => set({ commandBlock: e.target.value })}
              placeholder="Get-ADUser -Filter {Enabled -eq $true} -Properties LastLogonDate | Export-Csv users.csv"
              slotProps={{ htmlInput: { style: { fontFamily: TL.mono, fontSize: '0.8125rem' }, spellCheck: false } }} />
            <LintHints hints={hintsFor('commandBlock')} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth select size="small" label="Language" value={d.commandLang || 'none'} disabled={readOnly}
              onChange={(e) => set({ commandLang: e.target.value })}>
              {COMMAND_LANGS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={2} size="small" label="Expected result" value={d.expectedResult}
              disabled={readOnly} onChange={(e) => set({ expectedResult: e.target.value })}
              placeholder="CSV with one row per enabled account; row count matches the HR headcount ±5%." />
            <LintHints hints={hintsFor('expectedResult')} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" type="number" label="Duration estimate (min)"
              value={d.durationEstimateMin ?? ''} disabled={readOnly}
              onChange={(e) => set({ durationEstimateMin: e.target.value === '' ? null : Number(e.target.value) })}
              slotProps={{ htmlInput: { min: 0 } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select size="small" label="Assigned role" value={d.assignedRole || ''} disabled={readOnly}
              onChange={(e) => set({ assignedRole: e.target.value })}>
              <MenuItem value="">— None —</MenuItem>
              {STEP_ROLES.map((r) => <MenuItem key={r} value={r}>{humanize(r)}</MenuItem>)}
            </TextField>
            <LintHints hints={hintsFor('assignedRole')} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column' }}>
            {[
              ['blocking', 'Blocking', 'Later steps wait for this one'],
              ['dualControl', 'Dual control', 'A second user must verify'],
              ['allowSkip', 'Allow skip', 'Operator may skip with a reason'],
            ].map(([k, l, tip]) => (
              <Tooltip key={k} title={tip} placement="left">
                <FormControlLabel sx={{ my: -0.25 }}
                  control={<Switch size="small" checked={!!d[k]} disabled={readOnly} onChange={(e) => set({ [k]: e.target.checked })} />}
                  label={<Typography sx={{ fontSize: '0.8125rem' }}>{l}</Typography>} />
              </Tooltip>
            ))}
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Safety note" value={d.safetyNote} disabled={readOnly}
              onChange={(e) => set({ safetyNote: e.target.value })}
              helperText="Required for destructive commands (DROP, rm -rf, Disable-, Remove-, DELETE) — lint L5" />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ ...SUB, flex: 1, mb: 0 }}>Evidence requirements</Typography>
          {!readOnly && (
            <Button size="small" startIcon={<PlusIcon size={14} />}
              onClick={() => set({ evidenceReqs: [...d.evidenceReqs, emptyEvidenceReq()] })}>
              Add requirement
            </Button>
          )}
        </Box>
        {d.evidenceReqs.length === 0 && (
          <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500, mt: 1 }}>
            None. Execution-section steps need at least one (lint L3).
          </Typography>
        )}
        {touched && errors.evidence && <Alert severity="error" sx={{ mt: 1 }}>{errors.evidence}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
          {d.evidenceReqs.map((e, i) => (
            <Grid key={e._key || i} container spacing={1} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth select size="small" label="Type" value={e.evidenceType} disabled={readOnly}
                  onChange={(ev) => evUpdate(i, { evidenceType: ev.target.value })}>
                  {EVIDENCE_TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField fullWidth size="small" label="Label" value={e.label} disabled={readOnly}
                  error={touched && e.mandatory && !e.label?.trim()}
                  onChange={(ev) => evUpdate(i, { label: ev.target.value })} />
              </Grid>
              <Grid size={{ xs: 5, md: 1.5 }}>
                <TextField fullWidth size="small" type="number" label="Retain (yrs)" value={e.retentionYears ?? ''}
                  disabled={readOnly}
                  onChange={(ev) => evUpdate(i, { retentionYears: ev.target.value === '' ? null : Number(ev.target.value) })} />
              </Grid>
              <Grid size={{ xs: 5, md: 2 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={!!e.mandatory} disabled={readOnly}
                    onChange={(ev) => evUpdate(i, { mandatory: ev.target.checked })} />}
                  label={<Typography sx={{ fontSize: '0.8125rem' }}>Mandatory</Typography>} />
              </Grid>
              <Grid size={{ xs: 2, md: 0.5 }}>
                {!readOnly && <IconButton size="small" onClick={() => evRemove(i)}><TrashIcon size={16} /></IconButton>}
              </Grid>
            </Grid>
          ))}
        </Box>

        <Divider sx={{ my: 2.5 }} />
        <Typography sx={SUB}>Clause tags</Typography>
        {clauseOptions.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>
            Map framework clauses to the runbook in step 1 to tag individual steps.
          </Typography>
        ) : (
          <Autocomplete
            multiple options={clauseOptions} value={clauseValue} disabled={readOnly}
            getOptionLabel={(c) => `${c.frameworkCode} ${c.clauseRef}${c.title ? ` — ${c.title}` : ''}`}
            isOptionEqualToValue={(a, b) => a.clauseId === b.clauseId}
            onChange={(_, v) => set({ clauseIds: [...v.map((c) => c.clauseId), ...orphanClauseIds] })}
            renderValue={(vals, getItemProps) => vals.map((c, index) => {
              const { key, ...rest } = getItemProps({ index });
              return <Chip key={key} size="small" label={`${c.frameworkCode} ${c.clauseRef}`} {...rest} />;
            })}
            renderInput={(params) => <TextField {...params} size="small" label="Clauses evidenced by this step" />}
          />
        )}
        {orphanClauseIds.length > 0 && (
          <Typography sx={{ fontSize: '0.75rem', color: TL.warning, mt: 0.5 }}>
            {orphanClauseIds.length} tagged clause(s) are no longer mapped to the runbook.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && <Button variant="contained" onClick={save}>{isNew ? 'Add step' : 'Apply'}</Button>}
      </DialogActions>
    </Dialog>
  );
}
