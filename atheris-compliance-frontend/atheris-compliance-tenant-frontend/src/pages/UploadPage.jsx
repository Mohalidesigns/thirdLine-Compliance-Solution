import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Alert, CircularProgress,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { api } from '../services/api';

const DOC_TYPES = ['circulars', 'guidelines', 'directives', 'regulations', 'standards', 'frameworks'];

export default function UploadPage() {
  const navigate = useNavigate();
  const [regulators, setRegulators] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [regulatorId, setRegulatorId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.regulators.list()
      .then(setRegulators)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !title || !regulatorId || !documentType) {
      setError('All fields are required');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('regulatorId', regulatorId);
      formData.append('documentType', documentType);
      const res = await api.uploads.upload(formData);
      setSuccess(`Upload started! ID: ${res.uploadId}`);
      setFile(null);
      setTitle('');
      setRegulatorId('');
      setDocumentType('');
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Upload Document</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload regulatory documents for AI classification
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            <Box sx={{ border: '2px dashed #CBD5E0', borderRadius: 2, p: 4, textAlign: 'center', mb: 2, cursor: 'pointer', '&:hover': { borderColor: '#1A365D' } }}
              onClick={() => document.getElementById('file-input').click()}>
              <input id="file-input" type="file" accept=".pdf" hidden onChange={e => setFile(e.target.files[0])} />
              <CloudUploadIcon sx={{ fontSize: 40, color: '#CBD5E0', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {file ? file.name : 'Click to select a PDF file'}
              </Typography>
            </Box>

            <TextField fullWidth size="small" label="Document Title" required value={title}
              onChange={e => setTitle(e.target.value)} sx={{ mb: 2 }} />

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Regulator *</InputLabel>
              <Select value={regulatorId} label="Regulator *"
                onChange={e => setRegulatorId(e.target.value)}>
                {regulators.filter(r => r.isActive).map(r => (
                  <MenuItem key={r.id} value={r.id}>{r.name} ({r.abbreviation})</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Document Type *</InputLabel>
              <Select value={documentType} label="Document Type *"
                onChange={e => setDocumentType(e.target.value)}>
                {DOC_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/uploads')}>View History</Button>
              <Button fullWidth variant="contained" type="submit" disabled={uploading}>
                {uploading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Upload & Process'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
