import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Typography, Box, List, ListItem, ListItemText,
} from '@mui/material';
import { api } from '../../services/api';

export default function BulkImportStakeholdersDialog({ open, onClose }) {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);

  const mutation = useMutation({
    mutationFn: (f) => {
      const form = new FormData();
      form.append('file', f);
      return api.stakeholders.bulkImport(form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stakeholders'] }),
  });

  const close = () => {
    setFile(null);
    mutation.reset();
    onClose();
  };

  const result = mutation.data;

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Bulk import stakeholders</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
          Upload a CSV or XLSX with columns <strong>name, email, title, department, unit</strong>.
          Email and department are required; existing emails are updated.
        </Typography>
        <Button variant="outlined" component="label">
          Choose file
          <input hidden type="file" accept=".csv,.xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] || null); mutation.reset(); }} />
        </Button>
        {file && <Typography sx={{ mt: 1, fontSize: '0.85rem' }}>{file.name}</Typography>}

        {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{mutation.error.message}</Alert>}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={result.errors?.length ? 'warning' : 'success'}>
              {result.created} added, {result.updated} updated, {result.skipped} skipped
            </Alert>
            {result.errors?.length > 0 && (
              <List dense sx={{ maxHeight: 220, overflow: 'auto', mt: 1 }}>
                {result.errors.map((e, i) => (
                  <ListItem key={i} disableGutters>
                    <ListItemText primary={`Row ${e.row}: ${e.message}`} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
        <Button variant="contained" disabled={!file || mutation.isPending} onClick={() => mutation.mutate(file)}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
