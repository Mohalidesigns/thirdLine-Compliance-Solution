import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar,
} from '@mui/material';
import {
  Dashboard, Inbox, AccountBalance, CloudUpload, History, LibraryBooks,
  Settings, Logout, ElectricBolt, Gavel, Warning, CalendarMonth, Verified, Folder,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Inbox', icon: <Inbox />, path: '/inbox' },
  { text: 'Obligations', icon: <LibraryBooks />, path: '/obligations' },
  { text: 'Regulators', icon: <AccountBalance />, path: '/regulators' },
  { text: 'Uploads', icon: <CloudUpload />, path: '/uploads' },
  { text: 'Controls', icon: <Gavel />, path: '/controls' },
  { text: 'Findings', icon: <Warning />, path: '/findings' },
  { text: 'Returns', icon: <CalendarMonth />, path: '/returns' },
  { text: 'Audit Trail', icon: <Verified />, path: '/audit' },
  { text: 'Evidence Vault', icon: <Folder />, path: '/evidence' },
  { text: 'Settings', icon: <Settings />, path: '/settings' },
];

export default function Sidebar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          bgcolor: theme.palette.primary.main,
          color: '#FFFFFF',
          borderRight: 'none',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: theme.palette.warning.main, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ElectricBolt sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, lineHeight: 1.2, fontSize: '0.95rem' }}>
            Atheris
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>
            Compliance Portal
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        <List disablePadding>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1, borderRadius: 1.5, mb: 0.3, px: 2, py: 0.8,
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
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.warning.main, fontSize: '0.8rem', fontWeight: 700 }}>
          {user?.fullName?.[0] || 'U'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.78rem', lineHeight: 1.3 }} noWrap>
            {user?.fullName || 'User'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }} noWrap>
            {user?.role?.replace(/_/g, ' ') || 'User'}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        <Box
          onClick={logout}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 1, px: 1.5, borderRadius: 1, color: 'rgba(255,255,255,0.5)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: theme.palette.error.main } }}
        >
          <Logout sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>Logout</Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
