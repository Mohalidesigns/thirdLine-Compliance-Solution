import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, Alert } from '@mui/material';
import { DetailHeader } from 'shared';
import api from '../../../services/api';
import ControlDetailContent from './detail/ControlDetailContent';

export default function ControlDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['controls', 'detail', String(id)],
    queryFn: ({ signal }) => api.platform.controls.get(id, signal),
  });

  const ctl = query.data;
  const loading = query.isPending;
  const error = query.isError ? (query.error?.message || 'Failed to load control') : null;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ctl) {
    return (
      <Box>
        <DetailHeader band title="Control" onBack={() => navigate('/admin/controls')} backLabel="Back to Controls" />
        <Alert severity="error">{error || 'Control not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader band title="Control" onBack={() => navigate('/admin/controls')} backLabel="Back to Controls" />
      <ControlDetailContent control={ctl} onActClick={(actId) => navigate(`/admin/acts/${actId}`)} />
    </Box>
  );
}