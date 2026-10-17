import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  CATEGORIES, CRITICALITIES, FREQUENCIES, APPROVER_ROLES, humanize, label,
} from '../../pages/runbooks/runbookConstants';
import { errMsg } from './LibraryBadges';

const EMPTY = {
  templateCode: '', title: '', category: '', criticality: 'MEDIUM', ownerUserId: '',
  frequency: 'ON_DEMAND', slaMinutes: '', objective: '',
};

/**
 * M1 — Create Runbook. Either creates a blank runbook (POST /runbooks) or adopts a platform
 * template (POST /runbooks/templates/{code}/adopt, CCO/TENANT_ADMIN only). On success the
 * builder opens at /runbooks/:id/edit.
 */
export default function CreateRunbookDialog({ open, onClose, onCreated }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canAdopt = APPROVER_ROLES.includes(user?.role);
  const [form, setForm] = useState({ ...EMPTY, ownerUserId: user?.userId ?? '' });
  const [touched, setTouched] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['runbooks', 'assignees'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const templatesQuery = useQuery({
    queryKey: ['runbooks', 'templates'],
    queryFn: ({ signal }) => api.runbooks.templates.list({ signal }),
    enabled: open && canAdopt,
    staleTime: 5 * 60 * 1000,
  });

  const templates = templatesQuery.data || [];
  const users = (usersQuery.data || []).filter((u) => u.active !== false);
  const fromTemplate = !!form.templateCode;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickTemplate = (code) => {
    const t = templates.find((x) => x.templateCode === code);
    setForm((f) => (t ? {
      ...f, templateCode: code, title: f.title || t.title, category: t.category, criticality: t.criticality,
      frequency: t.frequency || f.frequency, slaMinutes: t.slaMinutes ?? '', objective: t.objective || '',
    } : { ...f, templateCode: '' }));
  };

  const titleError = form.title.trim().length < 5 ? 'Title must be at least 5 characters' : '';
  const categoryError = !form.category ? 'Category is required' : '';
  const ownerError = fromTemplate && !form.ownerUserId ? 'Owner is required when adopting a template' : '';
  const slaError = form.slaMinutes !== '' && (!Number.isInteger(Number(form.slaMinutes)) || Number(form.slaMinutes) <= 0)
    ? 'Enter a positive whole number of minutes' : '';
  const invalid = !!(titleError || categoryError || ownerError || slaError);

  const mutation = useMutation({
    mutationFn: () => {
      const ownerUserId = form.ownerUserId === '' ? null : Number(form.ownerUserId);
      if (fromTemplate) {
        return api.runbooks.templates.adopt(form.templateCode, { ownerUserId, title: form.title.trim() });
      }
      return api.runbooks.create({
        title: form.title.trim(),
        category: form.category,
        criticality: form.criticality,
        ownerUserId,
        frequency: form.frequency,
        slaMinutes: form.slaMinutes === '' ? null : Number(form.slaMinutes),
        objective: form.objective.trim() || null,
      });
    },
    onSuccess: (rb) => {
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      onCreated?.(rb);
      handleClose();
      if (rb?.runbookId != null) navigate(`/runbooks/${rb.runbookId}/edit`);
    },
  });

  function handleClose() {
    setForm({ ...EMPTY, ownerUserId: user?.userId ?? '' });
    setTouched(false);
    mutation.reset();
    onClose();
  }

  const submit = () => {
    setTouched(true);
    if (!invalid) mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Runbook</DialogTitle>
      <DialogContent dividers>
        {mutation.error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(mutation.error)}</Alert>}
        <Grid container spacing={2}>
          {canAdopt && (
            <Grid size={{ xs: 12 }}>
              <TextField select fullWidth size="small" label="Start from template?" value={form.templateCode}
                onChange={(e) => pickTemplate(e.target.value)}
                helperText={templatesQuery.isError ? 'Templates unavailable right now' : 'Optional — adopts the platform template as a new draft'}>
                <MenuItem value="">Blank runbook</MenuItem>
                {templates.map((t) => (
                  <MenuItem key={t.templateCode} value={t.templateCode} disabled={t.adopted}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{t.templateCode} — {t.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {label(CATEGORIES, t.category)} · {t.stepCount ?? 0} steps
                        {t.adopted ? ' · already adopted' : ''}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Title" required value={form.title} onChange={set('title')}
              error={touched && !!titleError} helperText={touched ? titleError : ''} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Category" required value={form.category}
              onChange={set('category')} disabled={fromTemplate}
              error={touched && !!categoryError} helperText={fromTemplate ? 'From template' : (touched ? categoryError : '')}>
              {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Criticality" value={form.criticality}
              onChange={set('criticality')} disabled={fromTemplate}
              helperText={fromTemplate ? 'From template' : 'HIGH / CRITICAL need CCO approval to publish'}>
              {CRITICALITIES.map((c) => <MenuItem key={c} value={c}>{humanize(c)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Owner" value={form.ownerUserId}
              onChange={set('ownerUserId')} required={fromTemplate}
              error={touched && !!ownerError} helperText={touched ? ownerError : ''}
              slotProps={{ input: { endAdornment: usersQuery.isFetching ? <CircularProgress size={16} sx={{ mr: 3 }} /> : null } }}>
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.userId} value={u.userId}>{u.fullName || u.email}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Frequency" value={form.frequency}
              onChange={set('frequency')} disabled={fromTemplate} helperText={fromTemplate ? 'From template' : ''}>
              {FREQUENCIES.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" type="number" label="SLA (minutes)" value={form.slaMinutes}
              onChange={set('slaMinutes')} disabled={fromTemplate}
              error={touched && !!slaError} helperText={touched && slaError ? slaError : 'Optional'} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" multiline minRows={3} label="Objective" value={form.objective}
              onChange={set('objective')} disabled={fromTemplate} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : (fromTemplate ? 'Adopt template' : 'Create & open builder')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
