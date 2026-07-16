import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  ArrowBack, Language, Sync, Security, History, CheckCircle, Cancel,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [webhookHistory, setWebhookHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.platform.tenants.get(id)
      .then(setTenant)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function loadHistory() {
    setHistLoading(true);
    api.platform.tenants.history(id)
      .then(setWebhookHistory)
      .catch(() => setWebhookHistory([]))
      .finally(() => setHistLoading(false));
  }

  function handleTestWebhook() {
    api.platform.tenants.testWebhook(id)
      .then((res) => alert(res.message || 'Test sent'))
      .catch((err) => alert('Test failed: ' + err.message));
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_TENANTS)} sx={{ mb: 2 }}>Back to Tenants</Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!tenant) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_TENANTS)} sx={{ mb: 2 }}>Back to Tenants</Button>
        <Alert severity="warning">Tenant not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_TENANTS)} sx={{ mb: 2 }}>Back to Tenants</Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{tenant.legalName}</Typography>
            <Chip
              label={tenant.isActive ? 'active' : 'inactive'}
              size="small"
              sx={{
                fontWeight: 700, textTransform: 'capitalize',
                bgcolor: tenant.isActive ? '#E6F4EA' : '#FEE2E2',
                color: tenant.isActive ? '#2D7D46' : '#C53030',
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'Roboto Mono', fontSize: '0.75rem' }}>
            ID: {tenant.tenantId} &middot; {tenant.licenceType || 'No licence type'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<Sync />} onClick={handleTestWebhook}>Test Webhook</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Webhook URL</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {tenant.webhookUrl || '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Webhook Status</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {tenant.webhookEnabled ? <CheckCircle sx={{ fontSize: 16, color: '#2D7D46' }} /> : <Cancel sx={{ fontSize: 16, color: '#CBD5E0' }} />}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{tenant.webhookEnabled ? 'Enabled' : 'Disabled'}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Onboarded</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(tenant.onboardedAt)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button variant="outlined" size="small" startIcon={<Security />}>API Settings</Button>
        <Button variant="outlined" size="small" startIcon={<History />} onClick={loadHistory}>Webhook History</Button>
      </Box>

      {webhookHistory.length > 0 && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Webhook Delivery History</Typography>
          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Attempts</TableCell>
                    <TableCell>Last Attempt</TableCell>
                    <TableCell>Response</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {webhookHistory.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{log.eventType || '—'}</TableCell>
                      <TableCell>
                        <Chip label={log.status} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{log.attemptCount || 0}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(log.lastAttemptAt)}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.responseStatus || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Box>
  );
}
