import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Paper, Typography, Chip, Stack, Grid, Button, CircularProgress, Divider } from '@mui/material';
import FormattedText from '../../components/FormattedText';
import api from '../../services/api';

const RISK_COLOR = {
  Critical: 'error',
  High: 'error',
  Extreme: 'error',
  Moderate: 'warning',
  Medium: 'warning',
  Low: 'success',
};

function riskChip(risk) {
  if (!risk) return <Chip size="small" label="Unrated" sx={{ height: 22, borderRadius: '4px' }} />;
  const c = RISK_COLOR[risk] || 'default';
  return <Chip size="small" label={risk} color={c} sx={{ height: 22, borderRadius: '4px' }} />;
}

function MetaItem({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>{value || '-'}</Typography>
    </Box>
  );
}

export default function ObligationExplorerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const obligationsApi = api.platform?.obligations ?? api.obligations;

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['obligation', id],
    queryFn: ({ signal }) => obligationsApi.get(id, signal),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Typography color="error">{error.message || 'Failed to load obligation.'}</Typography>
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box sx={{ p: 2 }}>
        <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Typography>Not found</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {riskChip(detail.riskRating)}
        {detail.areaOfFocus && <Chip size="small" label={detail.areaOfFocus} sx={{ height: 22, borderRadius: '4px' }} />}
        {detail.obligationType && <Chip size="small" label={detail.obligationType} sx={{ height: 22, borderRadius: '4px' }} />}
        <Chip
          size="small"
          label={detail.hasPoints ? 'With Points' : 'Without Points'}
          color={detail.hasPoints ? 'success' : 'default'}
          sx={{ height: 22, borderRadius: '4px' }}
        />
      </Stack>

      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.5 }}>
        {detail.title || 'Untitled obligation'}
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Instrument" value={detail.instrumentTitle || detail.instrument?.sourceTitle} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Regulator" value={detail.regulatorAbbreviation || detail.regulatorName} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Section Reference" value={detail.sectionReference} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Act Name" value={detail.actName} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Risk Description" value={detail.riskDescription} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Control Owner" value={detail.controlOwner} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Obligation Type" value={detail.obligationType} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MetaItem label="Recurring Deadline" value={detail.recurringDeadlineType} />
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Source Text (Verbatim)
        </Typography>
        <FormattedText text={detail.description} points={detail.points} pointType="verbatim" />
        {!detail.description && (!detail.points || detail.points.length === 0) && (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Plain English (Interpreted)
        </Typography>
        <FormattedText text={detail.plainEnglishStatement} points={detail.points} pointType="interpreted" />
        {!detail.plainEnglishStatement && (!detail.points || detail.points.length === 0) && (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )}
      </Paper>
    </Box>
  );
}
