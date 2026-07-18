import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { api } from '../services/api';

const STATUS_COLORS = {
  pending: 'warning', processing: 'info', completed: 'success', failed: 'error',
};

export default function UploadStatusPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.uploads.list();
      setUploads(data.content || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Upload History</Typography>
          <Typography variant="body2" color="text.secondary">Track document processing status</Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={load}><Refresh /></IconButton></Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card>
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Regulator</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Instrument</TableCell>
                <TableCell>Uploaded</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No uploads yet.</TableCell></TableRow>
              ) : uploads.map(u => (
                <TableRow key={u.id}>
                  <TableCell sx={{ fontWeight: 500 }}>{u.title}</TableCell>
                  <TableCell>{u.regulatorName || '-'}</TableCell>
                  <TableCell><Chip size="small" label={u.documentType || '-'} variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip size="small" label={u.status} color={STATUS_COLORS[u.status] || 'default'} />
                  </TableCell>
                  <TableCell>
                    {u.instrumentId ? (
                      <Chip size="small" label={`#${u.instrumentId}`} color="primary" variant="outlined" />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
