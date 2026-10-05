import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { api } from '../../services/api';

export default function RecordReturnEventDialog({ open, item, onClose, onSaved }) {
  const fileRef = useRef(null);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ triggerDate: '', reference: '', dueDate: '' });
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setForm({ triggerDate: '', reference: '', dueDate: '', fileName: '' });
      setSelectedFileName('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open, item]);
  const mutation = useMutation({
    mutationFn: ({ body }) => api.returns.recordEvent(item.returnId, body),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.(result);
    },
    onError: e => setError(e.message),
  });
  const uploadMutation = useMutation({
    mutationFn: async ({ file, fields }) => {
      const data = new FormData();
      data.append('file', file);
      data.append('event', new Blob([JSON.stringify({ ...fields, reference: '' })], { type: 'application/json' }));
      return api.returns.recordEventWithEvidence(item.returnId, data);
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.(result);
    },
    onError: e => setError(e.message),
  });
  const save = () => {
    setError('');
    if (!form.triggerDate) return setError('Trigger date is required.');
    if (!form.reference.trim() && !fileRef.current?.files?.[0]) return setError('Add a reference or attach evidence for this occurrence.');
    if (item?.eventDeadlineMode === 'MANUAL' && !form.dueDate) return setError('Enter the due date stated in the request or directive.');
    const fields = { triggerDate: form.triggerDate, reference: form.reference.trim(),
      ...(item?.eventDeadlineMode === 'MANUAL' ? { dueDate: form.dueDate } : {}) };
    const file = fileRef.current?.files?.[0];
    if (file) uploadMutation.mutate({ file, fields });
    else mutation.mutate({ body: fields });
  };
  const pending = mutation.isPending || uploadMutation.isPending;
  return (
    <Dialog open={open} onClose={() => !pending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Record {item?.eventTriggerLabel || 'trigger event'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          {item?.eventDeadlineMode === 'MANUAL'
            ? 'Enter the date the request or directive was received and the due date stated in it.'
            : `Due date will be calculated ${item?.eventDeadlineDays} ${item?.eventDeadlineUnit?.toLowerCase()} day(s) after the trigger, then moved to the next working day if needed.`}
        </Alert>
        <TextField fullWidth required type="date" size="small" label="Trigger date" value={form.triggerDate} sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }} onChange={e => setForm(f => ({ ...f, triggerDate: e.target.value }))} />
        {item?.eventDeadlineMode === 'MANUAL' && (
          <TextField fullWidth required type="date" size="small" label="Due date in request/directive" value={form.dueDate} sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        )}
        <TextField fullWidth multiline minRows={2} size="small" label="Reference (enter this OR attach evidence)" value={form.reference}
          placeholder="Reference number or brief evidence description"
          onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} sx={{ mb: 2 }} />
        <Button variant="outlined" component="label">
          {selectedFileName || 'Attach evidence file'}
          <input hidden type="file" ref={fileRef} onChange={e => setSelectedFileName(e.target.files?.[0]?.name || '')} />
        </Button>
        {item?.eventDeadlineMode !== 'MANUAL' && !form.reference.trim() && !form.fileName &&
          <Alert severity="warning" sx={{ mt: 2 }}>Attach a file or enter a reference to document the trigger.</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={pending || (item?.eventDeadlineMode !== 'MANUAL' && !form.reference.trim() && !form.fileName)}>
          {pending ? <CircularProgress size={18} /> : 'Create filing'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
