import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, Breadcrumbs, Link,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Edit, Block, AccountBalance, Assignment, Description as DescriptionIcon,
  Category, EventAvailable, Info,
} from '@mui/icons-material';
import { api } from '../services/api';
import { Section, Field, FieldGrid, StatTile } from '../components/detailKit';
import RegulatorFormDialog from '../components/modals/RegulatorFormDialog';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RegulatorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = ['TENANT_ADMIN', 'CCO'].includes(user?.role);

  const [editOpen, setEditOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const detailQuery = useQuery({
    queryKey: ['regulators', 'detail', String(id)],
    queryFn: ({ signal }) => api.regulators.get(id, { signal }),
    enabled: id != null,
    staleTime: 60 * 1000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['regulators'] });
    detailQuery.refetch();
  };

  async function handleDisable() {
    try {
      await api.regulators.disable(id);
      setDisableOpen(false);
      refresh();
    } catch (e) { setSnackbar(e.message); }
  }

  if (detailQuery.isPending) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{detailQuery.error?.message || 'Failed to load regulator.'}</Alert>
        <Button onClick={() => navigate('/regulators')}>Back to Regulators</Button>
      </Box>
    );
  }

  const r = detailQuery.data;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => navigate('/regulators')}>
          Regulators
        </Link>
        <Typography color="text.primary">{r.abbreviation || r.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">{r.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            {r.abbreviation && (
              <Typography variant="body2" sx={{ color: '#A0AEC0', fontFamily: 'Roboto Mono, monospace' }}>
                {r.abbreviation}
              </Typography>
            )}
            <Chip size="small" label={r.isActive ? 'Active' : 'Inactive'}
              color={r.isActive ? 'success' : 'default'}
              variant={r.isActive ? 'outlined' : 'filled'}
              sx={{ height: 22, borderRadius: '4px', fontSize: '0.72rem' }} />
            {r.platformRegulatorId != null && (
              <Chip size="small" label={`Platform #${r.platformRegulatorId}`} variant="outlined"
                sx={{ height: 22, borderRadius: '4px', fontSize: '0.72rem' }} />
            )}
          </Box>
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditOpen(true)}>Edit</Button>
            {r.isActive && (
              <Button variant="outlined" color="error" startIcon={<Block />} onClick={() => setDisableOpen(true)}>
                Disable
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatTile icon={<Assignment fontSize="small" />} label="Linked Obligations" value={r.obligationCount ?? 0} accent="#2B6CB0" />
        <StatTile icon={<EventAvailable fontSize="small" />} label="Linked Returns" value={r.returnCount ?? 0} accent="#2C7A7B" />
        <StatTile icon={<AccountBalance fontSize="small" />} label="Status" chip={
          <Chip size="small" label={r.isActive ? 'Active' : 'Inactive'}
            color={r.isActive ? 'success' : 'default'} sx={{ height: 22, borderRadius: '4px' }} />
        } />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <Box>
          <Section icon={<DescriptionIcon fontSize="small" />} title="About this Regulator">
            {r.description
              ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.description}</Typography>
              : <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>No description recorded.</Typography>}
          </Section>
        </Box>

        <Box>
          <Section icon={<Category fontSize="small" />} title="Details">
            <FieldGrid min={130}>
              <Field label="Name" value={r.name} />
              <Field label="Abbreviation" value={r.abbreviation} mono />
              <Field label="Platform Regulator ID" value={r.platformRegulatorId != null ? String(r.platformRegulatorId) : null} />
              <Field label="Status" value={r.isActive ? 'Active' : 'Inactive'} />
            </FieldGrid>
          </Section>

          <Section icon={<Info fontSize="small" />} title="Record">
            <FieldGrid min={130}>
              <Field label="Created" value={formatDate(r.createdAt)} />
              <Field label="Updated" value={formatDate(r.updatedAt)} />
            </FieldGrid>
          </Section>
        </Box>
      </Box>

      <RegulatorFormDialog open={editOpen} regulator={r} onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); refresh(); }} />

      <Dialog open={disableOpen} onClose={() => setDisableOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Disable Regulator</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Disable <strong>{r.name}</strong>? It will be marked inactive and stop receiving updates.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDisable}>Disable</Button>
        </DialogActions>
      </Dialog>

      {snackbar && <Alert severity="error" onClose={() => setSnackbar('')}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}