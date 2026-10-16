import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { DetailHeader } from 'shared';
import api from '../../../services/api';
import ReturnDetailContent from './detail/ReturnDetailContent';

export default function ReturnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ret, setRet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.platform.returns.get(id)
      .then((data) => { if (active) setRet(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ret) {
    return (
      <Box>
        <DetailHeader band title="Return" onBack={() => navigate('/admin/returns')} backLabel="Back to Returns" />
        <Alert severity="error">{error || 'Return not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader band title="Return details" onBack={() => navigate('/admin/returns')} backLabel="Back to Returns" />
      <ReturnDetailContent ret={ret} />
    </Box>
  );
}
