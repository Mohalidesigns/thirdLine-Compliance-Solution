import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, CircularProgress, Alert, IconButton, Tooltip, Button, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Grid,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, SectionTable, StatusBadge, EntityDrawer,
  ArrowPathIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, FolderOpenIcon,
  ClipboardDocumentCheckIcon, ShieldCheckIcon, DocumentTextIcon, LinkIcon, DocumentIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isReadOnly } from '../utils/roles';

const CATEGORIES = [
  { key: 'control_tests', label: 'Control Tests', tone: 'blue', icon: <ClipboardDocumentCheckIcon /> },
  { key: 'findings', label: 'Findings', tone: 'red', icon: <ShieldCheckIcon /> },
  { key: 'returns', label: 'Returns', tone: 'green', icon: <DocumentTextIcon /> },
  { key: 'obligations', label: 'Obligations', tone: 'amber', icon: <DocumentIcon /> },
  { key: 'controls', label: 'Controls', tone: 'orange', icon: <ShieldCheckIcon /> },
  { key: 'runbooks', label: 'Runbooks', tone: 'purple', icon: <FolderOpenIcon /> },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const CATEGORY_TONE = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.tone]));

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

export default function EvidenceVaultPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canUpload = !isReadOnly(user?.role);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [snack, setSnack] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['evidence', 'register', { category, q: search, page, size }],
    queryFn: ({ signal }) => api.evidence.register({ category, q: search, page, size }, { signal }),
    keepPreviousData: true,
  });

  const { data: stats } = useQuery({
    queryKey: ['evidence', 'stats'],
    queryFn: ({ signal }) => api.evidence.stats({ signal }),
  });

  const rows = data?.content || [];
  const total = data?.totalElements ?? 0;

  const filtered = useMemo(() => (
    sourceType ? rows.filter((r) => r.sourceType === sourceType) : rows
  ), [rows, sourceType]);

  const kpiItems = [
    { key: '', label: 'All Evidence', value: stats?.total ?? 0, tone: 'blue', icon: <FolderOpenIcon /> },
    ...CATEGORIES.map((c) => ({
      key: c.key, label: c.label, value: stats?.byCategory?.[c.key] ?? 0, tone: c.tone, icon: c.icon,
    })),
  ];

  const COLUMNS = [
    { id: 'originalName', label: 'File', minWidth: 280,
      render: (r) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0 }}><DocumentTextIcon size={18} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ ...ellipsis(260), color: 'primary.main', fontWeight: 500 }}>
              {r.originalName}
            </Typography>
            <Typography variant="caption" color="text.secondary">{formatSize(r.fileSize)}</Typography>
          </Box>
        </Box>
      ) },
    { id: 'category', label: 'Category', minWidth: 150,
      render: (r) => <StatusBadge tone={CATEGORY_TONE[r.category] || 'gray'} label={CATEGORY_LABEL[r.category] || r.category || '—'} /> },
    { id: 'linkedLabel', label: 'Linked to', minWidth: 260,
      render: (r) => (r.linkedLabel
        ? (r.linkedPath
          ? <Typography variant="body2" component="button" onClick={(e) => { e.stopPropagation(); navigate(r.linkedPath); }}
              sx={{ ...ellipsis(280), color: 'primary.main', background: 'none', border: 0, p: 0, cursor: 'pointer', textAlign: 'left' }}>
              {r.linkedLabel}
            </Typography>
          : <Typography variant="body2" sx={ellipsis(280)}>{r.linkedLabel}</Typography>)
        : <Typography variant="body2" color="text.secondary">—</Typography>) },
    { id: 'uploadedByName', label: 'Uploaded by', minWidth: 160,
      render: (r) => <Typography variant="body2" sx={ellipsis(180)}>{r.uploadedByName || '—'}</Typography> },
    { id: 'createdAt', label: 'Uploaded', minWidth: 130,
      render: (r) => <Typography variant="body2" color="text.secondary">{formatDate(r.createdAt)}</Typography> },
  ];

  async function download(fileId, name) {
    try {
      const { blob, name: filename } = await api.evidence.download(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || name || 'evidence';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setSnack({ severity: 'error', message: e.message || 'Download failed.' }); }
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['evidence'] });

  return (
    <Box>
      <PageHeader
        title="Evidence Vault"
        subtitle={`${stats?.total ?? 0} files — control tests, findings, returns, obligations, controls and runbooks`}
        actions={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {canUpload && (
              <Button variant="contained" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setUploadOpen(true)}>
                Upload Evidence
              </Button>
            )}
            <Tooltip title="Refresh"><IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton></Tooltip>
          </Box>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load evidence.'}</Alert>}

      <KpiCards items={kpiItems.map((k) => ({ ...k, active: k.key === category }))}
        onSelect={(key) => { setCategory(key); setPage(0); }} columns={4} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search file, description or record…', minWidth: 280 }}
        filters={[
          { key: 'sourceType', label: 'Source type', minWidth: 180, value: sourceType,
            onChange: (v) => setSourceType(v), allLabel: 'All source types',
            options: [
              { value: 'control_test', label: 'Control test' },
              { value: 'finding', label: 'Finding' },
              { value: 'return_instance', label: 'Return data' },
              { value: 'return_receipt', label: 'Filing receipt' },
              { value: 'return_event', label: 'Return event' },
              { value: 'obligation', label: 'Obligation' },
              { value: 'control', label: 'Control' },
              { value: 'RUNBOOK_STEP', label: 'Runbook step' },
            ] },
        ]}
        showClear={!!search || !!sourceType || !!category}
        onClear={() => { setSearch(''); setSourceType(''); setCategory(''); setPage(0); }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <SectionTable
          columns={COLUMNS}
          rows={filtered}
          total={sourceType ? filtered.length : total}
          page={page}
          size={size}
          onPage={setPage}
          onSize={(s) => { setSize(s); setPage(0); }}
          onRowClick={(r) => setSelected(r)}
          rowKey={(r) => r.fileId}
          emptyMessage="No evidence files match the current filters."
        />
      )}

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.originalName}
        subtitle={CATEGORY_LABEL[selected?.category] || selected?.category}
        onOpenFull={selected?.linkedPath ? () => navigate(selected.linkedPath) : undefined}
        fullPageLabel="Open linked record"
      >
        {selected && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Item label="Category" value={CATEGORY_LABEL[selected.category] || selected.category} />
              <Item label="Source type" value={selected.sourceType} />
              <Item label="Size" value={formatSize(selected.fileSize)} />
              <Item label="Uploaded" value={formatDate(selected.createdAt)} />
              <Item label="Uploaded by" value={selected.uploadedByName || '—'} />
              <Item label="Type" value={selected.mimeType} />
            </Box>
            {selected.linkedLabel && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>Linked to</Typography>
                {selected.linkedPath ? (
                  <Box><Typography variant="body2" component="button" onClick={() => navigate(selected.linkedPath)}
                    sx={{ color: 'primary.main', background: 'none', border: 0, p: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <LinkIcon size={14} />{selected.linkedLabel}
                  </Typography></Box>
                ) : (
                  <Typography variant="body2">{selected.linkedLabel}</Typography>
                )}
              </Box>
            )}
            {selected.description && <Item label="Description" value={selected.description} />}
            <Button variant="contained" startIcon={<ArrowDownTrayIcon size={16} />}
              onClick={() => download(selected.fileId, selected.originalName)} sx={{ alignSelf: 'flex-start' }}>
              Download
            </Button>
          </Box>
        )}
      </EntityDrawer>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
        onSaved={() => { setUploadOpen(false); refresh(); setSnack({ severity: 'success', message: 'Evidence uploaded' }); }}
        onSnackbar={(m) => setSnack({ severity: 'error', message: m })} />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function Item({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Box>
  );
}

