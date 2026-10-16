import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { DetailHeader } from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import SanctionDetailContent from './detail/SanctionDetailContent';

export default function SanctionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sanction, setSanction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.platform.sanctions.get(id)
      .then(data => { if (active) setSanction(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !sanction) {
    return (
      <Box>
        <DetailHeader band title="Sanction" onBack={() => navigate(ROUTES.ADMIN_SANCTIONS)} backLabel="Back to Sanctions" />
        <Alert severity="error">{error || 'Sanction not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader band title="Sanction details" onBack={() => navigate(ROUTES.ADMIN_SANCTIONS)} backLabel="Back to Sanctions" />
      <SanctionDetailContent sanction={sanction} />
    </Box>
  );
}
