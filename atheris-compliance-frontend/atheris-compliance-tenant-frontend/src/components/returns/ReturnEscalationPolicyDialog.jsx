import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  CircularProgress, Typography,
} from '@mui/material';
import { api } from '../../services/api';

export default function ReturnEscalationPolicyDialog({ open, item, onClose, onSnackbar, onSaved }) {
  const qc = useQueryClient();
  const [policyId, setPolicyId] = useState(item?.escalationPolicyId ? String(item.escalationPolicyId) : '');

  const policiesQuery = useQuery({
    queryKey: ['escalation', 'policies', 'RETURN'],
    queryFn: () => api.escalation.policies('RETURN'),
    enabled: open,
  });
  const policies = Array.isArray(policiesQuery.data) ? policiesQuery.data : [];

  const saveMut = useMutation({
    mutationFn: (pid) => api.returns.updateEscalationPolicy(item.returnId, pid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['returns'] }); onSaved?.(); onClose(); },
    onError: (e) => onSnackbar?.(e.message),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Return escalation policy</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The policy applied to filings created from here on. Existing filings keep the escalation copied
          when they were generated — edit those from the Filings tab.
        </Typography>
        {policiesQuery.isPending ? <CircularProgress size={22} /> : (
          <TextField select fullWidth size="small" label="Escalation policy" value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}>
            <MenuItem value=""><em>Tenant default</em></MenuItem>
            {policies.map((p) => (
              <MenuItem key={p.policyId} value={String(p.policyId)}>
                {p.name}{p.isDefault ? ' (default)' : ''}
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saveMut.isPending || policiesQuery.isPending}
          onClick={() => saveMut.mutate(policyId ? Number(policyId) : null)}>
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
