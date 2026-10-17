import {
  Box, Typography, Grid, Button, Switch,
  FormControlLabel, TextField, MenuItem, Chip, Stack
} from '@mui/material';
import {
  PageHeader, DataCard, FilterField, TL,
  BuildingOffice2Icon, FunnelIcon, BellIcon, DocumentCheckIcon,
} from 'shared';

function PanelTitle({ icon, children }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box component="span" sx={{ display: 'inline-flex', color: TL.gray400 }}>{icon}</Box>
      {children}
    </Box>
  );
}

const switchLabel = (text) => <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{text}</Typography>;

export default function ComplianceSettingsPage() {
  return (
    <Box>
      <PageHeader
        title="Compliance Settings"
        subtitle="Configure your regulatory profile and intelligence notification preferences"
      />

      <Grid container spacing={3}>
        {/* Organisation Profile */}
        <Grid size={{ xs: 12, md: 6 }}>
          <DataCard title={<PanelTitle icon={<BuildingOffice2Icon size={18} />}>Organisation Profile</PanelTitle>} sx={{ height: '100%' }}>
            <Stack spacing={2.5}>
              <FilterField label="Organisation Name">
                <TextField
                  fullWidth
                  size="small"
                  defaultValue="Standard Chartered Bank Nigeria"
                />
              </FilterField>
              <FilterField label="Licence Type">
                <TextField
                  fullWidth
                  select
                  size="small"
                  defaultValue="Commercial Bank"
                >
                  <MenuItem value="Commercial Bank">Commercial Bank</MenuItem>
                  <MenuItem value="Merchant Bank">Merchant Bank</MenuItem>
                  <MenuItem value="Fintech">Fintech / PSP</MenuItem>
                </TextField>
              </FilterField>

              <FilterField label="Active Jurisdictions">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['Nigeria', 'Ghana', 'Kenya'].map(j => (
                    <Chip key={j} label={j} size="small" onDelete={() => {}} color="primary" />
                  ))}
                  <Chip label="+ Add" size="small" variant="outlined" onClick={() => {}} />
                </Box>
              </FilterField>
            </Stack>
          </DataCard>
        </Grid>

        {/* Intelligence Filters */}
        <Grid size={{ xs: 12, md: 6 }}>
          <DataCard
            title={<PanelTitle icon={<FunnelIcon size={18} />}>Intelligence Filtering</PanelTitle>}
            subtitle="Configure which regulators and themes are prioritised in your Review Inbox."
            noPadding
            sx={{ height: '100%' }}
          >
            {[
              { label: 'Priority Regulators', value: 'CBN, NFIU, SEC' },
              { label: 'Key Themes', value: 'AML, Cybersecurity, Risk' },
              { label: 'Minimum Risk Rating', value: 'Medium' },
            ].map((f) => (
              <Box key={f.label} sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, borderBottom: `1px solid ${TL.gray100}`, '&:last-of-type': { borderBottom: 0 } }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em' }}>{f.label}</Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, textAlign: 'right' }}>{f.value}</Typography>
              </Box>
            ))}
          </DataCard>
        </Grid>

        {/* Notification Preferences */}
        <Grid size={{ xs: 12 }}>
          <DataCard title={<PanelTitle icon={<BellIcon size={18} />}>Notification Preferences</PanelTitle>} noPadding>
            <Box sx={{ p: 3 }}>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>Email Notifications</Typography>
                  <Stack spacing={0.5}>
                    <FormControlLabel control={<Switch defaultChecked size="small" />} label={switchLabel('Daily Intelligence Summary')} />
                    <FormControlLabel control={<Switch defaultChecked size="small" />} label={switchLabel('Urgent "High Risk" Alerts')} />
                    <FormControlLabel control={<Switch size="small" />} label={switchLabel('Weekly Compliance Report')} />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>Push Notifications</Typography>
                  <Stack spacing={0.5}>
                    <FormControlLabel control={<Switch defaultChecked size="small" />} label={switchLabel('System Status & Scraper Health')} />
                    <FormControlLabel control={<Switch size="small" />} label={switchLabel('New Historical Backfills')} />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 3, py: 2, borderTop: `1px solid ${TL.gray100}` }}>
              <Button variant="contained" startIcon={<DocumentCheckIcon size={16} />}>Save Changes</Button>
            </Box>
          </DataCard>
        </Grid>
      </Grid>
    </Box>
  );
}
