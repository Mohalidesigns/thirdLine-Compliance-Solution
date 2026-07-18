import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  TablePagination, Drawer,
} from '@mui/material';
import {
  Add, VpnKey, CheckCircle, Cancel, Warning, Refresh,
  Delete, Visibility, Close, DeviceHub, Autorenew,
} from '@mui/icons-material';
import api from '../../../services/api';

const statusConfig = {
  active: { color: '#2D7D46', bg: '#E6F4EA' },
  inactive: { color: '#718096', bg: '#EDF2F7' },
  expired: { color: '#C53030', bg: '#FEE2E2' },
  revoked: { color: '#9B2C2C', bg: '#FED7D7' },
  grace_period: { color: '#D4AF37', bg: '#FEF9E7' },
  suspended: { color: '#DD6B20', bg: '#FFFAF0' },
};

export default function LicenseAdminPage() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [openRenew, setOpenRenew] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    load();
    api.platform.licenses.stats().then(setStats).catch(() => {}).finally(() => setLoadingStats(false));
    api.platform.tenants.list().then(data => setTenants(Array.isArray(data) ? data : data.content || [])).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    api.platform.licenses.list()
      .then(data => setLicenses(data.content || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleCreate = () => {
    api.platform.licenses.create(form)
      .then(() => { setOpenCreate(false); setForm({}); load(); })
      .catch(console.error);
  };

  const handleUpdate = () => {
    api.platform.licenses.update(openEdit, form)
      .then(() => { setOpenEdit(null); setForm({}); load(); })
      .catch(console.error);
  };

  const handleRevoke = (id) => {
    if (!window.confirm('Revoke this license? This cannot be undone.')) return;
    api.platform.licenses.revoke(id).then(load).catch(console.error);
  };

  const handleRenew = () => {
    if (!openRenew) return;
    api.platform.licenses.renew(openRenew.id, openRenew.expiresAt, openRenew.gracePeriodDays)
      .then(() => { setOpenRenew(null); load(); })
      .catch(console.error);
  };

  const handleRemoveDevice = (licenseId, deviceId) => {
    api.platform.licenses.removeDevice(licenseId, deviceId)
      .then(() => api.platform.licenses.get(licenseId))
      .then(setSelectedLicense)
      .catch(console.error);
  };

  const openCreateDialog = () => {
    setForm({ tenantId: tenants.length === 1 ? tenants[0].tenantId : '', tier: 'custom', intelligenceEnabled: true, maxUsers: 5, maxDevices: 1, maxStorageMb: 500, gracePeriodDays: 7, deviceFingerprintEnforced: true });
    setOpenCreate(true);
  };

  const openEditDialog = (lic) => {
    setForm({
      tenantId: lic.tenantId, tier: lic.tier, intelligenceEnabled: lic.intelligenceEnabled, maxUsers: lic.maxUsers,
      maxDevices: lic.maxDevices, maxRegulators: lic.maxRegulators, maxControls: lic.maxControls,
      maxReturns: lic.maxReturns, maxStorageMb: lic.maxStorageMb,
      deviceFingerprintEnforced: lic.deviceFingerprintEnforced, expiresAt: lic.expiresAt?.slice(0, 16),
      gracePeriodDays: lic.gracePeriodDays, notes: lic.notes,
    });
    setOpenEdit(lic.id);
  };

  const viewLicense = (lic) => {
    api.platform.licenses.get(lic.id).then(setSelectedLicense).catch(console.error);
  };

  const paginated = licenses.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>License Management</Typography>
          <Typography variant="body2" color="text.secondary">Create and manage tenant license keys, device limits, and renewals</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={openCreateDialog}>Create License</Button>
        </Box>
      </Box>

      {/* Dashboard KPIs */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { label: 'Active', value: stats?.active ?? '…', color: '#2D7D46' },
          { label: 'Inactive', value: stats?.inactive ?? '…', color: '#718096' },
          { label: 'Grace Period', value: stats?.gracePeriod ?? '…', color: '#D4AF37' },
          { label: 'Expired', value: stats?.expired ?? '…', color: '#C53030' },
          { label: 'Revoked', value: stats?.revoked ?? '…', color: '#9B2C2C' },
          { label: 'Total', value: stats?.total ?? '…', color: '#1A365D' },
        ].map((s) => (
          <Grid item xs={6} sm={4} md={2} key={s.label}>
            <Card sx={{ borderTop: `3px solid ${s.color}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>{s.label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>License Key</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Devices</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Intelligence</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="caption" color="text.secondary">Loading...</Typography></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="caption" color="text.secondary">No licenses yet</Typography></TableCell></TableRow>
              ) : paginated.map((lic) => {
                const sc = statusConfig[lic.status] || statusConfig.inactive;
                return (
                  <TableRow key={lic.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Roboto Mono', fontSize: '0.72rem' }}>
                        {lic.licenseKey}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{lic.legalName || lic.tenantId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={lic.status.replace('_', ' ')} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: '0.65rem', textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{lic.deviceCount}/{lic.maxDevices}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#718096' }}>
                      {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {lic.intelligenceEnabled
                        ? <Chip label="ON" size="small" sx={{ bgcolor: '#E6F4EA', color: '#2D7D46', fontWeight: 600, fontSize: '0.6rem' }} />
                        : <Chip label="OFF" size="small" sx={{ bgcolor: '#FEE2E2', color: '#C53030', fontWeight: 600, fontSize: '0.6rem' }} />
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details"><IconButton size="small" onClick={() => viewLicense(lic)}><Visibility sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditDialog(lic)}><VpnKey sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                      {lic.status === 'expired' || lic.status === 'grace_period' ? (
                        <Tooltip title="Renew"><IconButton size="small" onClick={() => setOpenRenew({ id: lic.id, expiresAt: '', gracePeriodDays: lic.gracePeriodDays || 7 })}><Autorenew sx={{ fontSize: 18, color: '#2D7D46' }} /></IconButton></Tooltip>
                      ) : null}
                      {lic.status === 'active' || lic.status === 'grace_period' ? (
                        <Tooltip title="Revoke"><IconButton size="small" onClick={() => handleRevoke(lic.id)}><Cancel sx={{ fontSize: 18, color: '#C53030' }} /></IconButton></Tooltip>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={licenses.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[5, 10, 25]} />
      </Card>

      {/* Create Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create License</DialogTitle>
        <DialogContent>
          <LicenseForm form={form} onChange={setForm} tenants={tenants} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!openEdit} onClose={() => setOpenEdit(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit License</DialogTitle>
        <DialogContent>
          <LicenseForm form={form} onChange={setForm} tenants={tenants} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog open={!!openRenew} onClose={() => setOpenRenew(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Renew License</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField fullWidth size="small" label="New Expiry" type="datetime-local" value={openRenew?.expiresAt || ''} onChange={e => setOpenRenew(prev => ({ ...prev, expiresAt: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" label="Grace Period (days)" type="number" value={openRenew?.gracePeriodDays || 7} onChange={e => setOpenRenew(prev => ({ ...prev, gracePeriodDays: parseInt(e.target.value) || 7 }))} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenRenew(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenew}>Renew</Button>
        </DialogActions>
      </Dialog>

      {/* Detail Drawer */}
      <Drawer anchor="right" open={!!selectedLicense} onClose={() => setSelectedLicense(null)} PaperProps={{ sx: { width: 420, p: 3 } }}>
        {selectedLicense && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>License Details</Typography>
              <IconButton onClick={() => setSelectedLicense(null)}><Close /></IconButton>
            </Box>
            <Box sx={{ mb: 2, p: 2, bgcolor: '#F7FAFC', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono', fontSize: '0.7rem' }}>{selectedLicense.licenseKey}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>{selectedLicense.legalName}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Chip label={selectedLicense.status.replace('_', ' ')} size="small" sx={{ bgcolor: (statusConfig[selectedLicense.status] || statusConfig.inactive).bg, color: (statusConfig[selectedLicense.status] || statusConfig.inactive).color, fontWeight: 600, fontSize: '0.65rem' }} />
                <Chip label={selectedLicense.intelligenceEnabled ? 'Intelligence ON' : 'Intelligence OFF'} size="small" color={selectedLicense.intelligenceEnabled ? 'success' : 'error'} variant="outlined" sx={{ fontSize: '0.6rem' }} />
              </Box>
            </Box>
            <Grid container spacing={1.5} sx={{ mb: 3 }}>
              {[
                { label: 'Max Users', value: selectedLicense.maxUsers },
                { label: 'Devices', value: `${selectedLicense.deviceCount} / ${selectedLicense.maxDevices}` },
                { label: 'Max Regulators', value: selectedLicense.maxRegulators || '∞' },
                { label: 'Max Controls', value: selectedLicense.maxControls || '∞' },
                { label: 'Max Returns', value: selectedLicense.maxReturns || '∞' },
                { label: 'Storage', value: `${selectedLicense.maxStorageMb} MB` },
                { label: 'Grace Period', value: `${selectedLicense.gracePeriodDays} days` },
                { label: 'Expires', value: selectedLicense.expiresAt ? new Date(selectedLicense.expiresAt).toLocaleDateString() : '—' },
              ].map(s => (
                <Grid item xs={6} key={s.label}>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.value}</Typography>
                </Grid>
              ))}
            </Grid>
            {(selectedLicense.status === 'expired' || selectedLicense.status === 'grace_period') && (
              <Button variant="outlined" size="small" fullWidth startIcon={<Autorenew />} onClick={() => { setOpenRenew({ id: selectedLicense.id, expiresAt: '', gracePeriodDays: selectedLicense.gracePeriodDays || 7 }); setSelectedLicense(null); }} sx={{ mb: 2 }}>
                Renew License
              </Button>
            )}
            {selectedLicense.devices?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <DeviceHub sx={{ fontSize: 16 }} /> Registered Devices
                </Typography>
                {selectedLicense.devices.map(dev => (
                  <Box key={dev.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, mb: 1, bgcolor: '#F7FAFC', borderRadius: 1 }}>
                    <Box>
                      <Typography variant="caption" sx={{ fontFamily: 'Roboto Mono', fontSize: '0.65rem', display: 'block' }}>{dev.deviceFingerprint?.substring(0, 20)}...</Typography>
                      {dev.deviceLabel && <Typography variant="caption" color="text.secondary">{dev.deviceLabel}</Typography>}
                      <Typography variant="caption" color="text.secondary">Last seen: {dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleDateString() : '—'}</Typography>
                    </Box>
                    <Tooltip title="Remove Device">
                      <IconButton size="small" onClick={() => handleRemoveDevice(selectedLicense.id, dev.id)}>
                        <Delete sx={{ fontSize: 16, color: '#C53030' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
            {(!selectedLicense.devices || selectedLicense.devices.length === 0) && (
              <Typography variant="caption" color="text.secondary">No devices registered</Typography>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

function LicenseForm({ form, onChange, tenants }) {
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }));
  return (
    <Grid container spacing={2} sx={{ mt: 0.5 }}>
      <Grid item xs={12}>
        <TextField fullWidth select size="small" label="Tenant" value={form.tenantId || ''} onChange={e => set('tenantId', e.target.value)}>
          {tenants.map(t => (
            <MenuItem key={t.tenantId} value={t.tenantId}>{t.legalName}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={6}>
        <TextField fullWidth size="small" label="Tier" value={form.tier || ''} onChange={e => set('tier', e.target.value)} />
      </Grid>
      <Grid item xs={6}>
        <TextField fullWidth select size="small" label="Intelligence" value={form.intelligenceEnabled !== false ? 'true' : 'false'} onChange={e => set('intelligenceEnabled', e.target.value === 'true')}>
          <MenuItem value="true">Enabled</MenuItem>
          <MenuItem value="false">Disabled</MenuItem>
        </TextField>
      </Grid>
      <Grid item xs={4}>
        <TextField fullWidth size="small" label="Max Users" type="number" value={form.maxUsers || ''} onChange={e => set('maxUsers', parseInt(e.target.value) || 0)} />
      </Grid>
      <Grid item xs={4}>
        <TextField fullWidth size="small" label="Max Devices" type="number" value={form.maxDevices || ''} onChange={e => set('maxDevices', parseInt(e.target.value) || 0)} />
      </Grid>
      <Grid item xs={4}>
        <TextField fullWidth size="small" label="Storage (MB)" type="number" value={form.maxStorageMb || ''} onChange={e => set('maxStorageMb', parseInt(e.target.value) || 0)} />
      </Grid>
      <Grid item xs={4}>
        <TextField fullWidth size="small" label="Max Regulators" type="number" value={form.maxRegulators ?? ''} onChange={e => set('maxRegulators', e.target.value ? parseInt(e.target.value) : null)} />
      </Grid>
      <Grid item xs={4}>
        <TextField fullWidth size="small" label="Max Controls" type="number" value={form.maxControls ?? ''} onChange={e => set('maxControls', e.target.value ? parseInt(e.target.value) : null)} />
      </Grid>
      <Grid item xs={4}>
        <TextField fullWidth size="small" label="Max Returns" type="number" value={form.maxReturns ?? ''} onChange={e => set('maxReturns', e.target.value ? parseInt(e.target.value) : null)} />
      </Grid>
      <Grid item xs={6}>
        <TextField fullWidth size="small" label="Expires At" type="datetime-local" value={form.expiresAt || ''} onChange={e => set('expiresAt', e.target.value)} InputLabelProps={{ shrink: true }} />
      </Grid>
      <Grid item xs={3}>
        <TextField fullWidth size="small" label="Grace Period (days)" type="number" value={form.gracePeriodDays || ''} onChange={e => set('gracePeriodDays', parseInt(e.target.value) || 7)} />
      </Grid>
      <Grid item xs={3}>
        <TextField fullWidth select size="small" label="Device Enforce" value={form.deviceFingerprintEnforced !== false ? 'true' : 'false'} onChange={e => set('deviceFingerprintEnforced', e.target.value === 'true')}>
          <MenuItem value="true">Enforced</MenuItem>
          <MenuItem value="false">Not Enforced</MenuItem>
        </TextField>
      </Grid>
      <Grid item xs={12}>
        <TextField fullWidth size="small" label="Notes" multiline rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </Grid>
    </Grid>
  );
}
