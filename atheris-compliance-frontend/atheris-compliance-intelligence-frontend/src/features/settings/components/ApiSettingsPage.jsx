import { useState } from 'react';
import {
  Box, Typography, Grid, Button, TextField,
  InputAdornment, IconButton, Alert, AlertTitle,
  Switch, FormControlLabel, Chip
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import {
  PageHeader, DataCard, FilterField, TL,
  ArrowPathIcon, CheckCircleIcon, KeyIcon, LinkIcon, DocumentCheckIcon, DocumentTextIcon,
} from 'shared';

const monoInput = { '& .MuiInputBase-input': { fontFamily: TL.mono, fontSize: '0.8125rem' } };

function PanelTitle({ icon, children }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box component="span" sx={{ display: 'inline-flex', color: TL.gray400 }}>{icon}</Box>
      {children}
    </Box>
  );
}

export default function ApiSettingsPage() {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyButton = (text) => (
    <IconButton size="small" onClick={() => handleCopy(text)}><ContentCopy sx={{ fontSize: 16 }} /></IconButton>
  );

  return (
    <Box>
      <PageHeader
        title="Integration API"
        subtitle="Manage your webhook endpoints and API credentials for automated intelligence delivery"
      />

      <Grid container spacing={3}>
        {/* API Credentials */}
        <Grid size={{ xs: 12, md: 7 }}>
          <DataCard title={<PanelTitle icon={<KeyIcon size={18} />}>Authentication Credentials</PanelTitle>} sx={{ height: '100%' }}>
            <FilterField label="Tenant ID" sx={{ mb: 2.5 }}>
              <TextField
                fullWidth
                readOnly
                size="small"
                value="TENANT-5d324818-4e41-4501"
                sx={monoInput}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {copyButton('TENANT-5d324818-4e41-4501')}
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>

            <FilterField label="API Key" sx={{ mb: 2.5 }}>
              <TextField
                fullWidth
                readOnly
                size="small"
                value="ath_live_8k3m2n9p7v5x1z4w..."
                sx={monoInput}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {copyButton('ath_live_8k3m2n9p7v5x1z4w...')}
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>

            <FilterField label="Webhook Secret" sx={{ mb: 2.5 }}>
              <TextField
                fullWidth
                readOnly
                size="small"
                type={showSecret ? 'text' : 'password'}
                value="whsec_0987654321fedcba0987654321"
                sx={monoInput}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" variant="text" onClick={() => setShowSecret(!showSecret)}>
                        {showSecret ? 'Hide' : 'Show'}
                      </Button>
                      {copyButton('whsec_0987654321fedcba0987654321')}
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>

            <Alert severity="warning">
              <AlertTitle sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Security Warning</AlertTitle>
              Rotating your secret will immediately invalidate the previous one. Ensure your endpoint is updated.
            </Alert>

            <Button variant="outlined" color="error" startIcon={<ArrowPathIcon size={16} />} sx={{ mt: 2 }}>
              Rotate Webhook Secret
            </Button>
          </DataCard>
        </Grid>

        {/* Webhook Configuration */}
        <Grid size={{ xs: 12, md: 5 }}>
          <DataCard title={<PanelTitle icon={<LinkIcon size={18} />}>Webhook Configuration</PanelTitle>} sx={{ height: '100%' }}>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked size="small" />}
                label={<Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray700 }}>Enable Webhook Delivery</Typography>}
              />
            </Box>

            <FilterField label="Destination URL" sx={{ mb: 2.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://your-api.com/webhooks/atheris"
                defaultValue="https://api.standardchartered.com/compliance/v1/hooks"
              />
            </FilterField>

            <FilterField label="Events to Subscribe" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {['new_instrument', 'obligation_flagged', 'sanction_alert', 'backfill_completed'].map(event => (
                  <Chip key={event} label={event} size="small" onClick={() => {}} sx={{ fontFamily: TL.mono, fontWeight: 500 }} />
                ))}
              </Box>
            </FilterField>

            <Button variant="contained" fullWidth startIcon={<DocumentCheckIcon size={16} />}>
              Save Configuration
            </Button>
          </DataCard>
        </Grid>

        {/* Quick Guide / Snippet */}
        <Grid size={{ xs: 12 }}>
          <DataCard
            title={<PanelTitle icon={<DocumentTextIcon size={18} />}>Implementation Guide</PanelTitle>}
            subtitle="All webhook payloads are signed with HMAC-SHA256. Verify the X-Atheris-Signature header using your Webhook Secret."
          >
            <Box sx={{ bgcolor: TL.gray800, color: TL.gray100, p: 2, borderRadius: '8px', position: 'relative' }}>
              <Typography sx={{ color: TL.gray400, position: 'absolute', top: 8, right: 12, fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.05em' }}>NODE.JS</Typography>
              <Box component="pre" sx={{ m: 0, fontFamily: TL.mono, fontSize: '0.75rem', overflowX: 'auto' }}>
{`const crypto = require('crypto');

app.post('/webhooks/atheris', (req, res) => {
  const signature = req.headers['x-atheris-signature'];
  const hmac = crypto.createHmac('sha256', process.env.ATHERIS_SECRET);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature === digest) {
    // Process obligation intelligence...
    res.status(200).send('Verified');
  } else {
    res.status(401).send('Invalid Signature');
  }
});`}
              </Box>
            </Box>
          </DataCard>
        </Grid>
      </Grid>

      {copied && (
        <Box
          sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1400,
            bgcolor: TL.gray800, color: '#fff', px: 2.5, py: 1, borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon size={18} sx={{ color: '#4ADE80' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Copied to clipboard</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
