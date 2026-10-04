import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Chip, Checkbox, Tooltip, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { api } from '../../services/api';
import {
  FREQUENCIES, RULE_LABELS, frequencyLabel, offsetAllowed, maxOffsetDays, prepDaysError, ruleError,
} from './scheduleRules';

const DUE_DATE_NEEDED = 'Due date needed';
const UNKNOWN = 'Not set';
const HEAD_SX = { fontWeight: 700, bgcolor: '#F7FAFC' };
const CHIP_SX = { height: 22, borderRadius: '4px', fontWeight: 600 };
const COMPACT_INPUT_SX = { '& .MuiInputBase-input': { py: 0.75, fontSize: 13 } };

// Draft of one row's schedule. ruleType '' = not set (row is not sent).
function initialDraft(item) {
  const ruleType = item?.dueRuleType === 'DATE' || item?.dueRuleType === 'OFFSET' ? item.dueRuleType : '';
  return {
    // Only rows without a frequency type pick one here; '' means "keep".
    frequency: item?.frequencyType ? '' : frequencyLabel(item),
    ruleType,
    firstDueDate: item?.firstDueDate || '',
    daysAfterPeriodEnd: item?.daysAfterPeriodEnd != null ? String(item.daysAfterPeriodEnd) : '',
    prepDays: '',
  };
}

function effectiveFrequency(item, draft) {
  return item?.frequencyType ? frequencyLabel(item) : draft.frequency;
}

function ruleAllowed(frequency, ruleType) {
  if (frequency === 'Event-driven') return false;
  if (ruleType === 'OFFSET') return offsetAllowed(frequency);
  return true;
}

// '' when the row (with a rule set) is valid.
function rowError(item, draft) {
  const frequency = effectiveFrequency(item, draft);
  if (!frequency) return 'Choose a frequency.';
  if (frequency === 'Event-driven') return 'Event-driven returns have no due rule.';
  const prepErr = prepDaysError(draft.prepDays);
  if (prepErr) return prepErr;
  return ruleError(frequency, draft.ruleType, draft.firstDueDate, draft.daysAfterPeriodEnd);
}

// Incomplete = the only problem is a value not entered yet (shown softly until a save attempt).
function isIncomplete(draft) {
  return (draft.ruleType === 'DATE' && !draft.firstDueDate)
    || (draft.ruleType === 'OFFSET' && draft.daysAfterPeriodEnd === '');
}

function buildItem(item, draft) {
  return {
    returnId: item.returnId,
    frequency: !item.frequencyType && draft.frequency ? draft.frequency : null,
    ruleType: draft.ruleType,
    firstDueDate: draft.ruleType === 'DATE' ? draft.firstDueDate : null,
    daysAfterPeriodEnd: draft.ruleType === 'OFFSET' ? Number(draft.daysAfterPeriodEnd) : null,
    prepDays: draft.prepDays === '' ? null : Number(draft.prepDays),
  };
}

