import { Box, Drawer, Tooltip, Typography } from '@mui/material';
import { TL } from '../../theme/tokens';
import { ChevronDoubleLeftIcon, ShieldCheckIcon } from '../../icons/heroicons';

export const SIDEBAR_WIDTH = TL.sidebarWidth; // 260
export const SIDEBAR_COLLAPSED_WIDTH = 72;

/**
 * Thirdline sidebar shell: navy (#1A365D) column, 64px logo bar, 40px nav items
 * (14px/500, white/70; active = white on white/10 with a 3px gold left border),
 * sections separated by white/10 rules, and a Collapse control at the foot.
 *
 * Props:
 *  - brand       { name, tagline, logo?, mark? } — wordmark beside the shield mark, or image logos:
 *                  `logo` (full lockup for the navy bar) and `mark` (square icon for the collapsed bar)
 *  - sections    [{ key, items:[{ text, path, icon: <HeroIcon/>, badge? }] }]
 *  - footerItems same shape as items — pinned above Collapse (e.g. Settings)
 *  - activePath  current pathname; `isActive(item, path)` overrides the default match
 *  - onNavigate(path)
 *  - collapsed / onToggleCollapse
 *  - variant 'permanent' | 'temporary' (mobile), open / onClose for temporary
 */
function defaultIsActive(item, path) {
  if (item.exact) return path === item.path;
  return path === item.path || path.startsWith(`${item.path}/`);
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const content = (
    <Box
      component="button"
      type="button"
      onClick={() => onNavigate(item.path)}
      sx={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '12px', width: '100%', height: 40,
        mt: '4px', px: collapsed ? 0 : '16px', justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: '8px', fontFamily: TL.font, fontSize: '0.875rem', fontWeight: 500, lineHeight: '1.25rem',
        color: active ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
        bgcolor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderLeft: active ? `3px solid ${TL.accent}` : '3px solid transparent',
        transition: 'background-color .15s, color .15s',
        '&:hover': { bgcolor: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', color: '#FFFFFF' },
        '&:focus-visible': { outline: `2px solid ${TL.accent}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: 'flex', '& svg': { width: 20, height: 20 } }}>{item.icon}</Box>
      {!collapsed && (
        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.text}
        </Box>
      )}
      {!collapsed && item.badge > 0 && (
        <Box component="span" sx={{
          minWidth: 20, height: 20, px: '6px', borderRadius: 9999, bgcolor: TL.error, color: '#FFFFFF',
          fontSize: '0.625rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {item.badge > 99 ? '99+' : item.badge}
        </Box>
      )}
    </Box>
  );
  return collapsed ? <Tooltip title={item.text} placement="right">{content}</Tooltip> : content;
}

export default function AppSidebar({
  brand = { name: 'atheris', tagline: 'Compliance' }, sections = [], footerItems = [],
  activePath = '/', isActive = defaultIsActive, onNavigate,
  collapsed = false, onToggleCollapse, variant = 'permanent', open = true, onClose,
}) {
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const navPx = collapsed ? '12px' : '15px';

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: TL.primary }}>
      {/* Logo bar */}
      <Box sx={{
        height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.25,
        px: collapsed ? 0 : 2, justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {brand.logo && !collapsed ? (
          <Box component="img" src={brand.logo} alt={brand.name || 'Logo'}
            sx={{ height: 40, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
        ) : brand.mark && collapsed ? (
          <Box component="img" src={brand.mark} alt={brand.name || 'Logo'}
            sx={{ width: 38, height: 38, objectFit: 'contain', display: 'block' }} />
        ) : (
        <Box sx={{
          width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: TL.accent, flexShrink: 0,
        }}>
          <ShieldCheckIcon size={20} />
        </Box>
        )}
        {!collapsed && !brand.logo && (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#FFFFFF', fontSize: '1.375rem', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em' }}>
              {brand.name}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', mt: '3px' }} noWrap>
              {brand.tagline}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav sections */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 2,
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.2)' } }}>
        {sections.map((section, i) => (
          <Box key={section.key || i} sx={{
            px: navPx,
            ...(i > 0 ? { mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)' } : {}),
          }}>
            {section.items.map((item) => (
              <NavItem key={item.path} item={item} collapsed={collapsed}
                active={isActive(item, activePath)} onNavigate={onNavigate} />
            ))}
          </Box>
        ))}
      </Box>

      {/* Footer: pinned items + collapse */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', px: navPx, py: 1.5, flexShrink: 0 }}>
        {footerItems.map((item) => (
          <NavItem key={item.path} item={item} collapsed={collapsed}
            active={isActive(item, activePath)} onNavigate={onNavigate} />
        ))}
        {onToggleCollapse && variant === 'permanent' && (
          <NavItem
            item={{
              text: 'Collapse', path: '__collapse',
              icon: <ChevronDoubleLeftIcon sx={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />,
            }}
            collapsed={collapsed}
            active={false}
            onNavigate={onToggleCollapse}
          />
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={variant === 'permanent' ? true : open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: variant === 'permanent' ? width : undefined,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width, bgcolor: TL.primary, color: '#FFFFFF', border: 'none', borderRadius: 0,
          overflowX: 'hidden', transition: 'width .3s',
        },
      }}
    >
      {body}
    </Drawer>
  );
}
