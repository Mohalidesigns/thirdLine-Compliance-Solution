import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Chip } from '@mui/material';
import { TL, StateBadge } from 'shared';
import { publicApi } from '../services/api';

export default function PublicStakeholderPortalPage() {
  const { id, token } = useParams();
  const query = useQuery({
    queryKey: ['public', 'stakeholder', id, token],
    queryFn: () => publicApi.stakeholderPortal(id, token),
    retry: false,
  });

  if (query.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  }
  if (query.isError) {
    return (
      <Box sx={{ maxWidth: 640, mx: 'auto', mt: 8, px: 2 }}>
        <Alert severity="error">{query.error.message}</Alert>
      </Box>
    );
  }

  const data = query.data || {};
  const items = data.items || [];
  const groups = items.reduce((acc, item) => {
    (acc[item.role] = acc[item.role] || []).push(item);
    return acc;
  }, {});

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', mt: 6, mb: 6, px: 2 }}>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: TL.gray800 }}>
        {data.fullName}
      </Typography>
      <Typography sx={{ color: TL.gray500, mb: 3 }}>
        {[data.departmentName, data.teamName].filter(Boolean).join(' · ') || 'Stakeholder portal'}
      </Typography>

      {items.length === 0 && (
        <Card variant="outlined"><CardContent>
          <Typography color="text.secondary">You have no assigned items right now.</Typography>
        </CardContent></Card>
      )}

      {Object.entries(groups).map(([role, list]) => (
        <Card key={role} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: TL.gray500, mb: 1 }}>
              {role} · {list.length}
            </Typography>
            {list.map((item) => (
              <Box key={`${item.subjectType}-${item.subjectId}`} sx={{ py: 0.75, borderTop: `1px solid ${TL.gray100}` }}>
                <Typography sx={{ fontWeight: 600, color: TL.gray800 }}>{item.title || item.detail || `${item.subjectType} #${item.subjectId}`}</Typography>
                <Typography variant="caption" sx={{ color: TL.gray500 }}>
                  {[item.detail, item.dueDate ? `Due ${item.dueDate}` : null].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      ))}

      <Box sx={{ mt: 3 }}>
        <Chip size="small" label="Secure stakeholder link" sx={{ bgcolor: TL.gray100 }} />
      </Box>
    </Box>
  );
}
