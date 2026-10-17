import { useState } from 'react';
import {
  Alert, Box, Button, Grid, IconButton, MenuItem, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  DataCard, StatusBadge, PlusIcon, TrashIcon, PencilSquareIcon, EyeIcon, ChevronDownIcon, TL,
} from 'shared';
import { SECTION_TYPES, humanize, label as labelOf } from '../../../pages/runbooks/runbookConstants';
import { autoStepCode, emptySection, emptyStep, lintStep } from './builderModel';
import StepDialog from './StepDialog';

const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
};

const ArrowBtn = ({ up, disabled, onClick, title }) => (
  <Tooltip title={title}>
    <span>
      <IconButton size="small" disabled={disabled} onClick={onClick}>
        <ChevronDownIcon size={16} sx={up ? { transform: 'rotate(180deg)' } : undefined} />
      </IconButton>
    </span>
  </Tooltip>
);

/**
 * Step 3 — sections with ordered steps. `editTarget` ({ si, ti, isNew }) is owned by the
 * page so the Review step's "jump to step" can open a step here.
 */
export default function ProcedureStep({
  sections, onChange, readOnly, mappedClauses, editTarget, setEditTarget, serverIssues = [], stepErrors = {},
}) {
  const [drag, setDrag] = useState(null);
  const [dialogKey, setDialogKey] = useState(0);

  const updateSection = (si, patch) => onChange(sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setSteps = (si, steps) => updateSection(si, { steps });

  const openEditor = (si, ti, isNew = false) => { setDialogKey((k) => k + 1); setEditTarget({ si, ti, isNew }); };

  const issuesFor = (si, ti, code) => serverIssues.filter((i) =>
    (i.sectionIndex === si && i.stepIndex === ti) || (i.sectionIndex == null && code && i.stepCode === code));

  const onDrop = (si, ti) => {
    if (!drag || readOnly) return;
    const { si: fsi, ti: fti } = drag;
    setDrag(null);
    if (fsi === si) { setSteps(si, move(sections[si].steps, fti, ti)); return; }
    const step = sections[fsi].steps[fti];
    onChange(sections.map((s, i) => {
      if (i === fsi) return { ...s, steps: s.steps.filter((_, j) => j !== fti) };
      if (i === si) { const st = [...s.steps]; st.splice(ti, 0, step); return { ...s, steps: st }; }
      return s;
    }));
  };

  const target = editTarget && sections[editTarget.si]
    ? (editTarget.isNew ? emptyStep() : sections[editTarget.si].steps[editTarget.ti])
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {sections.length === 0 && (
        <DataCard>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, mb: readOnly ? 0 : 2 }}>
            No sections yet. A typical runbook has Pre-checks → Execution → Verification → Close-out.
          </Typography>
          {!readOnly && (
            <Button variant="outlined" size="small" onClick={() => onChange(SECTION_TYPES.map((t) => ({ ...emptySection(t.value), title: t.label })))}>
              Add the four standard sections
            </Button>
          )}
        </DataCard>
      )}

      {sections.map((s, si) => (
        <DataCard
          key={s._key}
          title={(
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ fontFamily: TL.mono, color: TL.gray400 }}>{si + 1}</Box>
              {s.title || labelOf(SECTION_TYPES, s.sectionType)}
              <StatusBadge label={labelOf(SECTION_TYPES, s.sectionType)} tone="blue" />
            </Box>
          )}
          actions={!readOnly && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ArrowBtn up title="Move section up" disabled={si === 0} onClick={() => onChange(move(sections, si, si - 1))} />
              <ArrowBtn title="Move section down" disabled={si === sections.length - 1} onClick={() => onChange(move(sections, si, si + 1))} />
              <Tooltip title="Delete section">
                <IconButton size="small" onClick={() => {
                  if (s.steps.length && !window.confirm(`Delete section "${s.title || s.sectionType}" and its ${s.steps.length} step(s)?`)) return;
                  onChange(sections.filter((_, i) => i !== si));
                }}><TrashIcon size={16} /></IconButton>
              </Tooltip>
            </Box>
          )}
        >
          {!readOnly && (
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth select size="small" label="Section type" value={s.sectionType}
                  onChange={(e) => updateSection(si, { sectionType: e.target.value })}>
                  {SECTION_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth size="small" label="Section title" value={s.title}
                  onChange={(e) => updateSection(si, { title: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField fullWidth size="small" label="Description" value={s.description}
                  onChange={(e) => updateSection(si, { description: e.target.value })} />
              </Grid>
            </Grid>
          )}
          {readOnly && s.description && (
            <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500, mb: 1.5 }}>{s.description}</Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
            onDragOver={(e) => { if (drag) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (drag && s.steps.length === 0) onDrop(si, 0); }}>
            {s.steps.length === 0 && (
              <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500, py: 1 }}>No steps in this section.</Typography>
            )}
            {s.steps.map((st, ti) => {
              const hints = lintStep(st);
              const srv = issuesFor(si, ti, st.stepCode);
              const errCount = srv.filter((i) => i.severity === 'ERROR').length + hints.filter((h) => h.severity === 'ERROR').length;
              const warnCount = srv.filter((i) => i.severity !== 'ERROR').length + hints.filter((h) => h.severity !== 'ERROR').length;
              const stepErr = stepErrors[st._key];
              return (
                <Box key={st._key}
                  draggable={!readOnly}
                  onDragStart={() => setDrag({ si, ti })}
                  onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => { if (drag) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(si, ti); }}
                  sx={{
                    p: 1.5, border: `1px solid ${stepErr ? TL.error : TL.gray100}`, borderRadius: '8px',
                    bgcolor: drag && drag.si === si && drag.ti === ti ? TL.gray50 : '#fff',
                    cursor: readOnly ? 'default' : 'grab',
                  }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ fontFamily: TL.mono, fontSize: '0.8125rem', color: TL.gray500, minWidth: 36, pt: '2px' }}>
                      {st.stepCode || autoStepCode(si, ti)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>
                        {st.title || <em style={{ color: TL.gray400 }}>Untitled step</em>}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {st.instructionMd}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                        {st.assignedRole && <StatusBadge label={humanize(st.assignedRole)} tone="gray" />}
                        {st.blocking && <StatusBadge label="Blocking" tone="orange" />}
                        {st.dualControl && <StatusBadge label="Dual control" tone="purple" />}
                        {st.allowSkip && <StatusBadge label="Skippable" tone="gray" />}
                        {st.commandBlock && <StatusBadge label={`Command · ${st.commandLang}`} tone="teal" />}
                        <StatusBadge label={`${st.evidenceReqs.length} evidence`} tone={st.evidenceReqs.length ? 'green' : 'gray'} />
                        {st.clauseIds?.length > 0 && <StatusBadge label={`${st.clauseIds.length} clause(s)`} tone="blue" />}
                        {st.durationEstimateMin != null && <StatusBadge label={`~${st.durationEstimateMin}m`} tone="gray" />}
                        {errCount > 0 && <StatusBadge label={`${errCount} error`} tone="red" dot />}
                        {warnCount > 0 && <StatusBadge label={`${warnCount} warn`} tone="amber" dot />}
                      </Box>
                      {stepErr && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{stepErr}</Alert>}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {!readOnly && (
                        <>
                          <ArrowBtn up title="Move up" disabled={ti === 0} onClick={() => setSteps(si, move(s.steps, ti, ti - 1))} />
                          <ArrowBtn title="Move down" disabled={ti === s.steps.length - 1} onClick={() => setSteps(si, move(s.steps, ti, ti + 1))} />
                        </>
                      )}
                      <Tooltip title={readOnly ? 'View' : 'Edit'}>
                        <IconButton size="small" onClick={() => openEditor(si, ti)}>
                          {readOnly ? <EyeIcon size={16} /> : <PencilSquareIcon size={16} />}
                        </IconButton>
                      </Tooltip>
                      {!readOnly && (
                        <Tooltip title="Delete step">
                          <IconButton size="small" onClick={() => {
                            if (!window.confirm(`Delete step ${st.stepCode} "${st.title}"?`)) return;
                            setSteps(si, s.steps.filter((_, j) => j !== ti));
                          }}><TrashIcon size={16} /></IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
          {!readOnly && (
            <Button size="small" startIcon={<PlusIcon size={14} />} sx={{ mt: 1.5 }}
              onClick={() => openEditor(si, s.steps.length, true)}>
              Add step
            </Button>
          )}
        </DataCard>
      ))}

      {!readOnly && sections.length > 0 && (
        <Box>
          <Button variant="outlined" size="small" startIcon={<PlusIcon size={14} />}
            onClick={() => {
              const used = new Set(sections.map((x) => x.sectionType));
              const next = SECTION_TYPES.find((t) => !used.has(t.value)) || SECTION_TYPES[1];
              onChange([...sections, { ...emptySection(next.value), title: next.label }]);
            }}>
            Add section
          </Button>
        </Box>
      )}

      {target && (
        <StepDialog
          key={dialogKey}
          open
          step={target}
          isNew={!!editTarget.isNew}
          autoCode={autoStepCode(editTarget.si, editTarget.ti)}
          readOnly={readOnly}
          mappedClauses={mappedClauses}
          serverIssues={editTarget.isNew ? [] : issuesFor(editTarget.si, editTarget.ti, target.stepCode)}
          saveError={editTarget.isNew ? '' : stepErrors[target._key]}
          onClose={() => setEditTarget(null)}
          onSave={(step) => {
            const { si, ti, isNew } = editTarget;
            const steps = isNew ? [...sections[si].steps, step] : sections[si].steps.map((x, j) => (j === ti ? step : x));
            setSteps(si, steps);
            setEditTarget(null);
          }}
        />
      )}
    </Box>
  );
}
