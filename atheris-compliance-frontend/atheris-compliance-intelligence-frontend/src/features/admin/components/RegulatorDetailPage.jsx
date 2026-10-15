import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
  TextField, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, Select, MenuItem, InputLabel, FormControl, Snackbar, Link,
} from '@mui/material';
import {
  DetailHeader, KpiCards, DataCard, CardLink, SearchInput, StatusBadge, RiskBadge, TL,
  GlobeAltIcon, ArrowPathIcon, ChevronRightIcon, DocumentTextIcon, XMarkIcon, Cog6ToothIcon,
  CloudArrowUpIcon, ArrowUpTrayIcon, CheckCircleIcon, Squares2x2Icon, LinkIcon, ClockIcon, ListBulletIcon,
} from 'shared';
import api, { getToken, API_BASE, pdfErrorMessage } from '../../../services/api';
import { ROUTES, APP } from '../../../utils/constants';

const scraperStatusColors = {
  idle: { color: TL.gray400, label: 'Idle' },
  scraping: { color: '#3B82F6', label: 'Scraping' },
  backfilling: { color: '#A855F7', label: 'Backfilling' },
  error: { color: '#EF4444', label: 'Error' },
  disabled: { color: TL.gray300, label: 'Disabled' },
};

const URL_VALUE_SX = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-all', color: TL.gray700,
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

  // Pipeline stats
  const [pipelineStats, setPipelineStats] = useState(null);

  // Inline stage list
  const [selectedStage, setSelectedStage] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  // Text viewer
  const [textOpen, setTextOpen] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textLoading, setTextLoading] = useState(false);

  // Config editor modal
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.platform.regulators.get(id),
      api.platform.instruments.list(`regulatorId=${id}&size=50`),
      api.platform.regulators.getPipelineStats(id),
    ])
      .then(([reg, instData, stats]) => {
        setRegulator(reg);
        setPipelineStats(stats);
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
      setConfigOpen(false);
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
      if (!res.ok) throw new Error(await pdfErrorMessage(res, 'Failed to load PDF'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      alert(e.message || 'Failed to load PDF');
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

  async function handleUploadPdf(pendId) {
    const fileInput = document.getElementById(`upload-${pendId}`);
    const file = fileInput?.files?.[0];
    if (!file) return;
    setUploadingId(pendId);
    try {
      await api.platform.pendingDownloads.upload(pendId, file);
      const stats = await api.platform.regulators.getPipelineStats(id);
      setPipelineStats(stats);
      setSnackbar({ open: true, message: 'PDF uploaded. Pipeline will process it.', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Upload failed: ' + err.message, severity: 'error' });
    } finally {
      setUploadingId(null);
      if (fileInput) fileInput.value = '';
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box>
        <DetailHeader band title="Regulator" onBack={() => navigate(ROUTES.ADMIN_REGULATORS)} backLabel="Back to Regulators" />
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!regulator) {
    return (
      <Box>
        <DetailHeader band title="Regulator" onBack={() => navigate(ROUTES.ADMIN_REGULATORS)} backLabel="Back to Regulators" />
        <Alert severity="warning">Regulator not found</Alert>
      </Box>
    );
  }

  const st = inferStatus(regulator);
  const stCfg = scraperStatusColors[st];

  const filteredInstruments = instruments.filter(i =>
    !docSearch || i.sourceTitle?.toLowerCase().includes(docSearch.toLowerCase())
  );

  const toggleStage = (key) => setSelectedStage(selectedStage === key ? null : key);

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(ROUTES.ADMIN_REGULATORS)}
        backLabel="Back to Regulators"
        title={(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            {regulator.name}
            <StatusBadge label={regulator.abbreviation} tone="blue" />
          </Box>
        )}
        meta={(
          <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: TL.gray500 }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stCfg.color, display: 'inline-block', mr: 0.75 }} />
            {stCfg.label} &middot; {regulator.scraperStrategy || '—'} &middot; {regulator.scraperFrequency || '—'}
          </Typography>
        )}
        right={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Tooltip title="Open website">
              <IconButton component="a" href={regulator.websiteUrl} target="_blank"><GlobeAltIcon size={20} /></IconButton>
            </Tooltip>
            <Button variant="outlined" startIcon={<Cog6ToothIcon size={16} />} onClick={() => setConfigOpen(true)}>Edit Configuration</Button>
            <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />}>Test Scraper</Button>
          </Box>
        )}
      />

      <KpiCards
        columns={5}
        items={[
          { key: 'website', label: 'Website', tone: 'blue', icon: <GlobeAltIcon />,
            value: <Box component="span" sx={URL_VALUE_SX}>{regulator.websiteUrl || '—'}</Box> },
          { key: 'publication', label: 'Publication Page', tone: 'teal', icon: <LinkIcon />,
            value: <Box component="span" sx={URL_VALUE_SX}>{regulator.publicationPageUrl || '—'}</Box> },
          { key: 'strategy', label: 'Strategy', tone: 'purple', icon: <Squares2x2Icon />, value: regulator.scraperStrategy || '—' },
          { key: 'frequency', label: 'Frequency', tone: 'amber', icon: <ArrowPathIcon />, value: regulator.scraperFrequency || '—' },
          { key: 'lastRun', label: 'Last Run', tone: 'gray', icon: <ClockIcon />,
            value: <Box component="span" sx={{ fontFamily: TL.mono, fontSize: '0.875rem' }}>{formatDt(regulator.scraperLastRanAt)}</Box> },
        ]}
      />

      {/* Pipeline Stage Cards */}
      {pipelineStats && (
        <KpiCards
          columns={4}
          onSelect={toggleStage}
          items={[
            { key: 'failed', label: 'Discovered', value: pipelineStats.discoveredCount,
              tone: pipelineStats.failedDownloads?.length > 0 ? 'red' : 'gray', icon: <CloudArrowUpIcon />, active: selectedStage === 'failed' },
            { key: 'downloaded', label: 'Downloaded', value: pipelineStats.downloadedCount,
              tone: 'green', icon: <CheckCircleIcon />, active: selectedStage === 'downloaded' },
            { key: 'extracted', label: 'Extracted', value: pipelineStats.extractedCount,
              tone: 'blue', icon: <DocumentTextIcon />, active: selectedStage === 'extracted' },
            { key: 'classified', label: 'Classified', value: pipelineStats.classifiedCount,
              tone: 'amber', icon: <Squares2x2Icon />, active: selectedStage === 'classified' },
          ]}
        />
      )}

      {/* Inline Stage Lists */}
      {selectedStage && pipelineStats && (() => {
        const isFailed = selectedStage === 'failed';
        const isDownloaded = selectedStage === 'downloaded';
        const isExtracted = selectedStage === 'extracted';
        const isClassified = selectedStage === 'classified';

        const title = isFailed ? 'Failed Downloads' : isDownloaded ? 'Downloaded Documents' : isExtracted ? 'Extracted Documents' : 'Classified Documents';

        const emptyMsg = isFailed ? 'No failed downloads' : isDownloaded ? 'No downloaded documents' : isExtracted ? 'No extracted documents' : 'No classified documents';
        const items = isFailed ? [...(pipelineStats.uploadedDocuments || []), ...(pipelineStats.failedDownloads || [])] : isDownloaded ? pipelineStats.downloadedDocuments : isExtracted ? pipelineStats.extractedDocuments : pipelineStats.classifiedDocuments;

        return (
          <DataCard
            noPadding
            sx={{ mb: 3 }}
            title={title}
            actions={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isFailed && pipelineStats.uploadedCount > 0 && <StatusBadge label={`${pipelineStats.uploadedCount} uploaded`} tone="green" />}
                <CardLink onClick={() => setSelectedStage(null)}>Close</CardLink>
              </Box>
            )}
          >
            {(!items || items.length === 0) ? (
              <Typography sx={{ py: 3, textAlign: 'center', fontSize: '0.875rem', color: TL.gray500 }}>{emptyMsg}</Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {isFailed && <TableCell>Title</TableCell>}
                      {isFailed && <TableCell>URL</TableCell>}
                      {!isFailed && <TableCell>Document</TableCell>}
                      {isFailed && <TableCell sx={{ width: 100 }}>Status</TableCell>}
                      {isClassified && <TableCell sx={{ width: 90 }}>Status</TableCell>}
                      {isClassified && <TableCell sx={{ width: 80 }}>Risk</TableCell>}
                      <TableCell sx={{ width: 140 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isFailed && items.map((item) => {
                      const isUploaded = (pipelineStats.uploadedDocuments || []).some(u => u.id === item.id);
                      return (
                        <TableRow key={item.id} hover sx={isUploaded ? { bgcolor: TL.gray50 } : {}}>
                          <TableCell sx={{ fontWeight: 500, color: 'primary.main' }}>{item.title || 'Untitled'}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link href={item.sourceUrl} target="_blank" sx={{ color: 'primary.main' }}>{item.sourceUrl}</Link>
                          </TableCell>
                          <TableCell>
                            <StatusBadge label={isUploaded ? 'Uploaded' : 'Pending'} tone={isUploaded ? 'green' : 'red'} />
                          </TableCell>
                          <TableCell>
                            {isUploaded ? (
                              (() => {
                                const jobLabel = item.jobStatus === 'pending' ? 'OCR Pending' : item.jobStatus === 'processing' ? 'Processing' : item.jobStatus === 'completed' ? 'Done' : item.jobStatus === 'failed' ? 'Failed' : 'OCR Queued';
                                const jobTone = item.jobStatus === 'completed' ? 'green' : item.jobStatus === 'failed' ? 'red' : 'blue';
                                return <StatusBadge label={jobLabel} tone={jobTone} />;
                              })()
                            ) : (
                              <>
                                {item.errorMessage && <Typography sx={{ display: 'block', mb: 0.5, fontSize: '0.75rem', color: TL.error }}>{item.errorMessage}</Typography>}
                                <input type="file" accept=".pdf" id={`upload-${item.id}`} style={{ display: 'none' }} onChange={() => handleUploadPdf(item.id)} />
                                <label htmlFor={`upload-${item.id}`}>
                                  <Button variant="outlined" size="small" component="span" disabled={uploadingId === item.id}
                                    startIcon={uploadingId === item.id ? <CircularProgress size={14} /> : <ArrowUpTrayIcon size={16} />}>
                                    {uploadingId === item.id ? '...' : 'Upload'}
                                  </Button>
                                </label>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isDownloaded && items.map((item) => (
                      <TableRow key={item.instrumentId} hover>
                        <TableCell sx={{ fontWeight: 500, color: 'primary.main' }}>{item.sourceTitle}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => handleViewPdf(item)} startIcon={<ChevronRightIcon size={16} />}>View PDF</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {isExtracted && items.map((item) => (
                      <TableRow key={item.instrumentId} hover>
                        <TableCell sx={{ fontWeight: 500, color: 'primary.main' }}>{item.sourceTitle}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => handleViewText(item)} startIcon={<DocumentTextIcon size={16} />}>View Text</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {isClassified && items.map((item) => (
                      <TableRow key={item.instrumentId} hover>
                        <TableCell sx={{ fontWeight: 500, color: 'primary.main' }}>{item.sourceTitle}</TableCell>
                        <TableCell>
                          <StatusBadge label={item.status} tone={item.status === 'Published' ? 'green' : 'amber'} />
                        </TableCell>
                        <TableCell>
                          {item.riskRating && <RiskBadge value={item.riskRating} />}
                        </TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataCard>
        );
      })()}

      <DataCard
        noPadding
        title={(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <ListBulletIcon size={18} sx={{ color: TL.gray400 }} />
            Discovered Documents
          </Box>
        )}
        actions={(
          <Box sx={{ width: { xs: 180, sm: 260 } }}>
            <SearchInput value={docSearch} onChange={setDocSearch} placeholder="Search by title..." />
          </Box>
        )}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell sx={{ width: 100 }}>Risk</TableCell>
                <TableCell sx={{ width: 140 }}>Discovered</TableCell>
                <TableCell sx={{ width: 110 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInstruments.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: TL.gray500 }}>
                  {docSearch ? 'No documents match your search' : 'No documents discovered yet'}
                </TableCell></TableRow>
              ) : filteredInstruments.map((inst) => (
                <TableRow key={inst.instrumentId} hover>
                  <TableCell sx={{ fontWeight: 500, color: 'primary.main', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inst.sourceTitle}
                  </TableCell>
                  <TableCell>
                    {inst.riskRating ? <RiskBadge value={inst.riskRating} /> : '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: TL.gray500, whiteSpace: 'nowrap' }}>{formatDt(inst.discoveredAt)}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="View PDF">
                        <IconButton size="small" onClick={() => handleViewPdf(inst)}>
                          <ChevronRightIcon size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Extracted Text">
                        <IconButton size="small" onClick={() => handleViewText(inst)}>
                          <DocumentTextIcon size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DataCard>

      <Dialog open={textOpen} onClose={() => setTextOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{textTitle}</Box>
          <IconButton onClick={() => setTextOpen(false)} size="small"><XMarkIcon size={20} /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {textLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : (
            <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8125rem', fontFamily: TL.mono, lineHeight: 1.6, color: TL.gray700 }}>
              {textContent}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setTextOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Config Editor Modal */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Scraper Configuration
          <IconButton onClick={() => setConfigOpen(false)} size="small"><XMarkIcon size={20} /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Name" size="small" value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Abbreviation" size="small" value={config.abbreviation}
                onChange={(e) => setConfig({ ...config, abbreviation: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Website URL" size="small" value={config.websiteUrl}
                onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Publication Page URL" size="small" value={config.publicationPageUrl}
                onChange={(e) => setConfig({ ...config, publicationPageUrl: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
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
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="PDF Link Selector" size="small" value={config.pdfLinkSelector}
                onChange={(e) => setConfig({ ...config, pdfLinkSelector: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Max Pages Per Run" size="small" type="number"
                value={config.maxPagesPerRun}
                onChange={(e) => setConfig({ ...config, maxPagesPerRun: parseInt(e.target.value) || 0 })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Max PDF Size (MB)" size="small" type="number"
                value={config.maxPdfSizeMb}
                onChange={(e) => setConfig({ ...config, maxPdfSizeMb: parseInt(e.target.value) || 0 })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
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
            <Grid size={{ xs: 6, sm: 1.5 }}>
              <FormControlLabel control={
                <Switch checked={config.scraperEnabled ?? false}
                  onChange={(e) => setConfig({ ...config, scraperEnabled: e.target.checked })} />
              } label="Enabled" />
            </Grid>
            <Grid size={{ xs: 6, sm: 1.5 }}>
              <FormControlLabel control={
                <Switch checked={config.paginationEnabled ?? false}
                  onChange={(e) => setConfig({ ...config, paginationEnabled: e.target.checked })} />
              } label="Paginate" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfigOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
