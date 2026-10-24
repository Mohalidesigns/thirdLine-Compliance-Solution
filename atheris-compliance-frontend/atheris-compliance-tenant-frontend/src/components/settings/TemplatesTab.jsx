import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Alert, CircularProgress, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, TextField, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel, Tooltip,
} from '@mui/material';
import { DataCard, StateBadge, PencilSquareIcon } from 'shared';
import { api } from '../../services/api';

export default function TemplatesTab() {
  const qc = useQueryClient();
  const [templateEdit, setTemplateEdit] = useState(null);
  const [error, setError] = useState('');

  const templatesQuery = useQuery({
    queryKey: ['settings', 'notification-templates'],
    queryFn: ({ signal }) => api.settings.notificationTemplates({ signal }),
  });
  const saveTemplate = useMutation({
    mutationFn: ({ key, data }) => api.settings.updateNotificationTemplate(key, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'notification-templates'] }); setTemplateEdit(null); },
    onError: (e) => setError(e.message),
  });

  const templates = templatesQuery.data || [];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <DataCard title="Email templates">
        {templatesQuery.isPending ? <CircularProgress size={22} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell sx={{ width: 64 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.templateKey} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>{t.templateKey}</Typography>
                      {!t.isActive && <StateBadge value="Inactive" />}
                    </TableCell>
                    <TableCell>{t.subject}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setTemplateEdit({ ...t })}>
                        <PencilSquareIcon size={16} />
                      </IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow><TableCell colSpan={3}><Typography variant="body2" color="text.secondary">No templates yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataCard>

      {templateEdit && (
        <TemplateDialog value={templateEdit} saving={saveTemplate.isPending}
          onClose={() => setTemplateEdit(null)}
          onSave={(data) => saveTemplate.mutate({ key: templateEdit.templateKey, data })} />
      )}
    </Box>
  );
}

function TemplateDialog({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    subject: value.subject || '', body: value.body || '',
    ccOwner: value.ccOwner !== false, isActive: value.isActive !== false,
  });
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit template — {value.templateKey}</DialogTitle>
      <DialogContent>
        <TextField label="Subject" fullWidth size="small" sx={{ mt: 1, mb: 2 }}
          value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
        <TextField label="Body" fullWidth multiline minRows={8}
          value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Placeholders: {'{{returnName}} {{period}} {{dueDate}} {{daysLeft}} {{daysLate}} {{level}} {{regulator}} {{actName}} {{controlName}} {{recipientName}} {{link}}'}
        </Typography>
        <FormControlLabel sx={{ mt: 1 }}
          control={<Checkbox checked={form.ccOwner} onChange={e => setForm(f => ({ ...f, ccOwner: e.target.checked }))} />}
          label="CC the owner / analyst" />
        <FormControlLabel
          control={<Checkbox checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />}
          label="Active" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving} onClick={() => onSave(form)}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}
