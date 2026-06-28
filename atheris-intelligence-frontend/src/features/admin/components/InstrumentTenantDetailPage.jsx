import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Button, IconButton, Tooltip,
} from '@mui/material';
import { ArrowBack, CheckCircle, Cancel, HourglassEmpty, PictureAsPdf } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const CLASSIFICATION_COLORS = {
  applicable: { bg: '#C6F6D5', text: '#22543D' },
  not_applicable: { bg: '#FED7D7', text: '#822727' },
  under_review: { bg: '#FEFCBF', text: '#744210' },
};

const CLASSIFICATION_LABELS = {
  applicable: 'Applicable',
  not_applicable: 'Not Applicable',
  under_review: 'Under Review',
};

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function InstrumentTenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.platform.instruments.getTenantClassifications(id)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  if (!data) return null;

  const classified = data.tenantClassifications.filter(t => t.classification);
  const unclassified = data.tenantClassifications.filter(t => !t.classification);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate(ROUTES.ADMIN_PIPELINE)}><ArrowBack /></IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Tenant Classification Status</Typography>
      </Box>

      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{data.sourceTitle}</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip label={data.regulatorName} size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: '#1A365D', color: '#fff', borderRadius: 1 }} />
            {data.riskRating && <Chip label={data.riskRating} size="small" color={data.riskRating === 'High' ? 'error' : data.riskRating === 'Medium' ? 'warning' : 'default'} />}
            {data.areaOfFocus && <Typography variant="caption" color="text.secondary">{data.areaOfFocus}</Typography>}
          </Box>
          {data.aiSummary && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.5 }}>
              {data.aiSummary}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>{classified.length}</strong> classified · <strong>{unclassified.length}</strong> not yet reviewed
        </Typography>
      </Box>

      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Tenant</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Licence Type</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Classification</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Reviewed At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.tenantClassifications.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6, color: '#A0AEC0' }}>No tenants found for this instrument</TableCell></TableRow>
              ) : data.tenantClassifications.map((tc) => {
                const color = CLASSIFICATION_COLORS[tc.classification];
                return (
                  <TableRow key={tc.tenantId} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{tc.legalName}</Typography>
                      {tc.shortName && <Typography variant="caption" color="text.secondary">{tc.shortName}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.8rem' }}>{tc.licenceType}</Typography>
                    </TableCell>
                    <TableCell>
                      {tc.classification ? (
                        <Chip
                          icon={tc.classification === 'applicable' ? <CheckCircle sx={{ fontSize: 14 }} /> : tc.classification === 'not_applicable' ? <Cancel sx={{ fontSize: 14 }} /> : <HourglassEmpty sx={{ fontSize: 14 }} />}
                          label={CLASSIFICATION_LABELS[tc.classification] || tc.classification}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.65rem', bgcolor: color?.bg || '#EDF2F7', color: color?.text || '#4A5568', borderRadius: 1 }}
                        />
                      ) : (
                        <Chip
                          icon={<HourglassEmpty sx={{ fontSize: 14 }} />}
                          label="Not Reviewed"
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.65rem', bgcolor: '#EDF2F7', color: '#A0AEC0', borderRadius: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>
                      {formatDt(tc.classifiedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
