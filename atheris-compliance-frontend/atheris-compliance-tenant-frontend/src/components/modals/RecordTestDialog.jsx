import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Grid, Box, CircularProgress, Typography,
} from '@mui/material';
import { ArrowUpTrayIcon } from 'shared';
import { api } from '../../services/api';
import OwnerPicker from '../org/OwnerPicker';

export default function RecordTestDialog({ open, onClose, controlId, controlOwnerId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({
    testDate: new Date().toISOString().split('T')[0], result: '', resultDescription: '',
    failureDetails: '', failureSeverity: '', evidenceUrl: '', remediationRequired: false,
    remediationOwnerId: null, remediationDeadline: '',
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        testDate: new Date().toISOString().split('T')[0], result: '', resultDescription: '',
        failureDetails: '', failureSeverity: '', evidenceUrl: '', remediationRequired: false,
        remediationOwnerId: controlOwnerId ?? null, remediationDeadline: '',
      });
      setFiles([]);
    }
  }, [open, controlOwnerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('testDate', form.testDate);
      fd.append('result', form.result);
      if (form.resultDescription) fd.append('resultDescription', form.resultDescription);
      if (form.failureDetails) fd.append('failureDetails', form.failureDetails);
      if (form.failureSeverity) fd.append('failureSeverity', form.failureSeverity);
      if (form.remediationOwnerId) fd.append('remediationOwnerId', String(form.remediationOwnerId));
      if (form.remediationDeadline) fd.append('remediationDeadline', form.remediationDeadline);
      files.forEach(f => fd.append('files', f));
      await api.controls.recordTest(controlId, fd);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Test Result</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}><TextField label="Test Date" type="date" fullWidth size="small" required
            InputLabelProps={{ shrink: true }} value={form.testDate}
            onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))} /></Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Result" fullWidth size="small" required value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Passed">Passed</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
              <MenuItem value="Partial">Partial</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}><TextField label="Result Description" fullWidth size="small" multiline minRows={2} value={form.resultDescription}
            onChange={e => setForm(f => ({ ...f, resultDescription: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="Failure Details" fullWidth size="small" multiline minRows={2} value={form.failureDetails}
            onChange={e => setForm(f => ({ ...f, failureDetails: e.target.value }))} /></Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Failure Severity" fullWidth size="small" value={form.failureSeverity}
              onChange={e => setForm(f => ({ ...f, failureSeverity: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button variant="outlined" component="label" fullWidth startIcon={<ArrowUpTrayIcon size={16} />}>
              {files.length ? `${files.length} file(s) selected` : 'Attach evidence * (PDF, PNG, JPG, XLSX)'}
              <input type="file" hidden multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={e => setFiles(Array.from(e.target.files || []))} />
            </Button>
            {files.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {files.map(f => <Typography key={f.name} variant="caption" sx={{ display: 'block' }}>{f.name}</Typography>)}
              </Box>
            )}
          </Grid>
          <Grid size={{ xs: 6 }}><OwnerPicker value={form.remediationOwnerId} label="Remediation Owner"
            onChange={id => setForm(f => ({ ...f, remediationOwnerId: id }))} /></Grid>
          <Grid size={{ xs: 6 }}><TextField label="Remediation Deadline" type="date" fullWidth size="small"
            InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
            onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.testDate || !form.result || files.length === 0}>
          {saving ? 'Saving...' : 'Record Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
