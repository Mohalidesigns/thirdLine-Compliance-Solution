import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import { PageHeader, DataCard, RiskBadge, StatusBadge, TL } from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const CLASSIFICATION_TONE = {
  applicable: 'green',
  not_applicable: 'red',
  under_review: 'amber',
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
      <PageHeader
        title="Tenant Classification Status"
        subtitle={(
          <>
            <strong>{classified.length}</strong> classified · <strong>{unclassified.length}</strong> not yet reviewed
          </>
        )}
        onBack={() => navigate(ROUTES.ADMIN_PIPELINE)}
        backLabel="Back to Pipeline"
      />

      <DataCard sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: TL.textPrimary, mb: 1 }}>{data.sourceTitle}</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge label={data.regulatorName} tone="blue" />
          {data.riskRating && <RiskBadge value={data.riskRating} />}
          {data.areaOfFocus && <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{data.areaOfFocus}</Typography>}
        </Box>
        {data.aiSummary && (
          <Typography sx={{ mt: 1.5, fontSize: '0.875rem', color: TL.gray600, lineHeight: 1.5 }}>
            {data.aiSummary}
          </Typography>
        )}
      </DataCard>

      <DataCard noPadding>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Licence Type</TableCell>
                <TableCell>Classification</TableCell>
                <TableCell>Reviewed At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.tenantClassifications.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6, color: TL.gray400 }}>No tenants found for this instrument</TableCell></TableRow>
              ) : data.tenantClassifications.map((tc) => (
                <TableRow key={tc.tenantId} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'primary.main' }}>{tc.legalName}</Typography>
                    {tc.shortName && <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{tc.shortName}</Typography>}
                  </TableCell>
                  <TableCell>{tc.licenceType}</TableCell>
                  <TableCell>
                    {tc.classification ? (
                      <StatusBadge
                        label={CLASSIFICATION_LABELS[tc.classification] || tc.classification}
                        tone={CLASSIFICATION_TONE[tc.classification] || 'gray'}
                      />
                    ) : (
                      <StatusBadge label="Not Reviewed" tone="gray" />
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: TL.gray500, whiteSpace: 'nowrap' }}>
                    {formatDt(tc.classifiedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DataCard>
    </Box>
  );
}
