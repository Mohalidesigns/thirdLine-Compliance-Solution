import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, Paper, Chip, CircularProgress, Alert, Button,
} from '@mui/material';
import { PageHeader, StateBadge, TL, ArrowPathIcon } from 'shared';
import { api } from '../services/api';

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
      <PageHeader
        title="Upload History"
        subtitle="Track document processing status"
        actions={(
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={load}>Refresh</Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Document</TableCell>
                <TableCell>Regulator</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Instrument</TableCell>
                <TableCell>Uploaded</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No uploads yet.</TableCell></TableRow>
              ) : uploads.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500 }}>{u.title}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{u.documentType || '-'}</Typography>
                  </TableCell>
                  <TableCell>{u.regulatorName || '-'}</TableCell>
                  <TableCell>
                    <StateBadge value={u.status} />
                    {u.status === 'failed' && u.errorMessage && (
                      <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mt: 0.5, maxWidth: 320 }}>
                        {u.errorMessage}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.instrumentId ? (
                      <Chip size="small" label={`#${u.instrumentId}`} variant="outlined"
                        sx={{ fontFamily: TL.mono, fontSize: '0.7rem' }} />
                    ) : '-'}
                  </TableCell>
                  <TableCell sx={{ color: TL.gray500 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
}
