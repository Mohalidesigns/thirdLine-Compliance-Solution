import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Typography, Tooltip, Stack, CircularProgress } from '@mui/material';
import { ArrowDownTrayIcon } from 'shared';
import { api } from '../../services/api';

function formatSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export function EvidenceFileButton({ file, size = 'small' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setError('');
    setBusy(true);
    try {
      const res = await api.evidence.download(file.fileId);
      const url = URL.createObjectURL(res.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.name || file.originalName || 'evidence';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tooltip title={error || file.originalName || 'Download evidence'}>
      <span>
        <Button size={size} variant="outlined" disabled={busy}
          startIcon={<ArrowDownTrayIcon size={14} />} onClick={download}>
          {busy ? 'Downloading…' : (file.originalName || 'Evidence')}
        </Button>
      </span>
    </Tooltip>
  );
}

export function EvidenceFileList({ sourceType, sourceId, emptyText = 'No evidence attached.' }) {
  const query = useQuery({
    queryKey: ['evidence', 'source', sourceType, String(sourceId)],
    queryFn: ({ signal }) => api.evidence.bySource(sourceType, sourceId, { signal }),
    enabled: sourceId != null,
  });

  if (sourceId == null) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }
  if (query.isPending) {
    return <Box sx={{ py: 1 }}><CircularProgress size={18} /></Box>;
  }
  if (query.isError) {
    return <Typography variant="body2" color="error.main">{query.error?.message || 'Failed to load evidence'}</Typography>;
  }
  const files = query.data || [];
  if (files.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }
  return (
    <Stack spacing={1}>
      {files.map((f) => (
        <Box key={f.fileId} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <EvidenceFileButton file={f} />
          {f.description ? <Typography variant="caption" color="text.secondary">{f.description}</Typography> : null}
          {f.fileSize ? <Typography variant="caption" color="text.secondary">{formatSize(f.fileSize)}</Typography> : null}
          {f.createdAt ? <Typography variant="caption" color="text.secondary">{new Date(f.createdAt).toLocaleDateString()}</Typography> : null}
        </Box>
      ))}
    </Stack>
  );
}
