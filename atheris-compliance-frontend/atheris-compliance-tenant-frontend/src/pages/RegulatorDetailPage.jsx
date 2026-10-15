import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Block } from '@mui/icons-material';
import {
  PageHeader, StateBadge, TL,
  PencilSquareIcon, BuildingLibraryIcon, ClipboardDocumentListIcon, DocumentTextIcon,
  Squares2x2Icon, CalendarDaysIcon, InformationCircleIcon,
} from 'shared';
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
        <Button variant="outlined" onClick={() => navigate('/regulators')}>Back to Regulators</Button>
      </Box>
    );
  }

  const r = detailQuery.data;

  return (
    <Box>
      <PageHeader
        title={r.name}
        onBack={() => navigate('/regulators')}
        backLabel="Back to Regulators"
        subtitle={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {r.abbreviation && (
              <Typography component="span" sx={{ color: TL.gray500, fontFamily: TL.mono, fontSize: '0.75rem' }}>
                {r.abbreviation}
              </Typography>
            )}
            <StateBadge value={r.isActive ? 'Active' : 'Inactive'} />
            {r.platformRegulatorId != null && (
              <Chip size="small" label={`Platform #${r.platformRegulatorId}`} variant="outlined" />
            )}
          </Box>
        )}
        actions={canManage ? (
          <>
            <Button variant="outlined" startIcon={<PencilSquareIcon size={16} />} onClick={() => setEditOpen(true)}>Edit</Button>
            {r.isActive && (
              <Button variant="outlined" color="error" startIcon={<Block fontSize="small" />} onClick={() => setDisableOpen(true)}>
                Disable
              </Button>
            )}
          </>
        ) : null}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 3 }}>
        <StatTile icon={<ClipboardDocumentListIcon />} label="Linked Obligations" value={r.obligationCount ?? 0} accent={TL.primary} />
        <StatTile icon={<CalendarDaysIcon />} label="Linked Returns" value={r.returnCount ?? 0} accent={TL.info} />
        <StatTile icon={<BuildingLibraryIcon />} label="Status" accent={TL.success} chip={
          <StateBadge value={r.isActive ? 'Active' : 'Inactive'} />
        } />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, alignItems: 'start' }}>
        <Box>
          <Section icon={<DocumentTextIcon size={18} />} title="About this Regulator">
            {r.description
              ? <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.7, color: TL.gray700 }}>{r.description}</Typography>
              : <Typography sx={{ fontStyle: 'italic', fontSize: '0.875rem', color: TL.gray400 }}>No description recorded.</Typography>}
          </Section>
        </Box>

        <Box>
          <Section icon={<Squares2x2Icon size={18} />} title="Details">
            <FieldGrid min={130}>
              <Field label="Name" value={r.name} />
              <Field label="Abbreviation" value={r.abbreviation} mono />
              <Field label="Platform Regulator ID" value={r.platformRegulatorId != null ? String(r.platformRegulatorId) : null} />
              <Field label="Status" value={r.isActive ? 'Active' : 'Inactive'} />
            </FieldGrid>
          </Section>

          <Section icon={<InformationCircleIcon size={18} />} title="Record">
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