import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, TL, RiskBadge } from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORIES, humanize, label } from '../../pages/runbooks/runbookConstants';

const toList = (d) => (Array.isArray(d) ? d : (d?.content || []));

/**
 * M2 — Adopt Template. Creates a tenant runbook (v1 draft) from a platform template with
 * provenance, then navigates to the new runbook. `template` is a TemplateSummaryDto
 * (TemplateDetailDto works too).
 */
function AdoptForm({ template, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const usersQuery = useQuery({
    queryKey: ['runbooks', 'assignees'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    staleTime: 60_000,
  });
  const obligationsQuery = useQuery({
    queryKey: ['obligations', 'picker-all'],
    queryFn: ({ signal }) => api.obligations.register({ size: 1000 }, { signal }),
    staleTime: 60_000,
  });
  const controlsQuery = useQuery({
    queryKey: ['controls', 'picker-all'],
    queryFn: () => api.controls.list({}),
    staleTime: 60_000,
  });

  const users = useMemo(() => toList(usersQuery.data).filter((u) => u.isActive !== false), [usersQuery.data]);
  const obligations = useMemo(() => toList(obligationsQuery.data), [obligationsQuery.data]);
  const controls = useMemo(() => toList(controlsQuery.data), [controlsQuery.data]);

  const [title, setTitle] = useState(template.title || '');
  const [ownerUserId, setOwnerUserId] = useState(user?.userId != null ? String(user.userId) : '');
  const [selObligations, setSelObligations] = useState([]);
  const [selControls, setSelControls] = useState([]);
  const [error, setError] = useState('');

  // Default owner = current user, but only if they are in the active-user list.
  const ownerValid = users.some((u) => String(u.userId) === ownerUserId);

  const adopt = useMutation({
    mutationFn: () => api.runbooks.templates.adopt(template.templateCode, {
      ownerUserId: Number(ownerUserId),
      title: title.trim() || undefined,
      obligationIds: selObligations.map((o) => o.obligationId),
      controlIds: selControls.map((c) => c.controlId),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['runbook-templates'] });
      queryClient.invalidateQueries({ queryKey: ['runbook-template', String(template.templateCode)] });
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      onClose();
      if (res?.runbookId != null) navigate(`/runbooks/${res.runbookId}`);
    },
    onError: (e) => setError(e.message || 'Could not adopt this template'),
  });

  const clauseRefs = template.clauseRefs || [];

  return (
    <>
      <DialogContent dividers>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ border: `1px solid ${TL.gray200}`, borderRadius: '8px', p: 1.5, mb: 2, bgcolor: TL.gray50 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Chip label={template.templateCode} size="small" variant="outlined"
              sx={{ height: 22, fontFamily: TL.mono, fontSize: '.7rem', borderRadius: '4px' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{template.title}</Typography>
            <StatusBadge label={`Template v${template.templateVersion ?? 1}`} tone="blue" />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {label(CATEGORIES, template.category)} · {humanize(template.frequency)} ·{' '}
            {template.stepCount ?? 0} steps in {template.sectionCount ?? 0} sections · {clauseRefs.length} clauses
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <RiskBadge value={humanize(template.criticality)} />
            {clauseRefs.slice(0, 8).map((c) => (
              <Chip key={c} label={c} size="small" sx={{ height: 22, fontSize: '.7rem' }} />
            ))}
            {clauseRefs.length > 8 && <Typography variant="caption" color="text.secondary">+{clauseRefs.length - 8} more</Typography>}
          </Box>
        </Box>

        <TextField
          label="Runbook title" size="small" fullWidth value={title}
          onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }}
          helperText="Rename for your organisation (optional)"
        />

        <TextField
          select required label="Owner" size="small" fullWidth sx={{ mb: 2 }}
          value={ownerValid ? ownerUserId : ''}
          onChange={(e) => setOwnerUserId(e.target.value)}
          error={!usersQuery.isLoading && !ownerValid}
          helperText={usersQuery.isError ? `Could not load users: ${usersQuery.error?.message}` : 'Accountable for the runbook (required)'}
        >
          {users.map((u) => (
            <MenuItem key={u.userId} value={String(u.userId)}>
              {u.fullName || u.email}
              {u.role && <Box component="span" sx={{ color: TL.gray400, ml: 1, fontSize: '.8rem' }}>{humanize(u.role)}</Box>}
            </MenuItem>
          ))}
        </TextField>

        <Autocomplete
          multiple size="small" sx={{ mb: 2 }}
          options={obligations}
          loading={obligationsQuery.isLoading}
          value={selObligations}
          onChange={(_, v) => setSelObligations(v)}
          isOptionEqualToValue={(o, v) => o.obligationId === v.obligationId}
          getOptionLabel={(o) => `#${o.obligationNumber ?? o.obligationId} ${o.title || o.description || 'Obligation'}`}
          renderOption={(props, o) => {
            const { key, ...rest } = props;
            return (
              <li key={key ?? o.obligationId} {...rest}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    #{o.obligationNumber ?? o.obligationId} {o.title || o.description || 'Obligation'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[o.sectionReference, o.regulatorAbbreviation || o.regulatorName, o.sourceTitle].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField {...params} label="Map to obligations" placeholder="Search obligations…"
              helperText="Optional — links this runbook to obligations in your register" />
          )}
        />

        <Autocomplete
          multiple size="small"
          options={controls}
          loading={controlsQuery.isLoading}
          value={selControls}
          onChange={(_, v) => setSelControls(v)}
          isOptionEqualToValue={(o, v) => o.controlId === v.controlId}
          getOptionLabel={(c) => `${c.controlNumber || `#${c.controlId}`} — ${c.name || 'Control'}`}
          renderInput={(params) => (
            <TextField {...params} label="Map to controls" placeholder="Search controls…"
              helperText="Optional — links this runbook to the controls it evidences" />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={adopt.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!ownerValid || adopt.isPending} onClick={() => adopt.mutate()}
          sx={{ textTransform: 'none', fontWeight: 600 }}>
          {adopt.isPending ? 'Adopting…' : 'Adopt template'}
        </Button>
      </DialogActions>
    </>
  );
}

export default function AdoptTemplateDialog({ open, onClose, template }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Adopt template</DialogTitle>
      {open && template && <AdoptForm key={template.templateCode} template={template} onClose={onClose} />}
    </Dialog>
  );
}