function UploadDialog({ open, onClose, onSaved, onSnackbar }) {
  const [file, setFile] = useState(null);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setFile(null); setSourceType(''); setSourceId(''); setDescription(''); };
  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (sourceType) fd.append('sourceType', sourceType);
      if (sourceId) fd.append('sourceId', sourceId);
      if (description) fd.append('description', description);
      await api.evidence.upload(fd);
      reset();
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      TransitionProps={{ onExited: reset }}>
      <DialogTitle>Upload Evidence</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <Button variant="outlined" component="label" fullWidth startIcon={<ArrowUpTrayIcon size={16} />} sx={{ py: 3, borderStyle: 'dashed' }}>
              {file ? file.name : 'Click to select file'}
              <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Source type" fullWidth size="small" value={sourceType}
              onChange={(e) => { setSourceType(e.target.value); setSourceId(''); }}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="control">Control</MenuItem>
              <MenuItem value="finding">Finding</MenuItem>
              <MenuItem value="return_instance">Return</MenuItem>
              <MenuItem value="control_test">Control test</MenuItem>
              <MenuItem value="obligation">Obligation</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label={sourceType ? 'Source ID' : 'Source (choose a type)'} fullWidth size="small" type="number"
              disabled={!sourceType} value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !file}>
          {saving ? 'Uploading…' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}