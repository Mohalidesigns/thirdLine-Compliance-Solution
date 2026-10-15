import { Box, Button, Typography } from '@mui/material';
import { TL, statusTone } from '../theme/tokens';
import StatusBadge from './StatusBadge';
import { ArrowLeftIcon } from '../icons/heroicons';

/**
 * Detail header in Thirdline style: a small gray back link, a 24px/700 title with an
 * optional status pill, a meta row (chips/links), a gray description and a `right` slot.
 *
 * In-flow (no full-bleed band) so it works both as a page header and inside an
 * EntityDrawer. On a routed full page, set `band` to render it as the white
 * PageHeader band that bleeds over the layout padding.
 * `backIcon` is accepted for backwards compatibility; the heroicon arrow is the default.
 */
export default function DetailHeader({
  onBack, backLabel = 'Back', backIcon,
  title, status, statusColor, statusTone: toneProp, meta, description, right, band = false, sx,
}) {
  const bandSx = band ? {
    bgcolor: '#FFFFFF', borderBottom: `1px solid ${TL.gray100}`,
    mx: { xs: -2, md: -4 }, mt: { xs: -2, md: -4 }, mb: 4, px: { xs: 2, md: 4 }, py: 4,
  } : { mb: 3 };
  return (
    <Box sx={{ ...bandSx, ...sx }}>
      {onBack && (
        <Button
          size="small"
          variant="text"
          onClick={onBack}
          startIcon={backIcon || <ArrowLeftIcon size={16} />}
          sx={{ mb: 1, ml: -1, px: 1, color: TL.gray500, '&:hover': { color: TL.primary, bgcolor: 'transparent' } }}
        >
          {backLabel}
        </Button>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.textPrimary }}>
              {title}
            </Typography>
            {status && (
              <StatusBadge
                label={status}
                tone={toneProp || statusTone(status)}
                sx={statusColor && !toneProp && statusTone(status) === 'gray'
                  ? { bgcolor: `${statusColor}1A`, color: statusColor }
                  : undefined}
              />
            )}
          </Box>
          {meta && <Box sx={{ mt: 1 }}>{meta}</Box>}
          {description && (
            <Typography sx={{ mt: 1, fontSize: '0.875rem', lineHeight: '1.25rem', color: TL.gray500 }}>
              {description}
            </Typography>
          )}
        </Box>
        {right}
      </Box>
    </Box>
  );
}
