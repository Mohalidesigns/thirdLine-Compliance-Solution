import { Box, Button, Typography } from '@mui/material';
import { TL } from '../theme/tokens';
import { ArrowLeftIcon } from '../icons/heroicons';

/**
 * Thirdline page header: a full-width white band (border-bottom gray-100) carrying the
 * page title (24px/700), a gray subtitle and right-aligned actions. It bleeds over the
 * MainLayout content padding via negative margins, so use it only as the FIRST child of
 * a routed page — never inside a drawer or dialog (use DetailHeader / EntityDrawer there).
 *
 * Props: title, subtitle, actions (node), onBack + backLabel (small back link above the
 * title), children (an optional extra row under the title, e.g. chips or tabs).
 */
export const PAGE_GUTTER = { xs: 2, md: 4 };

export default function PageHeader({ title, subtitle, actions, onBack, backLabel = 'Back', children, sx }) {
  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        borderBottom: `1px solid ${TL.gray100}`,
        mx: { xs: -PAGE_GUTTER.xs, md: -PAGE_GUTTER.md },
        mt: { xs: -PAGE_GUTTER.xs, md: -PAGE_GUTTER.md },
        mb: 4,
        px: PAGE_GUTTER,
        py: 4,
        ...sx,
      }}
    >
      {onBack && (
        <Button
          size="small"
          variant="text"
          onClick={onBack}
          startIcon={<ArrowLeftIcon size={16} />}
          sx={{ mb: 1, ml: -1, px: 1, color: TL.gray500, '&:hover': { color: TL.primary, bgcolor: 'transparent' } }}
        >
          {backLabel}
        </Button>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
          <Typography component="h2" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.textPrimary }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography component="div" sx={{ mt: 0.5, fontSize: '0.875rem', lineHeight: '1.25rem', color: TL.gray500 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>{actions}</Box>
        )}
      </Box>
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}
