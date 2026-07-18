import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import {
  Add, Language, Sync, Security, MoreVert, CheckCircle, Warning,
  History, SettingsInputComponent, PlayArrow, Refresh,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const statusConfig = {
  active: { color: '#2D7D46', bg: '#E6F4EA' },
  onboarding: { color: '#D4AF37', bg: '#FEF9E7' },
  inactive: { color: '#C53030', bg: '#FEE2E2' },
};

export default function TenantAdminPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);

  useEffect(() => {
    api.platform.tenants.list()
      .then(setTenants)
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Tenant Management</Typography>
          <Typography variant="body2" color="text.secondary">Manage client organisations, onboarding, and API integrations</Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setOpenAdd(true)}>
          New Tenant
        </Button>
      </Box>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Tenants', value: loading ? '...' : tenants.length, color: '#1A365D' },
          { label: 'Active', value: loading ? '...' : tenants.filter(t => t.isActive).length, color: '#2D7D46' },

          { label: 'Licence Types', value: loading ? '...' : new Set(tenants.map(t => t.licenceType).filter(Boolean)).size, color: '#D4AF37' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tenant List */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Licence</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Onboarded</TableCell>
                <TableCell>Webhook</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="caption" color="text.secondary">Loading...</Typography></TableCell></TableRow>
              ) : tenants.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><Typography variant="caption" color="text.secondary">No tenants yet</Typography></TableCell></TableRow>
              ) : tenants.map((tenant) => (
                <TableRow key={tenant.tenantId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${ROUTES.ADMIN_TENANTS}/${tenant.tenantId}`)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{tenant.legalName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono', fontSize: '0.6rem' }}>{tenant.tenantId}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{tenant.licenceType || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tenant.isActive ? 'active' : 'inactive'}
                      size="small"
                      sx={{
                        bgcolor: tenant.isActive ? statusConfig.active.bg : statusConfig.inactive.bg,
                        color: tenant.isActive ? statusConfig.active.color : statusConfig.inactive.color,
                        fontWeight: 600, fontSize: '0.65rem', textTransform: 'capitalize'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: '#718096' }}>
                    {tenant.onboardedAt ? new Date(tenant.onboardedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircle sx={{ fontSize: 14, color: tenant.webhookEnabled ? '#2D7D46' : '#CBD5E0' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{tenant.webhookEnabled ? 'Enabled' : 'Disabled'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Test Integration">
                      <IconButton size="small"><Sync sx={{ fontSize: 18 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="API Settings">
                      <IconButton size="small"><Security sx={{ fontSize: 18 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="More">
                      <IconButton size="small"><MoreVert sx={{ fontSize: 18 }} /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add Tenant Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Tenant</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Organisation Name" placeholder="e.g. Zenith Bank PLC" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select size="small" label="Industry" defaultValue="Banking">
                <MenuItem value="Banking">Banking</MenuItem>
                <MenuItem value="Fintech">Fintech</MenuItem>
                <MenuItem value="Insurance">Insurance</MenuItem>
                <MenuItem value="Telecoms">Telecoms</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select size="small" label="Licence Tier" defaultValue="Commercial">
                <MenuItem value="Commercial">Commercial Bank</MenuItem>
                <MenuItem value="Merchant">Merchant Bank</MenuItem>
                <MenuItem value="Microfinance">Microfinance</MenuItem>
                <MenuItem value="Fintech">Fintech / PSP</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                The tenant will be generated with a unique secret and API key upon creation.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenAdd(false)}>Create Tenant</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
