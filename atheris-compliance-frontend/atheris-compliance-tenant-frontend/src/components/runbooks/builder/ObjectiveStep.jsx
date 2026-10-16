import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Grid, InputAdornment, List, ListItem,
  ListItemText, MenuItem, TextField, Tooltip, Typography,
} from '@mui/material';
import { DataCard, LinkIcon, MagnifyingGlassIcon, PlusIcon, TL } from 'shared';
import { api } from '../../../services/api';
import { CATEGORIES, CRITICALITIES, FREQUENCIES } from '../../../pages/runbooks/runbookConstants';
import LinkObligationsPicker from '../../modals/LinkObligationsPicker';
import LinkControlsPicker from '../../modals/LinkControlsPicker';

export const REVIEW_CADENCES = [
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'ANNUAL', label: 'Annual' },
];

/** Validation for the Step-1 metadata (M1: title ≥ 5 chars, category required). */
export function metaErrors(meta) {
  const e = {};
  if (!meta.title || meta.title.trim().length < 5) e.title = 'Title must be at least 5 characters.';
  if (!meta.category) e.category = 'Category is required.';
  if (!meta.criticality) e.criticality = 'Criticality is required.';
  if (!meta.frequency) e.frequency = 'Frequency is required.';
  if (meta.slaMinutes !== '' && meta.slaMinutes != null && (Number(meta.slaMinutes) < 1 || Number.isNaN(Number(meta.slaMinutes)))) {
    e.slaMinutes = 'SLA must be a positive number of minutes.';
  }
  return e;
}

const chipsInput = (label, value, onChange, readOnly, placeholder) => (
  <Autocomplete
    multiple freeSolo options={[]} value={value || []} disabled={readOnly}
    onChange={(_, v) => onChange(v.map((x) => String(x).trim()).filter(Boolean))}
    renderValue={(vals, getItemProps) => vals.map((opt, index) => {
      const { key, ...rest } = getItemProps({ index });
      return <Chip key={key} size="small" label={opt} {...rest} />;
    })}
    renderInput={(params) => (
      <TextField {...params} size="small" label={label} placeholder={readOnly ? '' : placeholder}
        helperText={readOnly ? undefined : 'Type and press Enter'} />
    )}
  />
);

