import { useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import { errorMessage } from './executionUtils';

/**
 * Dialog shell shared by every execution modal (M12–M21). Parents mount it conditionally
 * (`{open && <XDialog/>}`) so form state resets on every open. `onConfirm` is async: on
 * success the dialog closes (unless `keepOpen`), on failure the server message is shown inline.
 */
export default function ActionDialog({
  title, subtitle, children, onClose, onConfirm, confirmLabel = 'Confirm', confirmColor = 'primary',
  disabled = false, maxWidth = 'sm', blocking = false, keepOpen = false, extraActions, hideConfirm = false,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      await onConfirm();
      if (!keepOpen) onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth={maxWidth}
      onClose={blocking || busy ? undefined : onClose}
      disableEscapeKeyDown={blocking}
    >
      <DialogTitle sx={{ pb: subtitle ? 0.5 : 1 }}>{title}</DialogTitle>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>{subtitle}</Typography>
      )}
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {extraActions}
        {!blocking && <Button onClick={onClose} disabled={busy}>{hideConfirm ? 'Close' : 'Cancel'}</Button>}
        {!hideConfirm && (
          <Button variant="contained" color={confirmColor} onClick={confirm} disabled={disabled || busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>
            {confirmLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
