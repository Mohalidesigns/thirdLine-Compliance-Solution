import { Box, Drawer, IconButton, Typography, Button } from '@mui/material';
import { TL } from '../theme/tokens';
import { XMarkIcon, ChevronRightIcon } from '../icons/heroicons';

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
        display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 2,
        borderBottom: `1px solid ${TL.gray100}`, bgcolor: '#FFFFFF',
      }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {title && (
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.4, color: TL.gray800 }}
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
        <IconButton size="small" onClick={onClose} aria-label="Close"><XMarkIcon size={20} /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: TL.bg }}>
        {children}
        {onOpenFull && (
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${TL.gray200}`, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" variant="text" endIcon={<ChevronRightIcon size={16} />}
              onClick={onOpenFull} sx={{ textTransform: 'none', fontWeight: 600 }}>
              {fullPageLabel}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}