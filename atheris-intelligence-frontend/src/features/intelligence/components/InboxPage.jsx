import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Tabs, Tab, Drawer, Divider, Stack, Paper, CircularProgress, Alert,
} from '@mui/material';
import {
  CheckCircle, Cancel, HourglassEmpty, Visibility, OpenInNew,
  History, Bookmark, AssignmentTurnedIn, InfoOutlined,
} from '@mui/icons-material';
import api from '../../../services/api';

const statusConfig = {
  unclassified: { label: 'Unclassified', color: '#718096', bg: '#EDF2F7', icon: <HourglassEmpty sx={{ fontSize: 14 }} /> },
  applicable: { label: 'Applicable', color: '#2D7D46', bg: '#E6F4EA', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  not_applicable: { label: 'Not Applicable', color: '#C53030', bg: '#FEE2E2', icon: <Cancel sx={{ fontSize: 14 }} /> },
  under_review: { label: 'Under Review', color: '#DD6B20', bg: '#FEF3E2', icon: <InfoOutlined sx={{ fontSize: 14 }} /> },
};

const riskColors = { High: '#C53030', Medium: '#DD6B20', Low: '#2D7D46' };

function formatConfidence(val) {
  if (val == null) return '—';
  return `${Math.round(val * 100)}%`;
}

function formatDate(instant) {
  if (!instant) return '—';
  return new Date(instant).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function InboxPage() {
  const [tab, setTab] = useState(0);
  const [inboxItems, setInboxItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const statusMap = ['unclassified', 'applicable', null];

  useEffect(() => {
    setLoading(true);
    setError(null);
    const statusFilter = statusMap[tab];
    api.intelligence.getInbox(statusFilter)
      .then((data) => {
        let items = (data.content || []).filter(i => i !== null);
        if (tab === 2) {
          items = items.filter(i =>
            i.tenantClassification === 'not_applicable' || i.tenantClassification === 'under_review'
          );
        }
        setInboxItems(items);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab]);

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Review Inbox</Typography>
          <Typography variant="body2" color="text.secondary">Review and classify incoming regulatory intelligence relevant to your license</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<History />}>Classification History</Button>
          <Button variant="contained" size="small" startIcon={<AssignmentTurnedIn />}>Bulk Confirm</Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Pending Review', value: inboxItems.filter(i => i.tenantClassification === 'unclassified').length, color: '#D4AF37' },
          { label: 'High Risk', value: inboxItems.filter(i => i.riskRating === 'High').length, color: '#C53030' },
          { label: 'AI Confirmed', value: inboxItems.filter(i => i.applicabilityConfidence > 0.9).length, color: '#2D7D46' },
          { label: 'Total Inbox', value: inboxItems.length, color: '#1A365D' },
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

      {/* Filter Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Needs Review" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Applicable" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Archived" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {/* Loading / Error / Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Instrument</TableCell>
                  <TableCell>Regulator</TableCell>
                  <TableCell>AI Confidence</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Discovered</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inboxItems.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#718096' }}>No items in this view</TableCell></TableRow>
                ) : inboxItems.map((item) => (
                  <TableRow key={item.instrumentId} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(item)}>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.sourceTitle}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.regulatorAbbreviation || '—'} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 40, height: 4, bgcolor: '#EDF2F7', borderRadius: 2 }}>
                          <Box sx={{ width: formatConfidence(item.applicabilityConfidence), height: '100%', bgcolor: '#2D7D46', borderRadius: 2 }} />
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{formatConfidence(item.applicabilityConfidence)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: riskColors[item.riskRating] || '#718096' }}>{item.riskRating || '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#718096' }}>{formatDate(item.discoveredAt)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={statusConfig[item.tenantClassification]?.icon}
                        label={statusConfig[item.tenantClassification]?.label || item.tenantClassification}
                        sx={{ bgcolor: statusConfig[item.tenantClassification]?.bg || '#EDF2F7', color: statusConfig[item.tenantClassification]?.color || '#718096', fontWeight: 600, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="Mark Applicable">
                          <IconButton size="small" sx={{ color: '#2D7D46' }}><CheckCircle sx={{ fontSize: 18 }} /></IconButton>
                        </Tooltip>
                        <Tooltip title="Not Applicable">
                          <IconButton size="small" sx={{ color: '#C53030' }}><Cancel sx={{ fontSize: 18 }} /></IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Detail View Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 480, p: 3 } }}>
        {selectedItem && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Chip label={selectedItem.regulatorAbbreviation || '—'} size="small" sx={{ fontWeight: 700, bgcolor: '#1A365D', color: '#fff' }} />
              <IconButton onClick={() => setDrawerOpen(false)} size="small"><Cancel /></IconButton>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.3 }}>{selectedItem.sourceTitle}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Discovered {formatDate(selectedItem.discoveredAt)} • AI Confidence: {formatConfidence(selectedItem.applicabilityConfidence)}
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F7FAFC', mb: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#1A365D', display: 'block', mb: 0.5 }}>DETAILS</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                Area of Focus: {selectedItem.areaOfFocus || '—'}<br />
                Nature: {selectedItem.nature || '—'}<br />
                Risk Rating: {selectedItem.riskRating || '—'}
              </Typography>
            </Paper>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Classification Actions</Typography>
            <Grid container spacing={1.5} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <Button fullWidth variant="contained" sx={{ bgcolor: '#2D7D46', '&:hover': { bgcolor: '#276749' } }} startIcon={<CheckCircle />}>
                  Confirm as Applicable
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button fullWidth variant="outlined" color="error" startIcon={<Cancel />}>
                  Not Applicable
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button fullWidth variant="outlined" sx={{ color: '#DD6B20', borderColor: '#DD6B20' }} startIcon={<InfoOutlined />}>
                  Under Review
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Document Preview</Typography>
            <Box sx={{ height: 200, bgcolor: '#EDF2F7', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, border: '2px dashed #CBD5E0' }}>
              <Visibility sx={{ fontSize: 32, color: '#A0AEC0' }} />
              <Typography variant="caption" color="text.secondary">PDF Preview Component</Typography>
              <Button size="small" variant="text" startIcon={<OpenInNew />}>Open Original Source</Button>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
