import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { APP } from '../../utils/constants';

export default function MainLayout() {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <Sidebar />
      <Box sx={{ flex: 1, ml: 0 }}>
        <TopBar />
        <Box component="main" sx={{ mt: `${APP.TOPBAR_HEIGHT}px`, p: 3, minHeight: `calc(100vh - ${APP.TOPBAR_HEIGHT}px)` }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
