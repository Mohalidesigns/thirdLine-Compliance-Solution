import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar,
} from '@mui/material';
import {
  Dashboard, LibraryBooks, Inbox, Visibility, Settings,
  AdminPanelSettings, Shield, Logout, Security, AccountBalance,
  AccountTree, VpnKey,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { BRAND, APP, ROUTES, NAV_SECTIONS } from '../../utils/constants';

const iconMap = {
  Dashboard: <Dashboard />,
  LibraryBooks: <LibraryBooks />,
  Inbox: <Inbox />,
  Visibility: <Visibility />,
  Security: <Security />,
  Settings: <Settings />,
  AccountBalance: <AccountBalance />,
  AdminPanelSettings: <AdminPanelSettings />,
  AccountTree: <AccountTree />,
  VpnKey: <VpnKey />,
};

export default function Sidebar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'PLATFORM_ADMIN';

  const visibleSections = isAdmin
    ? NAV_SECTIONS.filter(s => s.label !== 'INTELLIGENCE')
    : NAV_SECTIONS.filter(s => s.label !== 'PLATFORM');

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: APP.DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: APP.DRAWER_WIDTH,
          bgcolor: theme.palette.primary.main,
          color: '#FFFFFF',
          borderRight: 'none',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Shield sx={{ fontSize: 32, color: theme.palette.warning.main }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, lineHeight: 1.2, fontSize: '1rem' }}>
            {BRAND.NAME} Hub
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>
            {BRAND.TAGLINE}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {visibleSections.map((section) => (
          <Box key={section.label}>
            <Typography
              variant="caption"
              sx={{ px: 2.5, py: 1, display: 'block', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.08em' }}
            >
              {section.label}
            </Typography>
            <List disablePadding>
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <ListItem key={item.text} disablePadding>
                    <ListItemButton
                      onClick={() => navigate(item.path)}
                      sx={{
                        mx: 1,
                        borderRadius: 1.5,
                        mb: 0.3,
                        px: 2,
                        py: 0.8,
                        bgcolor: isActive ? 'rgba(212,175,55,0.15)' : 'transparent',
                        borderLeft: isActive ? `3px solid ${theme.palette.warning.main}` : '3px solid transparent',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                        '& .MuiListItemIcon-root': {
                          color: isActive ? theme.palette.warning.main : 'rgba(255,255,255,0.6)',
                          minWidth: 36,
                        },
                        '& .MuiListItemText-primary': {
                          color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                          fontSize: '0.8125rem',
                          fontWeight: isActive ? 600 : 400,
                        },
                      }}
                    >
                      <ListItemIcon>{iconMap[item.icon]}</ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.warning.main, fontSize: '0.8rem', fontWeight: 700 }}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.78rem', lineHeight: 1.3 }} noWrap>
            {user?.firstName} {user?.lastName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }} noWrap>
            {user?.role?.replace('_', ' ')}
          </Typography>
        </Box>
        <Logout
          onClick={logout}
          sx={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, '&:hover': { color: theme.palette.error.main } }}
        />
      </Box>
    </Drawer>
  );
}
