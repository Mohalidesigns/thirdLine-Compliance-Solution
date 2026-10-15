import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Tabs, Tab, Drawer, Divider, Stack, Paper, CircularProgress, Alert, LinearProgress,
} from '@mui/material';
import {
  PageHeader, KpiCards, RiskBadge, StatusBadge, TL,
  CheckCircleIcon, XMarkIcon, ClockIcon, EyeIcon, ChevronRightIcon, FingerPrintIcon,
  ClipboardDocumentCheckIcon, InformationCircleIcon, ExclamationTriangleIcon, InboxIcon,
} from 'shared';
import api from '../../../services/api';

const statusConfig = {
  unclassified: { label: 'Unclassified', tone: 'gray' },
  applicable: { label: 'Applicable', tone: 'green' },
  not_applicable: { label: 'Not Applicable', tone: 'red' },
  under_review: { label: 'Under Review', tone: 'orange' },
};

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
      <PageHeader
        title="Review Inbox"
        subtitle="Review and classify incoming regulatory intelligence relevant to your license"
        actions={(
          <>
            <Button variant="outlined" startIcon={<FingerPrintIcon size={16} />}>Classification History</Button>
            <Button variant="contained" startIcon={<ClipboardDocumentCheckIcon size={16} />}>Bulk Confirm</Button>
          </>
        )}
        sx={{ pb: 0 }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: '-1px' }}>
          <Tab label="Needs Review" />
          <Tab label="Applicable" />
          <Tab label="Archived" />
        </Tabs>
      </PageHeader>

      {/* Summary Cards */}
      <KpiCards
        columns={4}
        items={[
          { key: 'pending', label: 'Pending Review', value: inboxItems.filter(i => i.tenantClassification === 'unclassified').length, tone: 'amber', icon: <ClockIcon /> },
          { key: 'high', label: 'High Risk', value: inboxItems.filter(i => i.riskRating === 'High').length, tone: 'red', icon: <ExclamationTriangleIcon /> },
          { key: 'confirmed', label: 'AI Confirmed', value: inboxItems.filter(i => i.applicabilityConfidence > 0.9).length, tone: 'green', icon: <CheckCircleIcon /> },
          { key: 'total', label: 'Total Inbox', value: inboxItems.length, tone: 'blue', icon: <InboxIcon /> },
        ]}
      />

      {/* Loading / Error / Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Instrument</TableCell>
                  <TableCell>Regulator</TableCell>
                  <TableCell>AI Confidence</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inboxItems.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: TL.gray500 }}>No items in this view</TableCell></TableRow>
                ) : inboxItems.map((item) => (
                  <TableRow key={item.instrumentId} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(item)}>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{item.sourceTitle}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>Discovered {formatDate(item.discoveredAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.regulatorAbbreviation || '—'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.applicabilityConfidence != null ? Math.round(item.applicabilityConfidence * 100) : 0}
                          sx={{ width: 56, '& .MuiLinearProgress-bar': { bgcolor: TL.success } }}
                        />
                        <Typography component="span" sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TL.gray700 }}>{formatConfidence(item.applicabilityConfidence)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <RiskBadge value={item.riskRating} emptyLabel="—" />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={statusConfig[item.tenantClassification]?.label || item.tenantClassification}
                        tone={statusConfig[item.tenantClassification]?.tone || 'gray'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Mark Applicable">
                          <IconButton size="small"><CheckCircleIcon size={16} /></IconButton>
                        </Tooltip>
                        <Tooltip title="Not Applicable">
                          <IconButton size="small"><XMarkIcon size={16} /></IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Detail View Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 480, p: 3 } }}>
        {selectedItem && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Chip label={selectedItem.regulatorAbbreviation || '—'} size="small" />
              <IconButton onClick={() => setDrawerOpen(false)} size="small"><XMarkIcon size={20} /></IconButton>
            </Box>

            <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: TL.gray800, mb: 0.5, lineHeight: 1.4 }}>{selectedItem.sourceTitle}</Typography>
            <Typography sx={{ display: 'block', mb: 3, fontSize: '0.75rem', color: TL.gray500 }}>
              Discovered {formatDate(selectedItem.discoveredAt)} • AI Confidence: {formatConfidence(selectedItem.applicabilityConfidence)}
            </Typography>

            <Box sx={{ p: 2, bgcolor: TL.gray50, border: `1px solid ${TL.gray100}`, borderRadius: '8px', mb: 3 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>Details</Typography>
              {[
                ['Area of Focus', selectedItem.areaOfFocus || '—'],
                ['Nature', selectedItem.nature || '—'],
              ].map(([k, val]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>{k}</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: TL.gray800, fontWeight: 500, textAlign: 'right' }}>{val}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 0.5 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>Risk Rating</Typography>
                <RiskBadge value={selectedItem.riskRating} emptyLabel="—" />
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, mb: 1.5 }}>Classification Actions</Typography>
            <Grid container spacing={1.5} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12 }}>
                <Button fullWidth variant="contained" color="success" startIcon={<CheckCircleIcon size={16} />}>
                  Confirm as Applicable
                </Button>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Button fullWidth variant="outlined" color="error" startIcon={<XMarkIcon size={16} />}>
                  Not Applicable
                </Button>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Button fullWidth variant="outlined" startIcon={<InformationCircleIcon size={16} />}>
                  Under Review
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, mb: 1.5 }}>Document Preview</Typography>
            <Box sx={{ height: 200, bgcolor: TL.gray50, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, border: `2px dashed ${TL.gray200}`, color: TL.gray400 }}>
              <EyeIcon size={32} />
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>PDF Preview Component</Typography>
              <Button size="small" variant="text" endIcon={<ChevronRightIcon size={16} />}>Open Original Source</Button>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
