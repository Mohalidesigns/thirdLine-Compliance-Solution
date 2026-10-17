import { useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TL } from '../../theme/tokens';
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './AppSidebar';

const STORAGE_KEY = 'atheris.sidebarCollapsed';

function readCollapsed() {
  try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

/**
 * Thirdline page frame: fixed navy sidebar (collapsible, a temporary drawer below `lg`),
 * fixed 64px top bar, and a gray-50 content area padded 32px (16px on phones).
 *
 * `renderSidebar({ collapsed, onToggleCollapse, variant, open, onClose })` and
 * `renderTopBar({ offset, onMenuClick })` let each app plug in its own nav + user data.
 * Collapsed state is a per-viewer convenience kept in localStorage.
 */
export default function AppShell({ renderSidebar, renderTopBar, children }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => setCollapsed((c) => {
    const next = !c;
    try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    return next;
  });

  const offset = mobile ? 0 : (collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: TL.bg }}>
      {renderSidebar(mobile
        ? { collapsed: false, variant: 'temporary', open: mobileOpen, onClose: () => setMobileOpen(false) }
        : { collapsed, onToggleCollapse: toggleCollapse, variant: 'permanent' })}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {renderTopBar({ offset, onMenuClick: mobile ? () => setMobileOpen(true) : undefined })}
        <Box
          component="main"
          sx={{ mt: '64px', p: { xs: 2, md: 4 }, minHeight: 'calc(100vh - 64px)', minWidth: 0 }}
          onClick={mobile && mobileOpen ? () => setMobileOpen(false) : undefined}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
