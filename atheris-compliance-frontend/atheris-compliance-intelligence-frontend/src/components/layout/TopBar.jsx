import { useState } from 'react';
import {
  AppBar, Toolbar, Box, IconButton, InputBase, Badge, Avatar, Menu, MenuItem,
  Typography, Chip, Divider,
} from '@mui/material';
import {
  Search, NotificationsOutlined, HelpOutline, Language,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { APP, STRINGS } from '../../utils/constants';

export default function TopBar() {
  const theme = useTheme();
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: APP.DRAWER_WIDTH,
        width: `calc(100% - ${APP.DRAWER_WIDTH}px)`,
        bgcolor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar sx={{ minHeight: `${APP.TOPBAR_HEIGHT}px !important`, px: 3 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', bgcolor: theme.palette.action.hover, borderRadius: 2,
          px: 1.5, py: 0.5, width: 320, border: `1px solid ${theme.palette.divider}`,
        }}>
          <Search sx={{ color: theme.palette.text.secondary, fontSize: 20, mr: 1 }} />
          <InputBase
            placeholder={STRINGS.SEARCH_PLACEHOLDER}
            sx={{ flex: 1, fontSize: '0.8125rem', color: theme.palette.text.primary }}
          />
        </Box>

        <Box sx={{ flex: 1 }} />

        <Chip
          size="small"
          label={STRINGS.REPORTING_PERIOD}
          sx={{ bgcolor: '#EBF5FB', color: theme.palette.primary.main, fontWeight: 500, fontSize: '0.7rem', mr: 2 }}
        />

        <IconButton size="small" sx={{ mr: 1 }}>
          <Language sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
        </IconButton>
        <IconButton size="small" sx={{ mr: 1 }}>
          <HelpOutline sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
        </IconButton>
        <IconButton size="small" sx={{ mr: 1 }}>
          <Badge badgeContent={5} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}>
            <NotificationsOutlined sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
          </Badge>
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 1.5 }} />

        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 1 }}
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main, fontSize: '0.75rem' }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Avatar>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, fontSize: '0.78rem' }}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem' }}>
              {user?.role?.replace('_', ' ')}
            </Typography>
          </Box>
        </Box>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => setAnchorEl(null)}>{STRINGS.PROFILE_SETTINGS}</MenuItem>
          <MenuItem onClick={() => setAnchorEl(null)}>{STRINGS.ACCOUNT}</MenuItem>
          <Divider />
          <MenuItem onClick={() => setAnchorEl(null)}>{STRINGS.SIGN_OUT}</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
