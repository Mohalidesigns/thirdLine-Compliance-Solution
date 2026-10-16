import { useState } from 'react';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { ArrowDownTrayIcon, TL } from 'shared';
import { api } from '../../../services/api';
import { formatBytes, formatDateTime, shortHash } from './executionUtils';


async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** SHA-256 shown truncated, full value in a tooltip, with a copy button. */
export function HashText({ hash, label = 'SHA-256' }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return null;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title={<span style={{ fontFamily: TL.mono, wordBreak: 'break-all' }}>{hash}</span>}>
        <Typography component="span" sx={{ fontFamily: TL.mono, fontSize: '0.6875rem', color: TL.gray600 }}>
          {label} {shortHash(hash)}
        </Typography>
      </Tooltip>
      <Tooltip title={copied ? 'Copied' : 'Copy hash'}>
        <IconButton size="small" sx={{ p: 0.25 }}
          onClick={async (e) => { e.stopPropagation(); if (await copyText(hash)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
          <ContentCopyIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function evidenceKind(ev) {
  if (ev.fileId || ev.fileName) return { icon: <AttachFileIcon sx={{ fontSize: 16 }} />, title: ev.fileName || 'File' };
  if (ev.externalRef) return { icon: <LinkOutlinedIcon sx={{ fontSize: 16 }} />, title: ev.externalRef };
  if (ev.attestationText) return { icon: <VerifiedUserOutlinedIcon sx={{ fontSize: 16 }} />, title: 'Attestation' };
  return { icon: <AttachFileIcon sx={{ fontSize: 16 }} />, title: 'Evidence' };
}

/**
 * Read-only list of captured evidence (evidence is immutable — no edit/delete affordances).
 * `stepLabel(ev)` optionally prefixes each row (used by the summary gallery).
 */
export default function EvidenceList({ execId, items = [], stepLabel, emptyText = 'No evidence captured yet.', onError }) {
  const [downloading, setDownloading] = useState(null);
  if (!items.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{emptyText}</Typography>;
  }
  const download = async (ev) => {
    setDownloading(ev.evidenceId);
    try { await api.runbooks.executions.downloadEvidence(execId, ev.evidenceId); }
    catch (e) { onError?.(e?.message || 'Download failed'); }
    finally { setDownloading(null); }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((ev) => {
        const kind = evidenceKind(ev);
        const downloadable = !!ev.fileId;
        return (
          <Box key={ev.evidenceId} sx={{
            border: `1px solid ${TL.gray100}`, borderRadius: '8px', p: 1.25, bgcolor: TL.gray50,
            display: 'flex', gap: 1.25, alignItems: 'flex-start',
          }}>
            <Box sx={{ color: TL.gray500, pt: 0.25 }}>{kind.icon}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                {stepLabel && (
                  <Chip size="small" label={stepLabel(ev)} sx={{ height: 20, fontFamily: TL.mono, fontSize: '0.6875rem' }} />
                )}
                <Tooltip title={kind.title}>
                  <Typography sx={{
                    fontSize: '0.8125rem', fontWeight: 600, color: TL.gray800,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320,
                  }}>
                    {kind.title}
                  </Typography>
                </Tooltip>
                {ev.evidenceType && (
                  <Chip size="small" variant="outlined" label={String(ev.evidenceType).replace(/_/g, ' ')}
                    sx={{ height: 20, fontSize: '0.6875rem' }} />
                )}
                {ev.fileSize != null && (
                  <Typography sx={{ fontSize: '0.6875rem', color: TL.gray500 }}>{formatBytes(ev.fileSize)}</Typography>
                )}
              </Box>
              {ev.attestationText && (
                <Typography sx={{ fontSize: '0.8125rem', color: TL.gray700, mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  “{ev.attestationText}”
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
                <HashText hash={ev.sha256} />
                <Typography sx={{ fontSize: '0.6875rem', color: TL.gray500 }}>
                  {ev.capturedByName || 'Unknown'} · {formatDateTime(ev.capturedAt)}
                </Typography>
              </Box>
            </Box>
            {downloadable && (
              <Button size="small" variant="text" disabled={downloading === ev.evidenceId}
                startIcon={<ArrowDownTrayIcon size={14} />} onClick={() => download(ev)} sx={{ flexShrink: 0 }}>
                {downloading === ev.evidenceId ? '…' : 'Download'}
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Monospace command block with a language label and a COPY button. */
export function CommandBlock({ command, lang }) {
  const [copied, setCopied] = useState(false);
  if (!command) return null;
  return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', border: `1px solid ${TL.gray200}` }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.5, bgcolor: '#111827', color: '#9CA3AF',
      }}>
        <Typography sx={{ fontSize: '0.6875rem', fontFamily: TL.mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {lang && lang !== 'none' ? lang : 'command'}
        </Typography>
        <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
          onClick={async () => { if (await copyText(command)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
          sx={{ color: '#E5E7EB', minWidth: 0, fontSize: '0.6875rem', fontWeight: 700 }}>
          {copied ? 'COPIED' : 'COPY'}
        </Button>
      </Box>
      <Box component="pre" sx={{
        m: 0, p: 1.5, bgcolor: '#1F2937', color: '#F9FAFB', fontFamily: TL.mono, fontSize: '0.8125rem',
        lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre',
      }}>
        {command}
      </Box>
    </Box>
  );
}
