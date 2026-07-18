import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, CircularProgress, Alert, TextField, InputAdornment,
  IconButton, Tooltip, Drawer,
} from '@mui/material';
import { Search, Refresh, Close } from '@mui/icons-material';
import { api } from '../services/api';

const RISK_COLORS = { high: 'error', medium: 'warning', low: 'default' };

export default function LibraryPage() {
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(q = '') {
    setLoading(true);
    try {
      const data = await api.instruments.list(0, 50, q);
      setInstruments(data.content || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleSearch() { load(search); }

  async function openDetail(instr) {
    setDetailLoading(true);
    setSelected(instr);
    try {
      const detail = await api.instruments.get(instr.id);
      setSelected(detail);
    } catch { }
    finally { setDetailLoading(false); }
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Obligation Library</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Browse classified regulatory instruments
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField size="small" placeholder="Search by title..." value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20, color: '#CBD5E0' }} /></InputAdornment>,
          }}
          sx={{ flex: 1, maxWidth: 400 }} />
        <Tooltip title="Refresh"><IconButton onClick={() => load()}><Refresh /></IconButton></Tooltip>
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
                <TableCell>Risk Rating</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Published</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : instruments.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No instruments found.</TableCell></TableRow>
              ) : instruments.map(i => (
                <TableRow key={i.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(i)}>
                  <TableCell sx={{ fontWeight: 500 }}>{i.sourceTitle || i.title}</TableCell>
                  <TableCell>{i.regulatorAbbreviation || i.regulatorName}</TableCell>
                  <TableCell><Chip size="small" label={i.documentType || '-'} variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip size="small" label={i.riskRating || 'unrated'} color={RISK_COLORS[i.riskRating?.toLowerCase()] || 'default'} />
                  </TableCell>
                  <TableCell><Chip size="small" label={i.status || 'unknown'} /></TableCell>
                  <TableCell>{i.publishedAt || i.createdAt ? new Date(i.publishedAt || i.createdAt).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)}
        PaperProps={{ sx: { width: 450, p: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Instrument Detail</Typography>
          <IconButton onClick={() => setSelected(null)}><Close /></IconButton>
        </Box>
        {detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
        ) : selected ? (
          <Box>
            <Typography variant="body2" color="text.secondary">Title</Typography>
            <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>{selected.sourceTitle || selected.title}</Typography>

            <Typography variant="body2" color="text.secondary">Regulator</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>{selected.regulatorAbbreviation || selected.regulatorName || '-'}</Typography>

            <Typography variant="body2" color="text.secondary">Document Type</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>{selected.documentType || '-'}</Typography>

            <Typography variant="body2" color="text.secondary">Risk Rating</Typography>
            <Box sx={{ mb: 2 }}>
              <Chip size="small" label={selected.riskRating || 'unrated'} color={RISK_COLORS[selected.riskRating?.toLowerCase()] || 'default'} />
            </Box>

            <Typography variant="body2" color="text.secondary">Status</Typography>
            <Box sx={{ mb: 2 }}>
              <Chip size="small" label={selected.status || 'unknown'} />
            </Box>

            {selected.obligations?.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Obligations ({selected.obligations.length})</Typography>
                {selected.obligations.map((o, i) => (
                  <Box key={i} sx={{ p: 1, bgcolor: '#F7FAFC', borderRadius: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>{o.description || o.text}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {selected.sanctions?.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Sanctions ({selected.sanctions.length})</Typography>
                {selected.sanctions.map((s, i) => (
                  <Box key={i} sx={{ p: 1, bgcolor: '#FFF5F5', borderRadius: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>{s.description || s.text}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
}
