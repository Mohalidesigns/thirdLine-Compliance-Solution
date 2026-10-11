import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Alert } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import api from '../../../services/api';
import ControlDetailContent from './detail/ControlDetailContent';

export default function ControlDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ctl, setCtl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api.platform.controls.get(id)
      .then(data => { if (alive) setCtl(data); })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ctl) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/controls')} sx={{ mb: 2 }}>Back to Controls</Button>
        <Alert severity="error">{error || 'Control not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/controls')} sx={{ mb: 2 }}>Back to Controls</Button>
      <ControlDetailContent control={ctl} onActClick={(actId) => navigate(`/admin/acts/${actId}`)} />
    </Box>
  );
}