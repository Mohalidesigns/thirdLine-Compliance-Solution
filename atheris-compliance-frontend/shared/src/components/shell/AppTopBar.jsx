import { useState } from 'react';
import { AppBar, Box, Divider, IconButton, InputBase, ListItemIcon, Menu, MenuItem, Toolbar, Typography } from '@mui/material';
import { TL } from '../../theme/tokens';
import { Bars3Icon, BellIcon, ChevronDownIcon, MagnifyingGlassIcon } from '../../icons/heroicons';

/**
 * Thirdline top bar: 64px white bar with a gray-200 bottom rule, a 320px gray-50 search
 * field on the left, and a bell (red count pill) + avatar/name/role dropdown on the right.
 *
 * Props:
 *  - offset            px from the left (sidebar width; 0 on mobile)
 *  - onMenuClick       shows the hamburger (mobile) when provided
 *  - searchPlaceholder / onSearch(value) — Enter submits; omit onSearch to hide the field
 *  - notificationCount / onNotificationsClick — omit the handler to hide the bell
 *  - user              { name, role }
 *  - menuItems         [{ label, icon?, onClick, divider? }] — the user dropdown
 *  - children          extra right-side controls rendered before the bell
 */
function initials(name) {
  return String(name || 'U').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

export default function AppTopBar({
  offset = 0, onMenuClick, searchPlaceholder = 'Search…', onSearch,
  notificationCount = 0, onNotificationsClick, user = {}, menuItems = [], children,
}) {
  const [anchor, setAnchor] = useState(null);
  const [q, setQ] = useState('');

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: offset, width: `calc(100% - ${offset}px)`, bgcolor: '#FFFFFF', color: TL.textPrimary,
        borderBottom: `1px solid ${TL.gray200}`, boxShadow: 'none', transition: 'left .3s, width .3s',
        zIndex: (t) => t.zIndex.drawer - 1,
      }}
    >
      <Toolbar disableGutters sx={{ minHeight: '64px !important', px: { xs: 2, md: 4 }, gap: 2 }}>
        {onMenuClick && (
          <IconButton onClick={onMenuClick} aria-label="Open navigation" sx={{ color: TL.gray500, ml: -1 }}>
            <Bars3Icon size={22} />
          </IconButton>
        )}

        {onSearch && (
          <Box
            component="form"
            onSubmit={(e) => { e.preventDefault(); onSearch(q); }}
            sx={{
              display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25, width: 320, height: 38,
              px: 1.5, bgcolor: TL.gray50, border: `1px solid ${TL.gray200}`, borderRadius: '8px',
              '&:focus-within': { borderColor: TL.primary, boxShadow: '0 0 0 3px rgba(26,54,93,0.12)' },
            }}
          >
            <MagnifyingGlassIcon size={18} sx={{ color: TL.gray400 }} />
            <InputBase
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              sx={{ flex: 1, fontSize: '0.875rem', color: TL.textPrimary }}
              inputProps={{ 'aria-label': 'Search' }}
            />
          </Box>
        )}

        <Box sx={{ flex: 1 }} />

        {children}

        {onNotificationsClick && (
          <IconButton onClick={onNotificationsClick} aria-label="Notifications" sx={{ position: 'relative', color: TL.gray500 }}>
            <BellIcon size={24} />
            {notificationCount > 0 && (
              <Box component="span" sx={{
                position: 'absolute', top: 0, right: 0, minWidth: 20, height: 20, px: '4px', borderRadius: 9999,
                bgcolor: TL.error, color: '#FFFFFF', fontSize: '0.625rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Box>
            )}
          </IconButton>
        )}

        <Box
          component="button"
          type="button"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
            p: '6px', borderRadius: '8px', '&:hover': { bgcolor: TL.gray50 },
            '&:focus-visible': { outline: `2px solid ${TL.primary}`, outlineOffset: 2 },
          }}
        >
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%', bgcolor: TL.primary, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600,
          }}>
            {initials(user.name)}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left', fontFamily: TL.font }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray700, lineHeight: '1.25rem' }} noWrap>
              {user.name || 'User'}
            </Typography>
            {user.role && (
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, lineHeight: '1rem' }} noWrap>
                {user.role}
              </Typography>
            )}
          </Box>
          <ChevronDownIcon size={16} sx={{ color: TL.gray400, display: { xs: 'none', md: 'block' } }} />
        </Box>

        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{ paper: { sx: { mt: 1, minWidth: 220 } } }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>{user.name || 'User'}</Typography>
            {user.role && <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{user.role}</Typography>}
          </Box>
          <Divider />
          {menuItems.flatMap((m, i) => {
            const item = (
              <MenuItem key={m.label} onClick={() => { setAnchor(null); m.onClick?.(); }}
                sx={m.danger ? { color: TL.error, '&:hover': { bgcolor: '#FEF2F2' } } : undefined}>
                {m.icon && <ListItemIcon sx={{ color: 'inherit', minWidth: 32, '& svg': { width: 18, height: 18 } }}>{m.icon}</ListItemIcon>}
                {m.label}
              </MenuItem>
            );
            return m.divider && i > 0 ? [<Divider key={`d-${m.label}`} />, item] : [item];
          })}
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
