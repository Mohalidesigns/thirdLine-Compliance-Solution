import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Divider, TextField, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, Select, MenuItem, InputLabel, FormControl, Snackbar,
} from '@mui/material';
import {
  ArrowBack, Search, Language, Refresh, OpenInNew, Description, Close, Save,
} from '@mui/icons-material';
import api, { getToken, API_BASE } from '../../../services/api';
import { ROUTES, APP } from '../../../utils/constants';

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

  // Config editor
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.platform.regulators.get(id),
      api.platform.instruments.list(`regulatorId=${id}&size=50`),
    ])
      .then(([reg, instData]) => {
        setRegulator(reg);
        setInstruments(instData.content || []);
        setConfig({
          name: reg.name || '',
          abbreviation: reg.abbreviation || '',
          websiteUrl: reg.websiteUrl || '',
          publicationPageUrl: reg.publicationPageUrl || '',
          scraperStrategy: reg.scraperStrategy || 'html',
          scraperFrequency: reg.scraperFrequency || 'daily',
          scraperEnabled: reg.scraperEnabled ?? true,
          pdfLinkSelector: reg.pdfLinkSelector || '',
          paginationEnabled: reg.paginationEnabled ?? false,
          paginationStrategy: reg.paginationStrategy || '',
          maxPagesPerRun: reg.maxPagesPerRun ?? 3,
          maxPdfSizeMb: reg.maxPdfSizeMb ?? 100,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveConfig() {
    setSaving(true);
    try {
      await api.platform.regulators.update(id, config);
      setSnackbar({ open: true, message: 'Configuration saved', severity: 'success' });
      const reg = await api.platform.regulators.get(id);
      setRegulator(reg);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to save: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf(inst) {
    const token = getToken();
    if (!token || token === APP.DEMO_TOKEN) {
      alert('PDF not available in demo mode');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/intelligence/obligations/${inst.instrumentId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
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

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Scraper Configuration</Typography>
        <Button variant="contained" size="small" startIcon={<Save />} onClick={saveConfig} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Name" size="small" value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Abbreviation" size="small" value={config.abbreviation}
                onChange={(e) => setConfig({ ...config, abbreviation: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Strategy</InputLabel>
                <Select label="Strategy" value={config.scraperStrategy}
                  onChange={(e) => setConfig({ ...config, scraperStrategy: e.target.value })}>
                  <MenuItem value="html">HTML</MenuItem>
                  <MenuItem value="headless">Headless</MenuItem>
                  <MenuItem value="disabled">Disabled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Website URL" size="small" value={config.websiteUrl}
                onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Publication Page URL" size="small" value={config.publicationPageUrl}
                onChange={(e) => setConfig({ ...config, publicationPageUrl: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Frequency</InputLabel>
                <Select label="Frequency" value={config.scraperFrequency}
                  onChange={(e) => setConfig({ ...config, scraperFrequency: e.target.value })}>
                  <MenuItem value="15min">Every 15 min</MenuItem>
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="PDF Link Selector" size="small" value={config.pdfLinkSelector}
                onChange={(e) => setConfig({ ...config, pdfLinkSelector: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Max Pages Per Run" size="small" type="number"
                value={config.maxPagesPerRun}
                onChange={(e) => setConfig({ ...config, maxPagesPerRun: parseInt(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Max PDF Size (MB)" size="small" type="number"
                value={config.maxPdfSizeMb}
                onChange={(e) => setConfig({ ...config, maxPdfSizeMb: parseInt(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Pagination Strategy</InputLabel>
                <Select label="Pagination Strategy" value={config.paginationStrategy}
                  onChange={(e) => setConfig({ ...config, paginationStrategy: e.target.value })}>
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="NEXT_BUTTON">Next Button</MenuItem>
                  <MenuItem value="PAGE_PARAM">Page Parameter</MenuItem>
                  <MenuItem value="YEAR_FOLDERS">Year Folders</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={1.5}>
              <FormControlLabel control={
                <Switch checked={config.scraperEnabled ?? false}
                  onChange={(e) => setConfig({ ...config, scraperEnabled: e.target.checked })} />
              } label="Enabled" />
            </Grid>
            <Grid item xs={6} sm={1.5}>
              <FormControlLabel control={
                <Switch checked={config.paginationEnabled ?? false}
                  onChange={(e) => setConfig({ ...config, paginationEnabled: e.target.checked })} />
              } label="Paginate" />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
