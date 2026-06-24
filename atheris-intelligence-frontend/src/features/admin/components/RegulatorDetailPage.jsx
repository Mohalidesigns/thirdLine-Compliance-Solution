import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Divider, TextField, IconButton,
} from '@mui/material';
import { ArrowBack, Search, Language, Refresh } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const riskColors = { High: '#C53030', Medium: '#DD6B20', Low: '#2D7D46' };

const scraperStatusColors = {
  idle: { color: '#718096', label: 'Idle' },
  scraping: { color: '#3182CE', label: 'Scraping' },
  backfilling: { color: '#805AD5', label: 'Backfilling' },
  error: { color: '#C53030', label: 'Error' },
  disabled: { color: '#CBD5E0', label: 'Disabled' },
};

function inferStatus(reg) {
  if (!reg.scraperEnabled) return 'disabled';
  if (!reg.isActive) return 'disabled';
  if (reg.scraperNotes && reg.scraperNotes.toLowerCase().includes('error')) return 'error';
  return 'idle';
}

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RegulatorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [regulator, setRegulator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [instrLoading, setInstrLoading] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.platform.regulators.get(id),
      api.platform.instruments.list(`regulatorId=${id}&size=50`),
    ])
      .then(([reg, instData]) => {
        setRegulator(reg);
        setInstruments(instData.content || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_REGULATORS)} sx={{ mb: 2 }}>Back to Regulators</Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!regulator) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_REGULATORS)} sx={{ mb: 2 }}>Back to Regulators</Button>
        <Alert severity="warning">Regulator not found</Alert>
      </Box>
    );
  }

  const st = inferStatus(regulator);
  const stCfg = scraperStatusColors[st];

  const filteredInstruments = instruments.filter(i =>
    !docSearch || i.sourceTitle?.toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_REGULATORS)} sx={{ mb: 2 }}>Back to Regulators</Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{regulator.name}</Typography>
            <Chip label={regulator.abbreviation} size="small" sx={{ fontWeight: 700, bgcolor: '#1A365D', color: '#fff' }} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stCfg.color, display: 'inline-block', mr: 0.5 }} />
            {stCfg.label} &middot; {regulator.scraperStrategy || '—'} &middot; {regulator.scraperFrequency || '—'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton component="a" href={regulator.websiteUrl} target="_blank"><Language /></IconButton>
          <Button variant="outlined" size="small" startIcon={<Refresh />}>Test Scraper</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Website</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', wordBreak: 'break-all' }}>{regulator.websiteUrl || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Publication Page</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', wordBreak: 'break-all' }}>{regulator.publicationPageUrl || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} md={2}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Strategy</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{regulator.scraperStrategy || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} md={2}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Frequency</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{regulator.scraperFrequency || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} md={2}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Last Run</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Roboto Mono', fontSize: '0.75rem' }}>{formatDt(regulator.scraperLastRanAt)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Discovered Documents</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small" placeholder="Search by title..." value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ color: '#718096', mr: 0.5, fontSize: 18 }} /> }}
          />
        </Box>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Nature</TableCell>
                <TableCell>Discovered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instrLoading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : filteredInstruments.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: '#718096' }}>
                  {docSearch ? 'No documents match your search' : 'No documents discovered yet'}
                </TableCell></TableRow>
              ) : filteredInstruments.map((inst) => (
                <TableRow key={inst.instrumentId} hover>
                  <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inst.sourceTitle}
                  </TableCell>
                  <TableCell>
                    <Chip label={inst.status} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
                  </TableCell>
                  <TableCell>
                    {inst.riskRating ? (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: riskColors[inst.riskRating] }}>{inst.riskRating}</Typography>
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{inst.nature || '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(inst.discoveredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
