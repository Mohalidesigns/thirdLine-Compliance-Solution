import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  InputAdornment, IconButton, Divider, Alert, AlertTitle,
  Paper, Switch, FormControlLabel, Tooltip, Chip
} from '@mui/material';
import {
  ContentCopy, Refresh, CheckCircle, Warning, VpnKey,
  Webhook, Save, Terminal, Code
} from '@mui/icons-material';

export default function ApiSettingsPage() {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Integration API</Typography>
        <Typography variant="body2" color="text.secondary">Manage your webhook endpoints and API credentials for automated intelligence delivery</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* API Credentials */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <VpnKey sx={{ color: '#1A365D' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Authentication Credentials</Typography>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>TENANT ID</Typography>
                <TextField
                  fullWidth
                  readOnly
                  size="small"
                  value="TENANT-5d324818-4e41-4501"
                  sx={{ mt: 0.5, '& .MuiInputBase-input': { fontFamily: 'Roboto Mono', fontSize: '0.8rem' } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => handleCopy('TENANT-5d324818-4e41-4501')}><ContentCopy sx={{ fontSize: 16 }} /></IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>API KEY</Typography>
                <TextField
                  fullWidth
                  readOnly
                  size="small"
                  value="ath_live_8k3m2n9p7v5x1z4w..."
                  sx={{ mt: 0.5, '& .MuiInputBase-input': { fontFamily: 'Roboto Mono', fontSize: '0.8rem' } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => handleCopy('ath_live_8k3m2n9p7v5x1z4w...')}><ContentCopy sx={{ fontSize: 16 }} /></IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>WEBHOOK SECRET</Typography>
                <TextField
                  fullWidth
                  readOnly
                  size="small"
                  type={showSecret ? 'text' : 'password'}
                  value="whsec_0987654321fedcba0987654321"
                  sx={{ mt: 0.5, '& .MuiInputBase-input': { fontFamily: 'Roboto Mono', fontSize: '0.8rem' } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => setShowSecret(!showSecret)} sx={{ fontSize: '0.65rem' }}>
                          {showSecret ? 'Hide' : 'Show'}
                        </Button>
                        <IconButton size="small" onClick={() => handleCopy('whsec_0987654321fedcba0987654321')}><ContentCopy sx={{ fontSize: 16 }} /></IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Alert severity="warning" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                <AlertTitle sx={{ fontSize: '0.8rem', fontWeight: 700 }}>Security Warning</AlertTitle>
                Rotating your secret will immediately invalidate the previous one. Ensure your endpoint is updated.
              </Alert>
              
              <Button variant="outlined" color="error" size="small" startIcon={<Refresh />} sx={{ mt: 2 }}>
                Rotate Webhook Secret
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Webhook Configuration */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Webhook sx={{ color: '#1A365D' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Webhook Configuration</Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Enable Webhook Delivery</Typography>}
                />
              </Box>

              <TextField
                fullWidth
                size="small"
                label="Destination URL"
                placeholder="https://your-api.com/webhooks/atheris"
                defaultValue="https://api.standardchartered.com/compliance/v1/hooks"
                sx={{ mb: 2 }}
              />

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>EVENTS TO SUBSCRIBE</Typography>
                <Grid container spacing={1}>
                  {['new_instrument', 'obligation_flagged', 'sanction_alert', 'backfill_completed'].map(event => (
                    <Grid item key={event}>
                      <Chip label={event} size="small" onClick={() => {}} sx={{ fontSize: '0.7rem' }} />
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Button variant="contained" fullWidth startIcon={<Save />}>
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Guide / Snippet */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#1A202C', color: '#E2E8F0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Code sx={{ color: '#63B3ED' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Implementation Guide</Typography>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 2, color: '#A0AEC0' }}>
                All webhook payloads are signed with **HMAC-SHA256**. Verify the `X-Atheris-Signature` header using your Webhook Secret.
              </Typography>

              <Box sx={{ bgcolor: '#2D3748', p: 2, borderRadius: 1, position: 'relative' }}>
                <Typography variant="caption" sx={{ color: '#63B3ED', position: 'absolute', top: 8, right: 12 }}>NODE.JS</Typography>
                <Box component="pre" sx={{ m: 0, fontFamily: 'Roboto Mono', fontSize: '0.75rem', overflowX: 'auto' }}>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {copied && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            bgcolor: '#2D7D46', color: '#fff', px: 3, py: 1, borderRadius: 20
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle sx={{ fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Copied to clipboard</Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
