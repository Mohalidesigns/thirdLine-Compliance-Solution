import { useState, useEffect, useRef } from 'react';
import { AppBar, Toolbar, Box, IconButton, Badge, Typography, Menu, MenuItem, Divider, ListItemIcon } from '@mui/material';
import { Notifications as BellIcon, Logout, Person, Key } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import NotificationsPanel from '../notifications/NotificationsPanel';

const DRAWER_WIDTH = 240;

export default function TopBar() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const intervalRef = useRef(null);

  const fetchCount = () => {
    api.notifications.count().then(c => setUnreadCount(c?.unread ?? 0)).catch(() => {});
  };

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          left: DRAWER_WIDTH,
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          bgcolor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', px: 3 }}>
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={() => setNotifOpen(true)} sx={{ mr: 1 }}>
            <Badge badgeContent={unreadCount} color="error" size="small">
              <BellIcon />
            </Badge>
          </IconButton>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.5, px: 1, borderRadius: 1, '&:hover': { bgcolor: theme.palette.action.hover } }}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: theme.palette.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}>
                {user?.fullName?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>{user?.fullName || 'User'}</Typography>
          </Box>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem disabled sx={{ opacity: 1 }}>
              <Box><Typography variant="body2" fontWeight={600}>{user?.fullName}</Typography><Typography variant="caption" color="text.secondary">{user?.role}</Typography></Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => setMenuAnchor(null)}><ListItemIcon><Person fontSize="small" /></ListItemIcon>Profile</MenuItem>
            <MenuItem onClick={() => setMenuAnchor(null)}><ListItemIcon><Key fontSize="small" /></ListItemIcon>Change password</MenuItem>
            <Divider />
            <MenuItem onClick={() => { setMenuAnchor(null); logout(); }}><ListItemIcon><Logout fontSize="small" /></ListItemIcon>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); fetchCount(); }} />
    </>
  );
}
