import { Box, Typography, Card, CardContent } from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export default function ReturnsPage() {
  const theme = useTheme();
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Regulatory Returns</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Track regulatory filing deadlines and submissions</Typography>
      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CalendarMonth sx={{ fontSize: 56, color: theme.palette.action.disabled, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Returns Calendar</Typography>
          <Typography variant="body2" color="text.disabled">Coming soon — filing calendar, stage-based submissions, and history</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
