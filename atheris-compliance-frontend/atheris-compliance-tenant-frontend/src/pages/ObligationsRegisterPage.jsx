import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, FormControlLabel, Checkbox, Snackbar, Tooltip,
  TablePagination, Drawer, Divider, List, ListItem, ListItemButton, ListItemText,
  LinearProgress, Switch, Collapse, TableSortLabel,
} from '@mui/material';
import {
  Search, Refresh, Visibility, Edit, History, UploadFile, Close, Download,
  Link as LinkIcon, CheckCircle, Warning as WarningIcon, Article, ArrowBack,
  CalendarToday,
} from '@mui/icons-material';
import { api, API_BASE, getToken } from '../services/api';

const RISK_CONFIG = {
  Extreme: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

const STATUS_COLOR = { active: 'success', classified: 'info', unclassified: 'warning', under_review: 'default' };

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22 }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22 }} />;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  { id: 'obligation', label: 'Obligation', minWidth: 360, sortField: 'description' },
  { id: 'risk', label: 'Risk', minWidth: 110, sortField: 'tenantRiskRating' },
  { id: 'owner', label: 'Owner', minWidth: 130, sortField: 'assignedOwnerName' },
  { id: 'status', label: 'Status', minWidth: 110, sortField: 'status' },
  { id: 'returns', label: 'Returns', minWidth: 110 },
];

