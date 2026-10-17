import { Box, Typography } from '@mui/material';
import { TL } from '../theme/tokens';

/**
 * Thirdline panel card (`.card`): white, 12px radius, gray-100 hairline, shadow-sm.
 * Optional header row (16px 24px, border-bottom) with a 14px/600 title, a gray subtitle
 * and a trailing `actions` node — typically a small "View All" link.
 */
export default function DataCard({
  title, subtitle, actions, children,
  sx, contentSx, noPadding = false,
}) {
  const hasHeader = title || subtitle || actions;
  return (
    <Box sx={{
      bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px',
      boxShadow: TL.cardShadow, overflow: 'hidden', ...sx,
    }}>
      {hasHeader && (
        <Box sx={{
          px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: `1px solid ${TL.gray100}`,
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {title && (
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: '1.25rem', color: TL.gray800 }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, mt: 0.25 }}>{subtitle}</Typography>
            )}
          </Box>
          {actions}
        </Box>
      )}
      {noPadding ? children : <Box sx={{ p: 3, ...contentSx }}>{children}</Box>}
    </Box>
  );
}

/** Small header link ("View All") in Thirdline's 12px primary style. */
export function CardLink({ children, onClick, href, sx }) {
  return (
    <Typography
      component={href ? 'a' : 'button'}
      href={href}
      onClick={onClick}
      sx={{
        fontSize: '0.75rem', color: TL.primary, fontWeight: 500, background: 'none', border: 0,
        cursor: 'pointer', p: 0, textDecoration: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
        '&:hover': { textDecoration: 'underline' }, ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
