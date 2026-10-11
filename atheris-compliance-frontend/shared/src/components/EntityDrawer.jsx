import { Box, Drawer, IconButton, Typography, Button } from '@mui/material';
import { Close, OpenInNew } from '@mui/icons-material';

/**
 * Right-side entity drawer used by the Act detail tabs and the Obligation detail tabs.
 *
 * Presentational only: the caller owns `open`/`onClose`, supplies a `title`/`subtitle`
 * (usually rendered from the row it already has) and the body (a `*DetailContent`).
 * A small "Open full page" action is pinned at the END of the body when `onOpenFull`
 * is provided, so a row can be inspected in place without leaving the parent page.
 */
export default function EntityDrawer({
  open, onClose, title, subtitle, onOpenFull, fullPageLabel = 'Open full page',
  width = 560, children,
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: width }, display: 'flex', flexDirection: 'column' } }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5,
        borderBottom: '1px solid #E2E8F0', bgcolor: '#F7FAFC',
      }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {title && (
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}
              noWrap title={typeof title === 'string' ? title : undefined}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onClose}><Close /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {children}
        {onOpenFull && (
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" variant="text" endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
              onClick={onOpenFull} sx={{ textTransform: 'none', fontWeight: 600 }}>
              {fullPageLabel}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}