export default function ObligationsRegisterPage() {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // filters
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [themeFilter, setThemeFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [hasGap, setHasGap] = useState(false);
  const [noControl, setNoControl] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  // detail drawer
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [view, setView] = useState('overview');

  // edit drawer
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [controls, setControls] = useState([]);
  const [returns, setReturns] = useState([]);
  const [evidenceFile, setEvidenceFile] = useState(null);

  const [snack, setSnack] = useState(null);
  const notify = (severity, message) => setSnack({ severity, message });

  const hasFilters = search || riskFilter !== 'All' || regulatorFilter !== 'All'
    || themeFilter !== 'All' || ownerFilter !== 'All' || statusFilter !== 'All' || hasGap || noControl;

  const loadStats = useCallback(async () => {
    try { setStats(await api.obligations.stats()); } catch { /* optional */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: rowsPerPage };
      if (search) params.q = search;
      if (riskFilter !== 'All') params.risk = riskFilter;
      if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
      if (themeFilter !== 'All') params.theme = themeFilter;
      if (ownerFilter !== 'All') params.owner = ownerFilter;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (hasGap) params.hasGap = 'true';
      if (noControl) params.noControl = 'true';
      if (sortField) params.sort = `${sortField},${sortDir}`;
      const data = await api.obligations.register(params);
      setItems(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (e) { setError(e.message || 'Failed to load obligations.'); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, search, riskFilter, regulatorFilter, themeFilter, ownerFilter, statusFilter, hasGap, noControl, sortField, sortDir]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    if (editOpen) {
      api.controls.list({}).then(d => setControls(Array.isArray(d) ? d : (d.content || []))).catch(() => {});
      api.returns.list().then(d => setReturns(Array.isArray(d) ? d : (d.content || []))).catch(() => {});
    }
  }, [editOpen]);

  function clearFilters() {
    setSearch(''); setRiskFilter('All'); setRegulatorFilter('All');
    setThemeFilter('All'); setOwnerFilter('All'); setStatusFilter('All'); setHasGap(false); setNoControl(false);
    setPage(0);
  }

  async function openDetail(row) {
    setDetailLoading(true);
    setError('');
    setView('overview');
    try {
      const d = await api.obligations.obligationDetail(row.obligationId);
      setSelected(d);
    } catch (e) { notify('error', e.message || 'Failed to load detail.'); }
    finally { setDetailLoading(false); }
  }

  function openEdit() {
    if (!selected) return;
    setEditData({
      applicability: selected.applicability || 'applicable',
      applicabilityReasoning: selected.applicabilityReasoning || '',
      tenantRiskRating: selected.tenantRiskRating || '',
      riskJustification: selected.riskJustification || '',
      riskType: selected.riskType || '',
      impactRating: selected.impactRating || '',
      likelihoodRating: selected.likelihoodRating || '',
      assignedOwnerName: selected.assignedOwnerName || '',
      assignedDepartment: selected.assignedDepartment || '',
      linkedControlIds: selected.linkedControls?.map(c => c.controlId) || [],
      hasGap: !!selected.hasGap,
      gapDescription: selected.gapDescription || '',
      linkedReturnIds: selected.linkedReturns?.map(r => r.returnId) || [],
      changeReason: '',
    });
    setEvidenceFile(null);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const body = { ...editData };
      await api.obligations.classify(selected.obligationId, body);
      if (editData.linkedReturnIds && editData.linkedReturnIds.length > 0) {
        await api.obligations.linkReturns(selected.obligationId, editData.linkedReturnIds);
      }
      if (evidenceFile) {
        const fd = new FormData();
        fd.append('file', evidenceFile);
        fd.append('sourceType', 'obligation');
        fd.append('sourceId', String(selected.obligationId));
        fd.append('description', editData.changeReason || 'Evidence uploaded during classification edit');
        await api.evidence.upload(fd);
      }
      notify('success', 'Classification saved');
      setEditOpen(false);
      openDetail({ obligationId: selected.obligationId });
      loadList();
      loadStats();
    } catch (e) { notify('error', e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDownloadEvidence(ev) {
    try {
      const { blob, name } = await api.evidence.download(ev.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { notify('error', 'Failed to download evidence.'); }
  }

  async function handleViewPdf() {
    const id = selected?.instrumentId;
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/instruments/${id}/pdf`, {
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      });
      if (!res.ok) throw new Error('PDF load failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { notify('error', 'Failed to load PDF.'); }
  }

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'highRisk') { setRiskFilter('High'); setStatusFilter('All'); }
    else if (type === 'gaps') { setNoControl(true); setHasGap(false); }
    else if (type === 'underReview') { setStatusFilter('unclassified'); setHasGap(false); setNoControl(false); }
    else { setRiskFilter('All'); setHasGap(false); setNoControl(false); setStatusFilter('All'); }
  }

  const kpis = [
    { key: 'total', label: 'Total Obligations', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
    { key: 'gaps', label: 'No Control', value: stats?.gaps ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
    { key: 'underReview', label: 'Under Review', value: stats?.underReview ?? 0, color: '#805AD5', bg: '#FAF5FF' },
  ];

  const riskLevels = stats?.riskLevels?.length ? stats.riskLevels : ['Extreme', 'High', 'Medium', 'Low'];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Obligations Register</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} obligation{total !== 1 ? 's' : ''} — assign owners, rate risk and track control gaps
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { loadList(); loadStats(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            onClick={() => applyKpiFilter(k.key)}
            sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${k.color}`,
              transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search obligation, title or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk" sx={{ minWidth: 110 }}>
          {['All', ...riskLevels].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorFilter} onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 130 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.regulators || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={themeFilter} onChange={e => { setThemeFilter(e.target.value); setPage(0); }}
          label="Theme" sx={{ minWidth: 120 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.themes || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setPage(0); }}
          label="Owner" sx={{ minWidth: 140 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.owners || []).map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 120 }}>
          {['All', 'active', 'unclassified', 'under_review'].map(s =>
            <MenuItem key={s} value={s}>{s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
        </TextField>
        <FormControlLabel control={
          <Checkbox size="small" checked={hasGap} onChange={e => { setHasGap(e.target.checked); setPage(0); }} />
        } label={<Typography variant="body2">Has gap</Typography>} />
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No obligations found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(c.sortField);
                            setSortDir('asc');
                          }
                          setPage(0);
                        } : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={sortDir}
                              sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                              {c.label}
                            </TableSortLabel>
                          : c.label}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const rating = item.tenantRiskRating || item.inherentRiskRating;
                  const rc = RISK_CONFIG[rating] || {};
                  return (
                    <TableRow key={item.obligationId} hover
                      onClick={() => openDetail(item)}
                      sx={{ cursor: 'pointer', bgcolor: rc.bg || 'inherit',
                        '&:hover': { bgcolor: rc.bg || '#F7FAFC' },
                        borderLeft: rc.chip ? `3px solid ${rc.chip}` : '3px solid transparent' }}>
                      <TableCell sx={{ color: 'text.secondary' }}>{total - (page * rowsPerPage) - idx}</TableCell>
                      <TableCell>
                        <Tooltip title={item.description || 'Untitled obligation'}>
                          <Typography variant="body2" sx={{ maxWidth: 360,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.description || 'Untitled obligation'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {riskChip(rating)}
                          {item.hasGap && (
                            <Tooltip title="Gap identified — no control covers this">
                              <Chip size="small" icon={<WarningIcon sx={{ fontSize: 14 }} />} label="Gap"
                                color="warning" sx={{ height: 22 }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {item.assignedOwnerName
                          ? <Tooltip title={item.assignedOwnerName}>
                              <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.assignedOwnerName}
                              </Typography>
                            </Tooltip>
                          : <Typography variant="body2" color="text.secondary">Unassigned</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={item.status || 'unknown'}
                          color={STATUS_COLOR[item.status] || 'default'} sx={{ height: 22 }} />
                      </TableCell>
                      <TableCell>
                        {item.returnNames?.length > 0
                          ? <Tooltip title={item.returnNames.join(', ')}>
                              <Chip size="small" icon={<LinkIcon sx={{ fontSize: 14 }} />}
                                label={`${item.returnNames.length} return${item.returnNames.length > 1 ? 's' : ''}`}
                                variant="outlined" sx={{ height: 22 }} />
                            </Tooltip>
                          : <Typography variant="body2" color="text.secondary">-</Typography>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      {/* Detail Drawer */}
      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100%' } }}>
        {detailLoading ? (
          <Box sx={{ p: 4 }}><LinearProgress /></Box>
        ) : selected && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <IconButton onClick={() => setSelected(null)}><ArrowBack /></IconButton>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={handleViewPdf}>PDF</Button>
              <Button size="small" variant="contained" startIcon={<Edit />} onClick={openEdit}>Edit</Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              {riskChip(selected.tenantRiskRating || selected.inherentRiskRating)}
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {selected.regulatorAbbreviation || selected.regulatorName}
              </Typography>
              <Chip size="small" label={selected.status || 'unknown'}
                color={STATUS_COLOR[selected.status] || 'default'} sx={{ height: 22 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {selected.description || 'Untitled obligation'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{selected.sourceTitle}</Typography>

            {/* Classification */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Your Classification</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle sx={{ color: selected.applicability === 'applicable' ? '#38A169' : '#CBD5E0', fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {selected.applicability || 'Not classified'}
                </Typography>
                {selected.classifiedByName && (
                  <Typography variant="caption" color="text.secondary">— {selected.classifiedByName}</Typography>
                )}
              </Box>
              {selected.classifiedAt && (
                <Typography variant="caption" color="text.secondary">{formatDate(selected.classifiedAt)}</Typography>
              )}
              {selected.applicabilityReasoning && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{selected.applicabilityReasoning}</Typography>
              )}
            </Paper>

            {/* Risk Assessment */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Internal Risk Assessment</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2, mb: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Inherent</Typography>
                  <Box sx={{ mt: 0.5 }}>{riskChip(selected.inherentRiskRating)}</Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Residual</Typography>
                  <Box sx={{ mt: 0.5 }}>{riskChip(selected.residualRiskRating)}</Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Impact</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.impactRating || '-'} / {selected.likelihoodRating || '-'}</Typography>
                </Box>
              </Box>
              {selected.riskJustification && (
                <Typography variant="body2" color="text.secondary">{selected.riskJustification}</Typography>
              )}
            </Paper>

            {/* Owner */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Compliance Owner</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {selected.assignedOwnerName || 'Unassigned'}
              </Typography>
              {selected.assignedDepartment && (
                <Typography variant="caption" color="text.secondary">{selected.assignedDepartment}</Typography>
              )}
            </Paper>

            {/* Controls */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Linked Controls</Typography>
              {selected.linkedControls?.length > 0 ? (
                <List dense disablePadding>
                  {selected.linkedControls.map(c => (
                    <ListItem key={c.controlId} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={<Typography variant="body2">{c.controlNumber} — {c.name}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">
                          {c.theme || ''}{c.controlType ? ` · ${c.controlType}` : ''}{c.inherentRisk ? ` · Inherent: ${c.inherentRisk}` : ''}
                        </Typography>} />
                    </ListItem>
                  ))}
                </List>
              ) : <Typography variant="body2" color="text.secondary">No controls linked</Typography>}
            </Paper>

            {/* Returns */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Return Required</Typography>
              {selected.linkedReturns?.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.linkedReturns.map(r => (
                    <Chip key={r.returnId} size="small" icon={<LinkIcon sx={{ fontSize: 14 }} />}
                      label={`${r.returnName}${r.frequency ? ` (${r.frequency})` : ''}`} variant="outlined" sx={{ height: 22 }} />
                  ))}
                </Box>
              ) : <Typography variant="body2" color="text.secondary">None mapped</Typography>}
            </Paper>

            {/* Gap */}
            {selected.hasGap && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Gap identified:</strong> {selected.gapDescription || 'No control covers this obligation'}
              </Alert>
            )}

            {/* Evidence */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Evidence</Typography>
              {selected.evidence?.length > 0 ? (
                <List dense disablePadding>
                  {selected.evidence.map(ev => (
                    <ListItem key={ev.fileId} disableGutters
                      secondaryAction={
                        <Tooltip title="Download"><IconButton size="small" onClick={() => handleDownloadEvidence(ev)}><Download fontSize="small" /></IconButton></Tooltip>
                      }>
                      <ListItemText
                        primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{ev.originalName}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">
                          {ev.uploadedByName || 'Unknown'} · {ev.createdAt ? formatDate(ev.createdAt) : ''}
                        </Typography>} />
                    </ListItem>
                  ))}
                </List>
              ) : <Typography variant="body2" color="text.secondary">No evidence uploaded</Typography>}
            </Paper>

            {/* History */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Version History</Typography>
              {selected.history?.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No version history recorded.</Typography>
              ) : selected.history.map((h, i) => (
                <Box key={i} sx={{ mb: 1.5, pb: 1.5, borderBottom: i < selected.history.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Version {h.classificationVersion} — {h.changedAt ? formatDate(h.changedAt) : '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {h.changedByName || `User #${h.changedByUserId}`}
                  </Typography>
                  {h.applicability && <Typography variant="body2">Applicability: {h.applicability}</Typography>}
                  {h.tenantRiskRating && <Typography variant="body2">Risk: {h.tenantRiskRating}</Typography>}
                  {h.hasGap != null && <Typography variant="body2">Has gap: {h.hasGap ? 'Yes' : 'No'}</Typography>}
                  {h.changeReason && <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5 }}>Reason: {h.changeReason}</Typography>}
                </Box>
              ))}
            </Paper>
          </Box>
        )}
      </Drawer>

      {/* Edit Drawer */}
      <Drawer anchor="right" open={editOpen} onClose={() => setEditOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100%' } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <IconButton onClick={() => setEditOpen(false)}><ArrowBack /></IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Edit Classification</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{selected?.description}</Typography>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Ownership</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <TextField size="small" fullWidth label="Compliance Owner" value={editData.assignedOwnerName || ''}
                onChange={e => setEditData({ ...editData, assignedOwnerName: e.target.value })} />
              <TextField size="small" fullWidth label="Department" value={editData.assignedDepartment || ''}
                onChange={e => setEditData({ ...editData, assignedDepartment: e.target.value })} />
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Internal Risk Rating</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
              <TextField select size="small" label="Risk Rating" value={editData.tenantRiskRating || ''}
                onChange={e => setEditData({ ...editData, tenantRiskRating: e.target.value })}>
                <MenuItem value=""><em>None</em></MenuItem>
                {riskLevels.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Impact" value={editData.impactRating || ''}
                onChange={e => setEditData({ ...editData, impactRating: e.target.value })}>
                <MenuItem value=""><em>None</em></MenuItem>
                {['Critical', 'High', 'Medium', 'Low'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Likelihood" value={editData.likelihoodRating || ''}
                onChange={e => setEditData({ ...editData, likelihoodRating: e.target.value })}>
                <MenuItem value=""><em>None</em></MenuItem>
                {['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Box>
            <TextField size="small" fullWidth multiline rows={2} label="Risk justification" value={editData.riskJustification || ''}
              onChange={e => setEditData({ ...editData, riskJustification: e.target.value })} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Linked Controls</Typography>
            <Box sx={{ maxHeight: 160, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              {controls.length === 0 ? <Typography variant="caption" color="text.secondary">No controls available</Typography>
              : controls.map(c => (
                <FormControlLabel key={c.controlId} control={
                  <Checkbox size="small" checked={(editData.linkedControlIds || []).includes(c.controlId)}
                    onChange={e => {
                      const ids = editData.linkedControlIds || [];
                      setEditData({ ...editData, linkedControlIds: e.target.checked ? [...ids, c.controlId] : ids.filter(x => x !== c.controlId) });
                    }} />
                } label={<Typography variant="body2">{c.controlNumber} — {c.name}</Typography>}
                  sx={{ display: 'flex', width: '100%', m: 0 }} />
              ))}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Return Required</Typography>
            <Box sx={{ maxHeight: 140, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              {returns.length === 0 ? <Typography variant="caption" color="text.secondary">No returns configured</Typography>
              : returns.map(r => (
                <FormControlLabel key={r.returnId} control={
                  <Checkbox size="small" checked={(editData.linkedReturnIds || []).includes(r.returnId)}
                    onChange={e => {
                      const ids = editData.linkedReturnIds || [];
                      setEditData({ ...editData, linkedReturnIds: e.target.checked ? [...ids, r.returnId] : ids.filter(x => x !== r.returnId) });
                    }} />
                } label={<Typography variant="body2">{r.returnName} {r.frequency ? `(${r.frequency})` : ''}</Typography>}
                  sx={{ display: 'flex', width: '100%', m: 0 }} />
              ))}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Gap</Typography>
            <FormControlLabel control={
              <Switch checked={!!editData.hasGap}
                onChange={e => setEditData({ ...editData, hasGap: e.target.checked })} size="small" />
            } label={<Typography variant="body2">Has gap (no control covers this obligation)</Typography>} />
            {editData.hasGap && (
              <TextField size="small" fullWidth multiline rows={2} label="Gap description" value={editData.gapDescription || ''}
                onChange={e => setEditData({ ...editData, gapDescription: e.target.value })} sx={{ mt: 1.5 }} />
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Supporting Evidence</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button component="label" variant="outlined" startIcon={<UploadFile />} size="small">
                {evidenceFile ? evidenceFile.name : 'Upload evidence (optional)'}
                <input type="file" hidden onChange={e => setEvidenceFile(e.target.files?.[0] || null)} />
              </Button>
              {evidenceFile && <Button size="small" color="error" onClick={() => setEvidenceFile(null)}>Remove</Button>}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Reason for Update</Typography>
            <TextField size="small" fullWidth multiline rows={2} label="Reason for update" required
              value={editData.changeReason || ''}
              onChange={e => setEditData({ ...editData, changeReason: e.target.value })} />
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={saving || !editData.changeReason}>
              {saving ? <CircularProgress size={20} /> : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
