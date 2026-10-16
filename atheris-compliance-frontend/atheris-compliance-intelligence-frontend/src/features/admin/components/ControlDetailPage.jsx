import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip,
} from '@mui/material';
import { ArrowBack, FactCheck, Link as LinkIcon, Gavel, ChevronRight } from '@mui/icons-material';
import api from '../../../services/api';

const RISK_COLOR = {
  Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success',
};

const STATUS_COLOR = { Open: 'warning', Closed: 'success', 'In Progress': 'info' };

function Meta({ label, value }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || '—'}</Typography>
    </Box>
  );
}

function LongText({ title, text }) {
  return (
    <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #EDF2F7' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {text
          ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</Typography>
          : <Typography variant="body2" color="text.secondary">Not recorded.</Typography>}
      </CardContent>
    </Card>
  );
}

export default function ControlDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: ctl, isLoading, error } = useQuery({
    queryKey: ['control', String(id)],
    queryFn: ({ signal }) => api.platform.controls.get(id, signal),
    enabled: !!id,
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ctl) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/controls')} sx={{ mb: 2 }}>Back to Controls</Button>
        <Alert severity="error">{error?.message || 'Control not found'}</Alert>
      </Box>
    );
  }

  // The control statement is the display title — the internal control code is never shown.
  const title = (ctl.points && ctl.points[0] && (ctl.points[0].content || ctl.points[0].text))
    || ctl.complianceControl;
  const linkedObligations = ctl.linkedObligations || [];

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/controls')} sx={{ mb: 2 }}>Back to Controls</Button>

      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <FactCheck sx={{ color: '#2B6CB0' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{title || 'Untitled control'}</Typography>
            {ctl.riskLevel && (
              <Chip size="small" label={ctl.riskLevel} color={RISK_COLOR[ctl.riskLevel] || 'default'} />
            )}
            <Chip size="small" label={ctl.status || 'Open'} color={STATUS_COLOR[ctl.status] || 'default'} />
          </Box>

          {ctl.actName && (
            <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, mb: 1.5, cursor: ctl.actId ? 'pointer' : 'default' }}
              onClick={() => ctl.actId && navigate(`/admin/acts/${ctl.actId}`)}>
              <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              {ctl.actName}
            </Typography>
          )}

          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Theme" value={ctl.theme} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Compliance Area" value={ctl.complianceArea} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Frequency" value={ctl.frequency} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Due Date" value={ctl.dueDate} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Responsible Officer" value={ctl.responsibleOfficer} /></Grid>
          </Grid>
        </CardContent>
      </Card>

      <LongText title="Compliance Control" text={ctl.complianceControl} />
      <LongText title="Regulatory Requirement" text={ctl.regulatoryRequirement} />
      <LongText title="Monitoring Activity" text={ctl.monitoringActivity} />
      <LongText title="Control Effectiveness Measure" text={ctl.controlEffectivenessMeasure} />

      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Linked Obligations</Typography>
          {linkedObligations.length > 0 && (
            <Chip size="small" label={linkedObligations.length} color="primary" sx={{ height: 22, borderRadius: '4px' }} />
          )}
        </Box>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          {linkedObligations.length > 0 ? (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Obligation</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Instrument</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linkedObligations.map((o) => (
                    <TableRow key={o.obligationId} hover
                      onClick={() => navigate(`/admin/obligations/${o.obligationId}`)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }}>
                      <TableCell sx={{ fontFamily: 'Roboto Mono, monospace', color: '#718096', width: 80 }}>
                        #{o.obligationId}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{o.title || o.description || 'Untitled obligation'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{o.instrumentTitle || '-'}</Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Tooltip title="Open obligation">
                          <IconButton size="small"
                            onClick={e => { e.stopPropagation(); navigate(`/admin/obligations/${o.obligationId}`); }}>
                            <ChevronRight fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Gavel sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No obligations are linked to this control yet.</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}