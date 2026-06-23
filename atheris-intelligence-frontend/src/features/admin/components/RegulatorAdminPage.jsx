import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  LinearProgress, CircularProgress, Alert, Drawer, Divider, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  PlayArrow, Refresh, History, Language, Settings,
  CheckCircle, ErrorOutline, HourglassEmpty, Close,
  Edit, Search,
} from '@mui/icons-material';
import api from '../../../services/api';

const scraperStatusColors = {
  idle: { color: '#718096', label: 'Idle' },
  scraping: { color: '#3182CE', label: 'Scraping' },
  backfilling: { color: '#805AD5', label: 'Backfilling' },
  error: { color: '#C53030', label: 'Error' },
  disabled: { color: '#CBD5E0', label: 'Disabled' },
};

const riskColors = { High: '#C53030', Medium: '#DD6B20', Low: '#2D7D46' };

const scraperStrategies = [
  { value: 'html', label: 'HTML Parsing' },
  { value: 'headless', label: 'Headless Browser' },
  { value: 'disabled', label: 'Disabled' },
];

const scraperFrequencies = [
  { value: '15min', label: 'Every 15 minutes' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const paginationStrategies = [
  { value: 'NEXT_BUTTON', label: 'Next Button' },
  { value: 'PAGE_PARAM', label: 'Page Parameter' },
  { value: 'YEAR_FOLDERS', label: 'Year Folders' },
];

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

export default function RegulatorAdminPage() {
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReg, setSelectedReg] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Documents in drawer
  const [instruments, setInstruments] = useState([]);
  const [instrLoading, setInstrLoading] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  function fetchRegulators() {
    setLoading(true);
    setError(null);
    api.platform.regulators.list(true)
      .then((data) => setRegulators(data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchRegulators(); }, []);

  function openRegulator(reg) {
    setSelectedReg(reg);
    setDrawerOpen(true);
    setDocSearch('');
    loadInstruments(reg.regulatorId, '');
  }

  function loadInstruments(regulatorId, query) {
    setInstrLoading(true);
    const params = new URLSearchParams({ regulatorId, size: '50' });
    if (query) params.set('q', query);
    api.platform.instruments.list(params.toString())
      .then((data) => setInstruments(data.content || []))
      .catch(() => setInstruments([]))
      .finally(() => setInstrLoading(false));
  }

  // Config modal
  const [configOpen, setConfigOpen] = useState(false);
  const [configReg, setConfigReg] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState(null);

  function handleConfigSave() {
    setConfigSaving(true);
    setConfigError(null);
    const isNew = !configReg.regulatorId;
    const apiCall = isNew
      ? api.platform.regulators.create(configReg)
      : api.platform.regulators.update(configReg.regulatorId, configReg);
    apiCall
      .then((updated) => {
        if (isNew) {
          setRegulators(prev => [...prev, updated]);
        } else {
          setRegulators(prev => prev.map(r => r.regulatorId === updated.regulatorId ? updated : r));
        }
        setConfigOpen(false);
      })
      .catch((err) => setConfigError(err.message))
      .finally(() => setConfigSaving(false));
  }

  function openConfig(reg, e) {
    if (e) e.stopPropagation();
    setConfigError(null);
    setConfigReg({ ...reg });
    setConfigOpen(true);
  }

  function handleConfigField(key, value) {
    setConfigReg(prev => ({ ...prev, [key]: value }));
  }

  const totalDocs = regulators.reduce((sum, r) => sum + (r.scraperLastFound || 0), 0);
  const activeCount = regulators.filter(r => r.scraperEnabled && r.isActive).length;
  const erroredCount = regulators.filter(r => inferStatus(r) === 'error').length;

  const filteredInstruments = instruments.filter(i =>
    !docSearch || i.sourceTitle?.toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Regulatory Source Management</Typography>
          <Typography variant="body2" color="text.secondary">Monitor scrapers, manage historical backfills, and source health</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchRegulators}>Refresh</Button>
          <Button variant="contained" size="small" startIcon={<Settings />} onClick={(e) => openConfig({ scraperEnabled: true, paginationEnabled: false, maxPagesPerRun: 3, maxPdfSizeMb: 100, scraperStrategy: 'html', scraperFrequency: 'daily' }, e)}>Add Regulator</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Active Sources', value: activeCount, color: '#1A365D' },
          { label: 'Documents Discovered', value: totalDocs.toLocaleString(), color: '#2D7D46' },
          { label: 'Total Regulators', value: regulators.length, color: '#D4AF37' },
          { label: 'Errors', value: erroredCount, color: erroredCount > 0 ? '#C53030' : '#2D7D46' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Regulator</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell>Last Run</TableCell>
                  <TableCell align="right">Docs</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {regulators.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#718096' }}>No regulators configured</TableCell></TableRow>
                ) : regulators.map((reg) => {
                  const st = inferStatus(reg);
                  const stCfg = scraperStatusColors[st];
                  return (
                    <TableRow key={reg.regulatorId} hover sx={{ cursor: 'pointer' }} onClick={() => openRegulator(reg)}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{reg.name}</Typography>
                        <Chip label={reg.abbreviation} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#EDF2F7' }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stCfg.color }} />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{stCfg.label}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{reg.scraperStrategy || '—'}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: '#718096', fontFamily: 'Roboto Mono' }}>{formatDt(reg.scraperLastRanAt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{(reg.scraperLastFound || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {st === 'error' ? <ErrorOutline sx={{ fontSize: 14, color: '#C53030' }} />
                            : reg.scraperEnabled ? <CheckCircle sx={{ fontSize: 14, color: '#2D7D46' }} />
                            : <HourglassEmpty sx={{ fontSize: 14, color: '#CBD5E0' }} />}
                          <Typography variant="caption" sx={{ color: st === 'error' ? '#C53030' : 'inherit' }}>
                            {st === 'error' ? 'Error' : st === 'disabled' ? 'Disabled' : 'Healthy'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Configure"><IconButton size="small" onClick={(e) => openConfig(reg, e)}><Settings sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                        <Tooltip title="Visit Website"><IconButton size="small" component="a" href={reg.websiteUrl} target="_blank"><Language sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Regulator Detail Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 640, p: 3 } }}>
        {selectedReg && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedReg.name}</Typography>
                <Chip label={selectedReg.abbreviation} size="small" sx={{ fontWeight: 700, bgcolor: '#1A365D', color: '#fff', mt: 0.5 }} />
              </Box>
              <IconButton onClick={() => setDrawerOpen(false)}><Close /></IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Website</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{selectedReg.websiteUrl || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Publication Page</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{selectedReg.publicationPageUrl || '—'}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Strategy</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedReg.scraperStrategy || '—'}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Frequency</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedReg.scraperFrequency || '—'}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Last Run</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDt(selectedReg.scraperLastRanAt)}</Typography>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Search sx={{ color: '#718096', fontSize: 18 }} />
              <TextField
                size="small" placeholder="Search by document title..." fullWidth
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Discovered Documents ({filteredInstruments.length})
            </Typography>

            {instrLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
            ) : filteredInstruments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                {docSearch ? 'No documents match your search' : 'No documents discovered yet'}
              </Typography>
            ) : (
              <TableContainer component={Card} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Risk</TableCell>
                      <TableCell>Discovered</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredInstruments.map((inst) => (
                      <TableRow key={inst.instrumentId} hover>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(inst.discoveredAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Drawer>

      {/* Scraper Config Modal */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {configReg?.regulatorId ? `Configure: ${configReg.name}` : 'New Regulator'}
        </DialogTitle>
        <DialogContent>
          {configReg && (
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {configError && <Alert severity="error" onClose={() => setConfigError(null)}>{configError}</Alert>}
              <TextField label="Name" fullWidth size="small" value={configReg.name || ''}
                onChange={(e) => handleConfigField('name', e.target.value)} />
              <TextField label="Abbreviation" fullWidth size="small" value={configReg.abbreviation || ''}
                onChange={(e) => handleConfigField('abbreviation', e.target.value)} />
              <TextField label="Website URL" fullWidth size="small" value={configReg.websiteUrl || ''}
                onChange={(e) => handleConfigField('websiteUrl', e.target.value)} />
              <TextField label="Publication Page URL" fullWidth size="small" value={configReg.publicationPageUrl || ''}
                onChange={(e) => handleConfigField('publicationPageUrl', e.target.value)} />

              <FormControl size="small" fullWidth>
                <InputLabel>Scraper Strategy</InputLabel>
                <Select label="Scraper Strategy" value={configReg.scraperStrategy || 'html'}
                  onChange={(e) => handleConfigField('scraperStrategy', e.target.value)}>
                  {scraperStrategies.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Scraper Frequency</InputLabel>
                <Select label="Scraper Frequency" value={configReg.scraperFrequency || 'daily'}
                  onChange={(e) => handleConfigField('scraperFrequency', e.target.value)}>
                  {scraperFrequencies.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField label="PDF Link CSS Selector" fullWidth size="small" value={configReg.pdfLinkSelector || ''}
                onChange={(e) => handleConfigField('pdfLinkSelector', e.target.value)}
                helperText="CSS selector to find PDF links on the page" />

              <FormControlLabel control={
                <Switch checked={configReg.paginationEnabled || false}
                  onChange={(e) => handleConfigField('paginationEnabled', e.target.checked)} />
              } label="Pagination Enabled" />

              {configReg.paginationEnabled && (
                <>
                  <TextField label="Pagination CSS Selector" fullWidth size="small" value={configReg.paginationSelector || ''}
                    onChange={(e) => handleConfigField('paginationSelector', e.target.value)} />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Pagination Strategy</InputLabel>
                    <Select label="Pagination Strategy" value={configReg.paginationStrategy || ''}
                      onChange={(e) => handleConfigField('paginationStrategy', e.target.value)}>
                      {paginationStrategies.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField label="Max Pages Per Run" fullWidth size="small" type="number" value={configReg.maxPagesPerRun || 3}
                    onChange={(e) => handleConfigField('maxPagesPerRun', parseInt(e.target.value) || 3)} />
                </>
              )}

              <TextField label="Max PDF Size (MB)" fullWidth size="small" type="number" value={configReg.maxPdfSizeMb || 100}
                onChange={(e) => handleConfigField('maxPdfSizeMb', parseInt(e.target.value) || 100)} />

              <FormControlLabel control={
                <Switch checked={configReg.scraperEnabled !== false}
                  onChange={(e) => handleConfigField('scraperEnabled', e.target.checked)} />
              } label="Scraper Enabled" />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)} disabled={configSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleConfigSave} disabled={configSaving}>
            {configSaving ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
