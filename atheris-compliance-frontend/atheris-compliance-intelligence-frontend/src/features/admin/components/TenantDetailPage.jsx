import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import {
  DetailHeader, KpiCards, DataCard, StateBadge, TL,
  GlobeAltIcon, ShieldCheckIcon, FingerPrintIcon, CheckCircleIcon, ExclamationCircleIcon, CalendarIcon,
} from 'shared';
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

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box>
        <DetailHeader band title="Tenant" onBack={() => navigate(ROUTES.ADMIN_TENANTS)} backLabel="Back to Tenants" />
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!tenant) {
    return (
      <Box>
        <DetailHeader band title="Tenant" onBack={() => navigate(ROUTES.ADMIN_TENANTS)} backLabel="Back to Tenants" />
        <Alert severity="warning">Tenant not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(ROUTES.ADMIN_TENANTS)}
        backLabel="Back to Tenants"
        title={tenant.legalName}
        status={tenant.isActive ? 'Active' : 'Inactive'}
        statusTone={tenant.isActive ? 'green' : 'red'}
        meta={(
          <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>
            ID: {tenant.tenantId} &middot; {tenant.licenceType || 'No licence type'}
          </Typography>
        )}
        right={(
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<ShieldCheckIcon size={16} />}>API Settings</Button>
            <Button variant="outlined" startIcon={<FingerPrintIcon size={16} />} onClick={loadHistory}>Webhook History</Button>
          </Box>
        )}
      />

      <KpiCards
        columns={3}
        items={[
          {
            key: 'url', label: 'Webhook URL', tone: 'blue', icon: <GlobeAltIcon />,
            value: (
              <Box component="span" sx={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-all', color: TL.gray700 }}>
                {tenant.webhookUrl || '—'}
              </Box>
            ),
          },
          {
            key: 'status', label: 'Webhook Status',
            tone: tenant.webhookEnabled ? 'green' : 'gray',
            icon: tenant.webhookEnabled ? <CheckCircleIcon /> : <ExclamationCircleIcon />,
            value: tenant.webhookEnabled ? 'Enabled' : 'Disabled',
          },
          { key: 'onboarded', label: 'Onboarded', tone: 'teal', icon: <CalendarIcon />, value: formatDate(tenant.onboardedAt) },
        ]}
      />

      {webhookHistory.length > 0 && (
        <DataCard title="Webhook Delivery History" noPadding>
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
                    <TableCell>{log.eventType || '—'}</TableCell>
                    <TableCell><StateBadge value={log.status} /></TableCell>
                    <TableCell>{log.attemptCount || 0}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: TL.gray500, whiteSpace: 'nowrap' }}>{formatDt(log.lastAttemptAt)}</TableCell>
                    <TableCell sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.responseStatus || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DataCard>
      )}
    </Box>
  );
}
