import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Divider, TextField, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  ArrowBack, Search, Language, Refresh, OpenInNew, Description, Close,
} from '@mui/icons-material';
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
  const [docSearch, setDocSearch] = useState('');

  // Text viewer
  const [textOpen, setTextOpen] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textLoading, setTextLoading] = useState(false);

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

  async function handleViewPdf(inst) {
    try {
      const data = await api.platform.instruments.getPdfUrl(inst.instrumentId);
      if (data && data.url) {
        window.open(data.url, '_blank');
      } else {
        alert('PDF not available');
      }
    } catch {
      alert('Failed to load PDF');
    }
  }

  async function handleViewText(inst) {
    setTextLoading(true);
    setTextTitle(inst.sourceTitle);
    setTextOpen(true);
    setTextContent('');
    try {
      const detail = await api.platform.instruments.get(inst.instrumentId);
      setTextContent(detail.pdfOcrText || '(No extracted text available)');
    } catch {
      setTextContent('Failed to load document text');
    } finally {
      setTextLoading(false);
    }
  }

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
        <TextField
          size="small" placeholder="Search by title..." value={docSearch}
          onChange={(e) => setDocSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ color: '#718096', mr: 0.5, fontSize: 18 }} /> }}
        />
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell sx={{ width: 80 }}>Risk</TableCell>
                <TableCell sx={{ width: 120 }}>Discovered</TableCell>
                <TableCell sx={{ width: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInstruments.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: '#718096' }}>
                  {docSearch ? 'No documents match your search' : 'No documents discovered yet'}
                </TableCell></TableRow>
              ) : filteredInstruments.map((inst) => (
                <TableRow key={inst.instrumentId} hover>
                  <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inst.sourceTitle}
                  </TableCell>
                  <TableCell>
                    {inst.riskRating ? (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: riskColors[inst.riskRating] }}>{inst.riskRating}</Typography>
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(inst.discoveredAt)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View PDF">
                        <IconButton size="small" onClick={() => handleViewPdf(inst)}>
                          <OpenInNew sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Extracted Text">
                        <IconButton size="small" onClick={() => handleViewText(inst)}>
                          <Description sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={textOpen} onClose={() => setTextOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{textTitle}</Box>
          <IconButton onClick={() => setTextOpen(false)} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {textLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'Roboto Mono', lineHeight: 1.6 }}>
              {textContent}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTextOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
