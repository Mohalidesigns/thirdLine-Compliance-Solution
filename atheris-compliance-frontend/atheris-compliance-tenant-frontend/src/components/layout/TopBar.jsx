import {
  AppBar, Toolbar, Box, InputBase, Chip,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const DRAWER_WIDTH = 240;

export default function TopBar() {
  const theme = useTheme();

  return (
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
        <Box sx={{
          display: 'flex', alignItems: 'center', bgcolor: theme.palette.action.hover, borderRadius: 2,
          px: 1.5, py: 0.5, width: 320, border: `1px solid ${theme.palette.divider}`,
        }}>
          <Search sx={{ color: theme.palette.text.secondary, fontSize: 20, mr: 1 }} />
          <InputBase
            placeholder="Search instruments, regulators..."
            sx={{ flex: 1, fontSize: '0.8125rem', color: theme.palette.text.primary }}
          />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Chip
          size="small"
          label="Compliance Portal"
          sx={{ bgcolor: '#EBF5FB', color: theme.palette.primary.main, fontWeight: 500, fontSize: '0.7rem' }}
        />
      </Toolbar>
    </AppBar>
  );
}
