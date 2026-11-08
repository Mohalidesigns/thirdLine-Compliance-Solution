import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Typography, Alert, CircularProgress, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import { DataCard, PlusIcon, PencilSquareIcon } from 'shared';
import { api } from '../../services/api';

export default function ThemesTab() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');

  const themesQuery = useQuery({
    queryKey: ['control-themes'],
    queryFn: ({ signal }) => api.controlThemes.list({ signal }),
  });

  const save = useMutation({
    mutationFn: (t) => (t.themeId ? api.controlThemes.update(t.themeId, t) : api.controlThemes.create(t)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['control-themes'] }); setEdit(null); setError(''); },
    onError: (e) => setError(e.message || 'Could not save the theme.'),
  });

  const themes = themesQuery.data || [];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Themes group controls. A theme here is what the Add/Edit Control dropdown offers; the toolkit seed
        also registers any new theme it carries. Renaming a theme updates every control that uses it.
      </Typography>
      <DataCard
        title="Control themes"
        actions={(
          <Button size="small" variant="contained" startIcon={<PlusIcon size={16} />}
            onClick={() => setEdit({ name: '', description: '' })}>New theme</Button>
        )}>
        {themesQuery.isPending ? <CircularProgress size={22} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Used by</TableCell>
                  <TableCell sx={{ width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {themes.map((t) => (
                  <TableRow key={t.themeId} hover>
                    <TableCell>
                      {t.name}
                      {t.isActive === false && <Chip size="small" label="Inactive" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{t.description || '—'}</Typography></TableCell>
                    <TableCell align="right">{t.usedBy ?? 0}</TableCell>
                    <TableCell>
                      <IconButton size="small" aria-label={`Edit ${t.name}`} onClick={() => setEdit(t)}>
                        <PencilSquareIcon size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {themes.length === 0 && (
                  <TableRow><TableCell colSpan={4}><Typography variant="body2" color="text.secondary">No themes yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataCard>

      {edit && (
        <ThemeDialog theme={edit} saving={save.isPending} onClose={() => setEdit(null)}
          onSave={(t) => save.mutate(t)} />
      )}
    </Box>
  );
}

function ThemeDialog({ theme, saving, onClose, onSave }) {
  const [name, setName] = useState(theme.name || '');
  const [description, setDescription] = useState(theme.description || '');
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{theme.themeId ? 'Edit theme' : 'New theme'}</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth size="small" margin="dense" label="Name" value={name}
          onChange={(e) => setName(e.target.value)} />
        <TextField fullWidth size="small" margin="dense" label="Description" multiline minRows={2}
          value={description} onChange={(e) => setDescription(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !name.trim()}
          onClick={() => onSave({ ...theme, name: name.trim(), description })}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
