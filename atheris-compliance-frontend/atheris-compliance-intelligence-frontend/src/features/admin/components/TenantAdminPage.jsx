import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import {
  PageHeader, KpiCards, StatusBadge, TL,
  PlusIcon, ArrowPathIcon, ShieldCheckIcon, EllipsisVerticalIcon, CheckCircleIcon,
  BuildingOffice2Icon, ExclamationTriangleIcon, KeyIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const KPI_CARDS = [
  { key: 'total', label: 'Total Tenants', value: null, tone: 'blue', icon: <BuildingOffice2Icon />, statFn: (tenants) => tenants.length },
  { key: 'active', label: 'Active', value: 'active', tone: 'green', icon: <CheckCircleIcon />, statFn: (tenants) => tenants.filter(t => t.isActive).length },
  { key: 'inactive', label: 'Inactive', value: 'inactive', tone: 'red', icon: <ExclamationTriangleIcon />, statFn: (tenants) => tenants.filter(t => !t.isActive).length },
  { key: 'licenceTypes', label: 'Licence Types', value: null, tone: 'amber', icon: <KeyIcon />, statFn: (tenants) => new Set(tenants.map(t => t.licenceType).filter(Boolean)).size },
];

export default function TenantAdminPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);

  useEffect(() => {
    api.platform.tenants.list()
      .then(setTenants)
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleFilterClick = (value) => {
    setFilterStatus(filterStatus === value ? null : value);
  };

  const filteredTenants = filterStatus === 'active'
    ? tenants.filter(t => t.isActive)
    : filterStatus === 'inactive'
      ? tenants.filter(t => !t.isActive)
      : tenants;

  return (
    <Box>
      <PageHeader
        title="Tenant Management"
        subtitle="Manage client organisations, onboarding, and API integrations"
        actions={(
          <>
            {filterStatus && (
              <Chip label={`Filter: ${filterStatus}`} size="small" onDelete={() => setFilterStatus(null)} sx={{ textTransform: 'capitalize' }} />
            )}
            <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setOpenAdd(true)}>
              New Tenant
            </Button>
          </>
        )}
      />

      <KpiCards
        columns={4}
        items={KPI_CARDS.map((k) => ({
          key: k.key, label: k.label, tone: k.tone, icon: k.icon,
          value: loading ? '...' : k.statFn(tenants),
          active: !!k.value && filterStatus === k.value,
        }))}
        onSelect={(key) => handleFilterClick(KPI_CARDS.find(k => k.key === key)?.value ?? null)}
      />

      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Licence</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Onboarded</TableCell>
                <TableCell>Webhook</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: TL.gray500 }}>Loading...</TableCell></TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: TL.gray500 }}>No tenants yet</TableCell></TableRow>
              ) : filteredTenants.map((tenant) => (
                <TableRow key={tenant.tenantId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${ROUTES.ADMIN_TENANTS}/${tenant.tenantId}`)}>
                  <TableCell>
                    <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{tenant.tenantId}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{tenant.legalName}</Typography>
                  </TableCell>
                  <TableCell>
                    {tenant.licenceType || '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={tenant.isActive ? 'Active' : 'Inactive'} tone={tenant.isActive ? 'green' : 'red'} />
                  </TableCell>
                  <TableCell sx={{ color: TL.gray500, whiteSpace: 'nowrap' }}>
                    {tenant.onboardedAt ? new Date(tenant.onboardedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircleIcon size={16} sx={{ color: tenant.webhookEnabled ? TL.success : TL.gray300 }} />
                      <Typography component="span" sx={{ fontSize: '0.8125rem', color: TL.gray700 }}>{tenant.webhookEnabled ? 'Enabled' : 'Disabled'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Test Integration">
                      <IconButton size="small"><ArrowPathIcon size={16} /></IconButton>
                    </Tooltip>
                    <Tooltip title="API Settings">
                      <IconButton size="small"><ShieldCheckIcon size={16} /></IconButton>
                    </Tooltip>
                    <Tooltip title="More">
                      <IconButton size="small"><EllipsisVerticalIcon size={16} /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Tenant Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Tenant</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="Organisation Name" placeholder="e.g. Zenith Bank PLC" />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth select size="small" label="Industry" defaultValue="Banking">
                <MenuItem value="Banking">Banking</MenuItem>
                <MenuItem value="Fintech">Fintech</MenuItem>
                <MenuItem value="Insurance">Insurance</MenuItem>
                <MenuItem value="Telecoms">Telecoms</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth select size="small" label="Licence Tier" defaultValue="Commercial">
                <MenuItem value="Commercial">Commercial Bank</MenuItem>
                <MenuItem value="Merchant">Merchant Bank</MenuItem>
                <MenuItem value="Microfinance">Microfinance</MenuItem>
                <MenuItem value="Fintech">Fintech / PSP</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                The tenant will be generated with a unique secret and API key upon creation.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenAdd(false)}>Create Tenant</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