export default function BulkDueDatesDialog({ open, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [freqFilter, setFreqFilter] = useState('All');
  const [serverErrors, setServerErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState(null); // { severity, text }
  const [bulk, setBulk] = useState({ ruleType: 'DATE', value: '', prepDays: '' });

  const listQuery = useQuery({
    queryKey: ['returns', 'due-date-needed'],
    queryFn: ({ signal }) => api.returns.register({ status: DUE_DATE_NEEDED, size: 500 }, { signal }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (items) => api.returns.updateSchedules(items),
    onSuccess: (res, items) => {
      const ids = new Set(items.map(i => i.returnId));
      setDrafts(d => Object.fromEntries(Object.entries(d).filter(([id]) => !ids.has(Number(id)))));
      setSelected(s => new Set([...s].filter(id => !ids.has(id))));
      setServerErrors({});
      setAttempted(false);
      const n = res?.updated ?? items.length;
      setNotice({ severity: 'success', text: `Saved ${n} schedule${n === 1 ? '' : 's'}.` });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.(n);
    },
    onError: (err) => {
      const rowErrors = err?.data?.rowErrors;
      if (Array.isArray(rowErrors) && rowErrors.length) {
        setServerErrors(Object.fromEntries(rowErrors.map(r => [r.returnId, r.message])));
      }
      setNotice({ severity: 'error', text: err?.message || 'Failed to save schedules.' });
    },
  });

  useEffect(() => {
    if (open) {
      setDrafts({}); setSelected(new Set()); setFreqFilter('All');
      setServerErrors({}); setAttempted(false); setNotice(null);
      setBulk({ ruleType: 'DATE', value: '', prepDays: '' });
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const items = useMemo(() => listQuery.data?.content || [], [listQuery.data]);
  const draftOf = (item) => drafts[item.returnId] || initialDraft(item);

  const visible = useMemo(() => items.filter(item => {
    if (freqFilter === 'All') return true;
    const f = effectiveFrequency(item, drafts[item.returnId] || initialDraft(item)) || UNKNOWN;
    return f === freqFilter;
  }), [items, drafts, freqFilter]);

  const rows = items.map(item => {
    const draft = draftOf(item);
    const isSet = !!draft.ruleType;
    const err = isSet ? rowError(item, draft) : '';
    return { item, draft, isSet, err };
  });
  const setRows = rows.filter(r => r.isSet);
  const readyCount = setRows.filter(r => !r.err).length;

  function updateDraft(item, patch) {
    setDrafts(d => {
      const next = { ...(d[item.returnId] || initialDraft(item)), ...patch };
      // A rule the new frequency cannot use is cleared.
      if (patch.frequency !== undefined && next.ruleType
        && !ruleAllowed(effectiveFrequency(item, next), next.ruleType)) next.ruleType = '';
      return { ...d, [item.returnId]: next };
    });
    setServerErrors(e => {
      if (!(item.returnId in e)) return e;
      const { [item.returnId]: _removed, ...rest } = e;
      return rest;
    });
  }

  const visibleIds = visible.map(i => i.returnId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const someVisibleSelected = visibleIds.some(id => selected.has(id));

  function toggleAllVisible() {
    setSelected(s => {
      const next = new Set(s);
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  }

  function toggleOne(id) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const bulkValueError = bulk.ruleType === 'DATE'
    ? (!bulk.value ? 'Enter a date' : '')
    : (bulk.value === '' || !Number.isInteger(Number(bulk.value)) || Number(bulk.value) < 1 ? 'Enter days' : '');
  const bulkError = bulkValueError || prepDaysError(bulk.prepDays);

  function applyToSelected() {
    let applied = 0;
    let skipped = 0;
    items.forEach(item => {
      if (!selected.has(item.returnId)) return;
      const frequency = effectiveFrequency(item, draftOf(item));
      if (!ruleAllowed(frequency, bulk.ruleType)) { skipped += 1; return; }
      const patch = { ruleType: bulk.ruleType };
      if (bulk.ruleType === 'DATE') patch.firstDueDate = bulk.value;
      else patch.daysAfterPeriodEnd = bulk.value;
      if (bulk.prepDays !== '') patch.prepDays = bulk.prepDays;
      updateDraft(item, patch);
      applied += 1;
    });
    setNotice({
      severity: skipped ? 'warning' : 'info',
      text: `Applied "${RULE_LABELS[bulk.ruleType]}" to ${applied} return${applied === 1 ? '' : 's'}`
        + (skipped ? `; skipped ${skipped} that cannot use this rule.` : '.'),
    });
  }

  function handleSave() {
    setAttempted(true);
    const invalid = setRows.filter(r => r.err);
    if (invalid.length) {
      setNotice({ severity: 'error', text: `${invalid.length} row${invalid.length === 1 ? ' needs' : 's need'} fixing before saving.` });
      return;
    }
    if (!setRows.length) return;
    setNotice(null);
    mutation.mutate(setRows.map(r => buildItem(r.item, r.draft)));
  }

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  const filterOptions = ['All', ...FREQUENCIES.filter(f => f !== 'Event-driven'), UNKNOWN];
  const total = items.length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Set due dates
        <Typography variant="body2" color="text.secondary">
          Returns without a due rule have no scheduled periods. Set a fixed first due date or a number of days after period end.
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {notice && (
          <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>
        )}

        {/* Toolbar */}
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button size="small" onClick={toggleAllVisible} disabled={!visibleIds.length}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {allVisibleSelected ? 'Clear selection' : 'Select all'}
          </Button>
          <TextField select size="small" label="Frequency" value={freqFilter}
            onChange={e => setFreqFilter(e.target.value)} sx={{ minWidth: 140 }}>
            {filterOptions.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
          </TextField>
          <Divider orientation="vertical" flexItem />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Apply to {selected.size} selected:
          </Typography>
          <TextField select size="small" label="Rule" value={bulk.ruleType}
            onChange={e => setBulk(b => ({ ...b, ruleType: e.target.value, value: '' }))} sx={{ minWidth: 190 }}>
            <MenuItem value="DATE">{RULE_LABELS.DATE}</MenuItem>
            <MenuItem value="OFFSET">{RULE_LABELS.OFFSET}</MenuItem>
          </TextField>
          {bulk.ruleType === 'DATE' ? (
            <TextField size="small" type="date" label="First due date" value={bulk.value}
              onChange={e => setBulk(b => ({ ...b, value: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 165 }} />
          ) : (
            <TextField size="small" type="number" label="Days" value={bulk.value}
              onChange={e => setBulk(b => ({ ...b, value: e.target.value }))}
              slotProps={{ htmlInput: { min: 1, max: 365 } }} sx={{ width: 90 }} />
          )}
          <TextField size="small" type="number" label="Prep days" value={bulk.prepDays}
            placeholder="keep" onChange={e => setBulk(b => ({ ...b, prepDays: e.target.value }))}
            slotProps={{ htmlInput: { min: 0 }, inputLabel: { shrink: true } }} sx={{ width: 100 }} />
          <Button variant="outlined" size="small" onClick={applyToSelected}
            disabled={!selected.size || !!bulkError || mutation.isPending}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Apply
          </Button>
        </Paper>

        {listQuery.isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : listQuery.error ? (
          <Alert severity="error" action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
            {listQuery.error.message || 'Failed to load returns.'}
          </Alert>
        ) : total === 0 ? (
          <Paper variant="outlined" sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="body1">Every return has a due date.</Typography>
          </Paper>
        ) : (
          <Paper variant="outlined">
            <TableContainer sx={{ maxHeight: '55vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={HEAD_SX}>
                      <Checkbox size="small" checked={allVisibleSelected}
                        indeterminate={!allVisibleSelected && someVisibleSelected}
                        onChange={toggleAllVisible} />
                    </TableCell>
                    <TableCell sx={{ ...HEAD_SX, minWidth: 240 }}>Return</TableCell>
                    <TableCell sx={{ ...HEAD_SX, minWidth: 120 }}>Frequency</TableCell>
                    <TableCell sx={{ ...HEAD_SX, minWidth: 180 }}>Regulator wording</TableCell>
                    <TableCell sx={{ ...HEAD_SX, minWidth: 320 }}>Due rule</TableCell>
                    <TableCell sx={{ ...HEAD_SX, minWidth: 140 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map(item => {
                    const draft = draftOf(item);
                    const frequency = effectiveFrequency(item, draft);
                    const isSet = !!draft.ruleType;
                    const clientErr = isSet ? rowError(item, draft) : '';
                    const serverErr = serverErrors[item.returnId];
                    const hasError = !!serverErr || (!!clientErr && (attempted || !isIncomplete(draft)));
                    const canOffset = offsetAllowed(frequency);
                    const ruleDisabled = frequency === 'Event-driven' || mutation.isPending;
                    return (
                      <TableRow key={item.returnId} hover selected={selected.has(item.returnId)}
                        sx={{ borderLeft: hasError ? '3px solid #E53E3E' : '3px solid transparent',
                          bgcolor: hasError ? '#FFF5F5' : 'inherit' }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.has(item.returnId)}
                            onChange={() => toggleOne(item.returnId)} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Tooltip title={item.returnName || 'Untitled'}>
                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.returnName || 'Untitled'}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary">{item.filingRegulator || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          {item.frequencyType ? (
                            <Typography variant="body2">{frequency || item.frequency || '—'}</Typography>
                          ) : (
                            <TextField select size="small" value={draft.frequency} sx={{ minWidth: 120, ...COMPACT_INPUT_SX }}
                              disabled={mutation.isPending}
                              onChange={e => updateDraft(item, { frequency: e.target.value })}
                              slotProps={{ select: { displayEmpty: true } }}>
                              <MenuItem value=""><em>Choose…</em></MenuItem>
                              {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                            </TextField>
                          )}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          {item.deadlineText ? (
                            <Tooltip title={item.deadlineText}>
                              <Typography variant="body2" color="text.secondary"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.deadlineText}
                              </Typography>
                            </Tooltip>
                          ) : <Typography variant="body2" color="text.secondary">—</Typography>}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField select size="small" value={draft.ruleType} disabled={ruleDisabled}
                              onChange={e => updateDraft(item, { ruleType: e.target.value })}
                              slotProps={{ select: { displayEmpty: true } }}
                              sx={{ minWidth: 165, ...COMPACT_INPUT_SX }}>
                              <MenuItem value="">Not set</MenuItem>
                              <MenuItem value="DATE">{RULE_LABELS.DATE}</MenuItem>
                              {canOffset && <MenuItem value="OFFSET">{RULE_LABELS.OFFSET}</MenuItem>}
                            </TextField>
                            {draft.ruleType === 'DATE' && (
                              <TextField size="small" type="date" value={draft.firstDueDate}
                                disabled={mutation.isPending}
                                onChange={e => updateDraft(item, { firstDueDate: e.target.value })}
                                sx={{ width: 150, ...COMPACT_INPUT_SX }} />
                            )}
                            {draft.ruleType === 'OFFSET' && (
                              <TextField size="small" type="number" value={draft.daysAfterPeriodEnd}
                                placeholder="days" disabled={mutation.isPending}
                                onChange={e => updateDraft(item, { daysAfterPeriodEnd: e.target.value })}
                                slotProps={{ htmlInput: { min: 1, max: maxOffsetDays(frequency) } }}
                                sx={{ width: 90, ...COMPACT_INPUT_SX }} />
                            )}
                          </Box>
                          {isSet && draft.prepDays !== '' && (
                            <Typography variant="caption" color="text.secondary">Prep days: {draft.prepDays}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasError ? (
                            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, display: 'block', maxWidth: 220 }}>
                              {serverErr || clientErr}
                            </Typography>
                          ) : !isSet ? (
                            <Chip size="small" label="Not set" variant="outlined" sx={CHIP_SX} />
                          ) : clientErr ? (
                            <Chip size="small" label="Incomplete" color="warning" variant="outlined" sx={CHIP_SX} />
                          ) : (
                            <Chip size="small" label="Ready" color="success" sx={CHIP_SX} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visible.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No returns match this frequency.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto', fontWeight: 600 }}>
          {readyCount} of {total} ready
        </Typography>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={readyCount === 0 || mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}>
          Save {readyCount} schedule{readyCount === 1 ? '' : 's'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
