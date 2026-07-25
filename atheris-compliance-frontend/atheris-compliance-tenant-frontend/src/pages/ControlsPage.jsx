import { Box, Typography, Card, CardContent } from '@mui/material';
import { Gavel } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export default function ControlsPage() {
  const theme = useTheme();
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Controls</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Manage your control inventory and testing schedule</Typography>
      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <Gavel sx={{ fontSize: 56, color: theme.palette.action.disabled, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Control Manager</Typography>
          <Typography variant="body2" color="text.disabled">Coming soon — define controls, schedule tests, and track results</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
