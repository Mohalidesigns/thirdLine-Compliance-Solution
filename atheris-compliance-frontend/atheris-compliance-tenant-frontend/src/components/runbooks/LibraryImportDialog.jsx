import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import { ArrowUpTrayIcon, TL } from 'shared';
import { api } from '../../services/api';
import { errMsg } from './LibraryBadges';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * M28 — Import a runbook from the portable JSON format ("atheris-runbook/1").
 * POST /runbooks/import (multipart `file`) → RunbookDetailDto. The server validates the schema;
 * its message is shown as the validation report.
 */
export default function LibraryImportDialog({ open, onClose, onImported }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [localError, setLocalError] = useState('');
  const [preview, setPreview] = useState(null);

  const mutation = useMutation({
    mutationFn: () => api.runbooks.importJson(file),
    onSuccess: (rb) => {
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      onImported?.(rb);
      handleClose();
    },
  });

  function handleClose() {
    setFile(null); setLocalError(''); setPreview(null); mutation.reset();
    onClose();
  }

  const pick = async (f) => {
    setLocalError(''); setPreview(null); mutation.reset();
    if (!f) { setFile(null); return; }
    if (f.size > MAX_BYTES) { setFile(null); setLocalError('File is larger than 5 MB.'); return; }
    try {
      const json = JSON.parse(await f.text());
      if (json?.format && json.format !== 'atheris-runbook/1') {
        setLocalError(`Unsupported format "${json.format}" — expected atheris-runbook/1.`);
      }
      const steps = (json?.sections || []).reduce((n, s) => n + (s.steps?.length || 0), 0);
      setPreview({ title: json?.title, category: json?.category, sections: json?.sections?.length || 0, steps });
      setFile(f);
    } catch {
      setFile(null);
      setLocalError('The file is not valid JSON.');
    }
  };

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import runbook (JSON)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload a runbook exported from Atheris (portable format <code>atheris-runbook/1</code>).
          It is created as a new runbook with a draft version.
        </Typography>
        <Button component="label" variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />}>
          {file ? 'Choose another file' : 'Choose file'}
          <input hidden type="file" accept=".json,application/json"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </Button>
        {file && (
          <Box sx={{ mt: 2, p: 2, border: `1px solid ${TL.gray200}`, borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{file.name}</Typography>
            {preview && (
              <Typography variant="caption" color="text.secondary">
                {preview.title || 'Untitled'} · {preview.category || 'no category'} · {preview.sections} sections · {preview.steps} steps
              </Typography>
            )}
          </Box>
        )}
        {localError && <Alert severity="warning" sx={{ mt: 2 }}>{localError}</Alert>}
        {mutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Import rejected</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{errMsg(mutation.error)}</Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Importing…' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
