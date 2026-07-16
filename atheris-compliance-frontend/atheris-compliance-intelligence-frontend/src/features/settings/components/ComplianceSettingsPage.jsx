import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Switch, 
  FormControlLabel, Divider, TextField, MenuItem, Chip, Stack
} from '@mui/material';
import {
  Security, Notifications, FilterAlt, Business, 
  Save, CheckCircle, Warning
} from '@mui/icons-material';

export default function ComplianceSettingsPage() {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Compliance Settings</Typography>
        <Typography variant="body2" color="text.secondary">Configure your regulatory profile and intelligence notification preferences</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Organisation Profile */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Business sx={{ color: '#1A365D' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Organisation Profile</Typography>
              </Box>
              
              <Stack spacing={2.5}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Organisation Name" 
                  defaultValue="Standard Chartered Bank Nigeria" 
                />
                <TextField 
                  fullWidth 
                  select 
                  size="small" 
                  label="Licence Type" 
                  defaultValue="Commercial Bank"
                >
                  <MenuItem value="Commercial Bank">Commercial Bank</MenuItem>
                  <MenuItem value="Merchant Bank">Merchant Bank</MenuItem>
                  <MenuItem value="Fintech">Fintech / PSP</MenuItem>
                </TextField>
                
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                    ACTIVE JURISDICTIONS
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {['Nigeria', 'Ghana', 'Kenya'].map(j => (
                      <Chip key={j} label={j} size="small" onDelete={() => {}} color="primary" variant="outlined" />
                    ))}
                    <Chip label="+ Add" size="small" onClick={() => {}} />
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Intelligence Filters */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FilterAlt sx={{ color: '#1A365D' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Intelligence Filtering</Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure which regulators and themes are prioritised in your Review Inbox.
              </Typography>

              <Stack spacing={1.5}>
                {[
                  { label: 'Priority Regulators', value: 'CBN, NFIU, SEC' },
                  { label: 'Key Themes', value: 'AML, Cybersecurity, Risk' },
                  { label: 'Minimum Risk Rating', value: 'Medium' },
                ].map((f) => (
                  <Box key={f.label} sx={{ p: 1.5, bgcolor: '#F7FAFC', borderRadius: 1.5, border: '1px solid #E2E8F0' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{f.label.toUpperCase()}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A365D' }}>{f.value}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Notifications sx={{ color: '#1A365D' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notification Preferences</Typography>
              </Box>

              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Email Notifications</Typography>
                  <Stack spacing={0.5}>
                    <FormControlLabel control={<Switch defaultChecked size="small" />} label={<Typography variant="body2">Daily Intelligence Summary</Typography>} />
                    <FormControlLabel control={<Switch defaultChecked size="small" />} label={<Typography variant="body2">Urgent "High Risk" Alerts</Typography>} />
                    <FormControlLabel control={<Switch size="small" />} label={<Typography variant="body2">Weekly Compliance Report</Typography>} />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Push Notifications</Typography>
                  <Stack spacing={0.5}>
                    <FormControlLabel control={<Switch defaultChecked size="small" />} label={<Typography variant="body2">System Status & Scraper Health</Typography>} />
                    <FormControlLabel control={<Switch size="small" />} label={<Typography variant="body2">New Historical Backfills</Typography>} />
                  </Stack>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<Save />}>Save Changes</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
