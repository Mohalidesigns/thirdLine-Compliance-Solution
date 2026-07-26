import { useState, useEffect } from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Chip, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, LinearProgress, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Shield, CheckCircle, CalendarMonth, Error as ErrorIcon, Warning, InfoOutlined } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [attention, setAttention] = useState(null);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.dashboard.summary().catch(() => null),
      api.dashboard.attentionItems().catch(() => null),
      api.returns.calendar({ days: 30 }).catch(() => ({ content: [] })),
    ]).then(([s, a, r]) => {
      setSnapshot(s);
      setAttention(a);
      setReturns(r.content || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  const todayStr = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const score = snapshot?.complianceScore ?? 0;
  const tested = snapshot?.controlsTestCompletionRate ?? 0;
  const returnsOnTime = snapshot?.returnsTotal > 0 ? Math.round((snapshot.returnsSubmittedOnTime / snapshot.returnsTotal) * 100) : 100;
  const openFindings = snapshot?.findingsOpen ?? 0;
  const highFindings = snapshot?.findingsHighSeverity ?? 0;
  const gaps = snapshot?.obligationsWithGaps ?? 0;
  const highRisk = snapshot?.obligationsHighRisk ?? 0;

  const totalActive = snapshot?.totalObligationsActive ?? 0;
  const medLowRisk = Math.max(0, totalActive - highRisk);

  const KPI_CARDS = [
    { label: 'Compliance Score', value: `${Math.round(score)}%`, sub: `${score >= 80 ? '↑' : '↓'} Today`, icon: <Shield />, color: score >= 80 ? theme.palette.success.main : score >= 60 ? theme.palette.warning.main : theme.palette.error.main },
    { label: 'Controls Tested', value: `${Math.round(tested)}%`, sub: snapshot?.controlsTotal > 0 ? `${snapshot.controlsPassing} of ${snapshot.controlsTotal} passing` : 'No controls', icon: <CheckCircle />, color: tested >= 80 ? theme.palette.success.main : tested >= 60 ? theme.palette.warning.main : theme.palette.error.main },
    { label: 'Returns on Time', value: `${returnsOnTime}%`, sub: snapshot?.returnsTotal > 0 ? `Q2 ${now.getFullYear()}` : 'No returns', icon: <CalendarMonth />, color: returnsOnTime >= 90 ? theme.palette.success.main : returnsOnTime >= 70 ? theme.palette.warning.main : theme.palette.error.main },
    { label: 'Open Findings', value: openFindings, sub: `${highFindings} High severity`, icon: <ErrorIcon />, color: openFindings === 0 ? theme.palette.success.main : highFindings > 0 ? theme.palette.error.main : theme.palette.warning.main },
  ];

  const attentionItems = [];
  if (attention) {
    if (attention.overdue_returns > 0) attentionItems.push({ icon: <Warning color="error" />, text: `${attention.overdue_returns} return${attention.overdue_returns > 1 ? 's' : ''} overdue`, severity: 'error' });
    if (attention.controls_failing > 0) attentionItems.push({ icon: <ErrorIcon color="error" />, text: `${attention.controls_failing} control${attention.controls_failing > 1 ? 's' : ''} failing`, severity: 'error' });
    if (attention.obligations_no_control > 0) attentionItems.push({ icon: <InfoOutlined color="warning" />, text: `${attention.obligations_no_control} obligation${attention.obligations_no_control > 1 ? 's' : ''} with no linked control`, severity: 'warning' });
    if (attention.high_risk_findings > 0) attentionItems.push({ icon: <ErrorIcon color="error" />, text: `${attention.high_risk_findings} critical finding${attention.high_risk_findings > 1 ? 's' : ''}`, severity: 'error' });
  }

  const returnColor = (status, overdue) => {
    if (overdue || status === 'Submitted Late') return 'error';
    if (status === 'In Progress') return 'warning';
    if (status === 'Submitted') return 'success';
    return 'default';
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Good morning, {user?.fullName?.split(' ')[0] || 'User'}.</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Today is {todayStr}.
        {attentionItems.length > 0 && ` ${attentionItems.length} item${attentionItems.length > 1 ? 's' : ''} need your attention.`}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {KPI_CARDS.map(kpi => (
          <Grid item xs={12} sm={6} md={3} key={kpi.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                  <Box sx={{ color: kpi.color, opacity: 0.8, display: 'flex' }}>{kpi.icon}</Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>{kpi.value}</Typography>
                <Typography variant="caption" color="text.secondary">{kpi.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h6" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning color={attentionItems.length > 0 ? 'warning' : 'success'} fontSize="small" />
                {attentionItems.length > 0 ? 'Needs your attention' : 'All clear'}
              </Typography>
              {attentionItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Everything is on track. No items require your attention.</Typography>
              ) : (
                <List dense disablePadding>
                  {attentionItems.map((item, i) => (
                    <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Obligations by risk</Typography>
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">High</Typography>
                  <Typography variant="body2" fontWeight={600}>{highRisk}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={totalActive > 0 ? (highRisk / totalActive) * 100 : 0} sx={{ height: 8, borderRadius: 1, backgroundColor: theme.palette.grey[200], '& .MuiLinearProgress-bar': { backgroundColor: theme.palette.error.main } }} />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Medium / Low</Typography>
                  <Typography variant="body2" fontWeight={600}>{medLowRisk}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={totalActive > 0 ? (medLowRisk / totalActive) * 100 : 0} sx={{ height: 8, borderRadius: 1, backgroundColor: theme.palette.grey[200], '& .MuiLinearProgress-bar': { backgroundColor: theme.palette.warning.main } }} />
              </Box>
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip size="small" label={`${gaps} with no control`} color={gaps > 0 ? 'warning' : 'default'} variant="outlined" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Returns due in the next 30 days</Typography>
          {returns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No returns due in the next 30 days.</Typography>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Due date</TableCell>
                    <TableCell>Return</TableCell>
                    <TableCell>Regulator</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {returns.slice(0, 6).map(r => (
                    <TableRow key={r.instanceId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{r.returnName}</TableCell>
                      <TableCell>{r.filingRegulator}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{r.currentStage}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={returnColor(r.status, r.isOverdue)} variant={r.isOverdue ? 'filled' : 'outlined'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Button variant="contained" size="large" disabled startIcon={<Upload />} sx={{ borderRadius: 2 }}>
        Generate Board Pack
      </Button>
    </Box>
  );
}
