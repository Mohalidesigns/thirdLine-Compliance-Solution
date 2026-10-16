import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Alert } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
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
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/returns')} sx={{ mb: 2 }}>Back to Returns</Button>
        <Alert severity="error">{error || 'Return not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/returns')} sx={{ mb: 2 }}>Back to Returns</Button>
      <ReturnDetailContent ret={ret} />
    </Box>
  );
}