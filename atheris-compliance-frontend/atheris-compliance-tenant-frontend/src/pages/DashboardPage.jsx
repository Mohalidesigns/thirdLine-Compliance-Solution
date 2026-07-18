import { useState, useEffect } from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { AccountBalance, CloudUpload, LibraryBooks, CheckCircle, HourglassEmpty, Error as ErrorIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const [regulators, setRegulators] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.regulators.list().catch(() => []),
      api.uploads.list().catch(() => ({ content: [] })),
    ]).then(([regs, upl]) => {
      setRegulators(regs);
      setUploads(upl.content || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  const activeRegs = regulators.filter(r => r.isActive).length;
  const pendingUploads = uploads.filter(u => u.status === 'pending' || u.status === 'processing').length;
  const completedUploads = uploads.filter(u => u.status === 'completed').length;

  const KPI_CARDS = [
    { label: 'Active Regulators', value: activeRegs, icon: <AccountBalance />, color: theme.palette.primary.main },
    { label: 'Pending Uploads', value: pendingUploads, icon: <HourglassEmpty />, color: theme.palette.warning.main },
    { label: 'Completed Uploads', value: completedUploads, icon: <CheckCircle />, color: theme.palette.secondary.main },
    { label: 'Total Regulators', value: regulators.length, icon: <LibraryBooks />, color: theme.palette.info.main },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Welcome back, {user?.firstName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Your compliance workspace overview</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {KPI_CARDS.map(kpi => (
          <Grid item xs={12} sm={6} md={3} key={kpi.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{kpi.value}</Typography>
                  </Box>
                  <Box sx={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Recent Uploads</Typography>
          {uploads.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No uploads yet.</Typography>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Uploaded</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploads.slice(0, 5).map(u => (
                    <TableRow key={u.id}>
                      <TableCell sx={{ fontWeight: 500 }}>{u.title}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.status} color={u.status === 'completed' ? 'success' : u.status === 'failed' ? 'error' : 'warning'} />
                      </TableCell>
                      <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
