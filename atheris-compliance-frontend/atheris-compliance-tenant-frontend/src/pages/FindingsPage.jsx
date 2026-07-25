import { Box, Typography, Card, CardContent } from '@mui/material';
import { Warning } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export default function FindingsPage() {
  const theme = useTheme();
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Findings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Review auto-raised issues and track remediation</Typography>
      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <Warning sx={{ fontSize: 56, color: theme.palette.action.disabled, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Findings & Remediation</Typography>
          <Typography variant="body2" color="text.disabled">Coming soon — findings auto-raised from failed control tests</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