export default function ObjectiveStep({
  meta, setMeta, errors = {}, readOnly, users = [], usersError, isNew,
  runbook, onClausesChange, onLinksChange, linkBusy,
}) {
  const set = (k) => (e) => setMeta({ [k]: e.target.value });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DataCard title="Objective & scope" subtitle="What this runbook achieves, who owns it and how often it runs.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth size="small" label="Title" required value={meta.title} onChange={set('title')}
              disabled={readOnly} error={!!errors.title} helperText={errors.title} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select size="small" label="Category" required value={meta.category}
              onChange={set('category')} disabled={readOnly} error={!!errors.category}
              helperText={errors.category}>
              {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select size="small" label="Criticality" required value={meta.criticality}
              onChange={set('criticality')} disabled={readOnly} error={!!errors.criticality}
              helperText={errors.criticality || ((meta.criticality === 'HIGH' || meta.criticality === 'CRITICAL')
                ? 'HIGH/CRITICAL need approval before publishing' : undefined)}>
              {CRITICALITIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select size="small" label="Owner" value={meta.ownerUserId ?? ''}
              onChange={(e) => setMeta({ ownerUserId: e.target.value === '' ? null : Number(e.target.value) })}
              disabled={readOnly} helperText={usersError ? 'User list unavailable for your role' : undefined}>
              <MenuItem value="">— Unassigned —</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.userId} value={u.userId}>{u.fullName || u.email}{u.role ? ` · ${u.role}` : ''}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select size="small" label="Frequency" required value={meta.frequency}
              onChange={set('frequency')} disabled={readOnly} error={!!errors.frequency} helperText={errors.frequency}>
              {FREQUENCIES.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" type="number" label="SLA (minutes)" value={meta.slaMinutes ?? ''}
              onChange={set('slaMinutes')} disabled={readOnly} error={!!errors.slaMinutes}
              helperText={errors.slaMinutes || 'Time allowed from start to completion'}
              slotProps={{ htmlInput: { min: 1 } }} />
          </Grid>
          {!isNew && (
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select size="small" label="Review cadence" value={meta.reviewCadence || ''}
                onChange={set('reviewCadence')} disabled={readOnly}>
                {REVIEW_CADENCES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={3} size="small" label="Objective" value={meta.objective}
              onChange={set('objective')} disabled={readOnly}
              placeholder="e.g. Confirm every active user on core banking still requires their access, and revoke what is not justified." />
          </Grid>
          {!isNew && (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                {chipsInput('Scope systems', meta.scopeSystems, (v) => setMeta({ scopeSystems: v }), readOnly, 'e.g. Active Directory')}
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                {chipsInput('Scope teams', meta.scopeTeams, (v) => setMeta({ scopeTeams: v }), readOnly, 'e.g. IT Operations')}
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                {chipsInput('Tags', meta.tags, (v) => setMeta({ tags: v }), readOnly, 'e.g. access')}
              </Grid>
            </>
          )}
        </Grid>
      </DataCard>

      {!isNew && runbook && (
        <>
          <ClauseMapper runbook={runbook} readOnly={readOnly} busy={linkBusy} onChange={onClausesChange} />
          <LinksCard runbook={runbook} readOnly={readOnly} busy={linkBusy} onChange={onLinksChange} />
        </>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------- M7 framework clause mapping

function ClauseMapper({ runbook, readOnly, busy, onChange }) {
  const [frameworkId, setFrameworkId] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: frameworks = [] } = useQuery({
    queryKey: ['runbooks', 'frameworks'],
    queryFn: ({ signal }) => api.runbooks.frameworks.list({ signal }),
    staleTime: 5 * 60_000,
  });
  const { data: clauses = [], isFetching } = useQuery({
    queryKey: ['runbooks', 'frameworks', String(frameworkId), 'clauses', debouncedQ],
    queryFn: ({ signal }) => api.runbooks.frameworks.clauses(frameworkId, debouncedQ ? { q: debouncedQ } : {}, { signal }),
    enabled: !!frameworkId && !readOnly,
    staleTime: 60_000,
  });

  const mapped = runbook.clauses || [];
  const mappedIds = useMemo(() => new Set(mapped.map((c) => c.clauseId)), [mapped]);
  const add = (c) => onChange([...mapped.map((m) => m.clauseId), c.clauseId]);
  const remove = (id) => onChange(mapped.map((m) => m.clauseId).filter((x) => x !== id));

  return (
    <DataCard title="Framework clauses" subtitle="Map at least one regulatory clause or internal policy (lint L7).">
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: mapped.length ? 2 : 0 }}>
        {mapped.length === 0 && (
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No clauses mapped yet.</Typography>
        )}
        {mapped.map((c) => (
          <Tooltip key={c.clauseId} title={c.requirementText || c.title || ''}>
            <Chip size="small" label={`${c.frameworkCode} ${c.clauseRef}${c.title ? ` — ${c.title}` : ''}`}
              onDelete={readOnly || busy ? undefined : () => remove(c.clauseId)}
              sx={{ maxWidth: 420 }} />
          </Tooltip>
        ))}
      </Box>
      {!readOnly && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select size="small" label="Framework" value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}>
              {frameworks.length === 0 && <MenuItem value="" disabled>No frameworks available</MenuItem>}
              {frameworks.map((f) => (
                <MenuItem key={f.frameworkId} value={f.frameworkId}>
                  {f.code} — {f.name}{f.internal ? ' (internal)' : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth size="small" label="Search clauses" value={q} onChange={(e) => setQ(e.target.value)}
              disabled={!frameworkId} placeholder="Clause ref, title or domain"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} /></InputAdornment>,
                endAdornment: isFetching ? <CircularProgress size={16} /> : null } }} />
          </Grid>
          {frameworkId && (
            <Grid size={{ xs: 12 }}>
              <List dense sx={{ maxHeight: 260, overflow: 'auto', border: `1px solid ${TL.gray100}`, borderRadius: '8px' }}>
                {clauses.length === 0 && !isFetching && (
                  <ListItem><ListItemText secondary="No clauses match." /></ListItem>
                )}
                {clauses.map((c) => {
                  const on = mappedIds.has(c.clauseId);
                  return (
                    <ListItem key={c.clauseId} divider
                      secondaryAction={(
                        <Button size="small" disabled={on || busy} onClick={() => add(c)}
                          startIcon={on ? null : <PlusIcon size={14} />}>
                          {on ? 'Mapped' : 'Add'}
                        </Button>
                      )}>
                      <ListItemText
                        primary={<><Box component="span" sx={{ fontFamily: TL.mono, fontSize: '0.75rem', mr: 1 }}>{c.clauseRef}</Box>{c.title}</>}
                        secondary={c.domain || undefined}
                        sx={{ pr: 10 }} />
                    </ListItem>
                  );
                })}
              </List>
            </Grid>
          )}
        </Grid>
      )}
    </DataCard>
  );
}

// ---------------------------------------------------------------- M8 obligation / control links

function LinksCard({ runbook, readOnly, busy, onChange }) {
  const [oblOpen, setOblOpen] = useState(false);
  const [ctlOpen, setCtlOpen] = useState(false);
  const obligationIds = useMemo(() => runbook.linkedObligationIds || [], [runbook.linkedObligationIds]);
  const controlIds = useMemo(() => runbook.linkedControlIds || [], [runbook.linkedControlIds]);
  const obligations = runbook.linkedObligations || [];
  const controls = runbook.linkedControls || [];

  const removeObl = (oid) => onChange({ obligationIds: obligationIds.filter((x) => x !== oid), controlIds });
  const removeCtl = (cid) => onChange({ obligationIds, controlIds: controlIds.filter((x) => x !== cid) });

  return (
    <DataCard title="Linked obligations & controls" subtitle="Which register obligations and controls this runbook operationalises.">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>Obligations ({obligationIds.length})</Typography>
            {!readOnly && (
              <Button size="small" startIcon={<LinkIcon size={14} />} disabled={busy} onClick={() => setOblOpen(true)}>Link</Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {obligationIds.length === 0 && <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>None linked.</Typography>}
            {obligationIds.map((oid) => {
              const o = obligations.find((x) => x.obligationId === oid);
              const lbl = o ? `${o.sectionReference ? `${o.sectionReference} · ` : ''}${o.title || `Obligation #${oid}`}` : `Obligation #${oid}`;
              return (
                <Chip key={oid} size="small" label={lbl} sx={{ maxWidth: 360 }}
                  onDelete={readOnly || busy ? undefined : () => removeObl(oid)} />
              );
            })}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>Controls ({controlIds.length})</Typography>
            {!readOnly && (
              <Button size="small" startIcon={<LinkIcon size={14} />} disabled={busy} onClick={() => setCtlOpen(true)}>Link</Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {controlIds.length === 0 && <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>None linked.</Typography>}
            {controlIds.map((cid) => {
              const c = controls.find((x) => x.controlId === cid);
              const lbl = c ? `${c.controlNumber ? `${c.controlNumber} — ` : ''}${c.name || ''}` : `Control #${cid}`;
              return (
                <Chip key={cid} size="small" label={lbl} sx={{ maxWidth: 360 }}
                  onDelete={readOnly || busy ? undefined : () => removeCtl(cid)} />
              );
            })}
          </Box>
        </Grid>
      </Grid>
      <LinkObligationsPicker open={oblOpen} onClose={() => setOblOpen(false)} initialIds={obligationIds}
        onSave={(ids) => onChange({ obligationIds: ids, controlIds })} />
      <LinkControlsPicker open={ctlOpen} onClose={() => setCtlOpen(false)} initialIds={controlIds}
        onSave={(ids) => onChange({ obligationIds, controlIds: ids })} />
    </DataCard>
  );
}
