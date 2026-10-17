import { useEffect, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import { errMsg } from './LibraryBadges';

/**
 * Small confirm/reason dialogs for the runbook detail page. Presentational: the page owns the
 * mutation and passes `pending` / `error` / `onConfirm`.
 */

/** M26 — Clone Runbook: new title (≥5 chars). */
export function CloneRunbookDialog({ open, onClose, sourceTitle, pending, error, onConfirm }) {
  const [title, setTitle] = useState('');
  useEffect(() => { if (open) setTitle(sourceTitle ? `${sourceTitle} (copy)` : ''); }, [open, sourceTitle]);
  const invalid = title.trim().length < 5;
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Clone runbook</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(error)}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Creates a new draft runbook with a copy of the current content. A new code is assigned.
        </Typography>
        <TextField fullWidth size="small" label="New title" value={title} onChange={(e) => setTitle(e.target.value)}
          error={invalid && title !== ''} helperText={invalid ? 'At least 5 characters' : ''} autoFocus />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" disabled={pending || invalid} onClick={() => onConfirm(title.trim())}>
          {pending ? 'Cloning…' : 'Clone'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** M25 — Deprecate / Archive: reason required (≥10 chars). `mode` = 'deprecate' | 'archive'. */
export function RetireRunbookDialog({ open, onClose, mode, pending, error, onConfirm }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const invalid = reason.trim().length < 10;
  const verb = mode === 'archive' ? 'Archive' : 'Deprecate';
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{verb} runbook</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(error)}</Alert>}
        <Alert severity="warning" sx={{ mb: 2 }}>
          {mode === 'archive'
            ? 'Archived runbooks are read-only and hidden from scheduling.'
            : 'Deprecated runbooks can no longer be executed or scheduled. Existing executions are kept.'}
        </Alert>
        <TextField fullWidth multiline minRows={3} size="small" label="Reason" required value={reason}
          onChange={(e) => setReason(e.target.value)} autoFocus
          helperText={invalid ? 'At least 10 characters — recorded in the audit trail' : ' '} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" color="warning" disabled={pending || invalid} onClick={() => onConfirm(reason.trim())}>
          {pending ? 'Saving…' : verb}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Generic destructive confirm (delete runbook, delete schedule). */
export function ConfirmDialog({ open, onClose, title, message, confirmLabel = 'Delete', pending, error, onConfirm }) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(error)}</Alert>}
        <Typography variant="body2">{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" color="error" disabled={pending} onClick={onConfirm}>
          {pending ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
