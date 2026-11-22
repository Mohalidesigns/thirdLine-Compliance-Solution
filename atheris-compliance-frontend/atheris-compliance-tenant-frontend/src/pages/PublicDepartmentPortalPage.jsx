import { useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Chip } from '@mui/material';
import { TL } from 'shared';
import { publicApi } from '../services/api';

function Stat({ label, value, tone }) {
  return (
    <Box sx={{ flex: '1 1 130px', minWidth: 120, border: `1px solid ${TL.gray100}`, borderRadius: '10px', p: 1.5 }}>
      <Typography sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: TL.gray500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: tone || TL.gray800 }}>{value}</Typography>
    </Box>
  );
}

export default function PublicDepartmentPortalPage() {
  const { id, token } = useParams();
  const { pathname } = useLocation();
  const scope = pathname.startsWith('/unit') ? 'unit' : 'department';

  const query = useQuery({
    queryKey: ['public', 'department', scope, id, token],
    queryFn: () => publicApi.departmentPortal(scope, id, token),
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
  const risk = Object.entries(data.obligationsByRisk || {});

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 6, mb: 6, px: 2 }}>
      <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: TL.gray500 }}>
        {data.organizationName || 'Compliance report'} · {data.scopeType} report
      </Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: TL.gray800 }}>{data.name}</Typography>
      {data.parentDepartmentName && (
        <Typography sx={{ color: TL.gray500, mb: 1 }}>{data.parentDepartmentName}</Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', my: 3 }}>
        <Stat label="Obligations" value={data.obligationCount ?? 0} />
        <Stat label="Controls" value={data.controlCount ?? 0} />
        <Stat label="Open findings" value={data.openFindingCount ?? 0} />
        <Stat label="Overdue findings" value={data.overdueFindingCount ?? 0} tone="#C53030" />
        <Stat label="Returns" value={data.returnCount ?? 0} />
      </Box>

      {risk.length > 0 && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: TL.gray500, mb: 1 }}>
              Obligations by inherent risk
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {risk.map(([band, count]) => (
                <Chip key={band} size="small" label={`${band}: ${count}`} sx={{ bgcolor: TL.gray100 }} />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: TL.gray500, mb: 1 }}>
            Open findings
          </Typography>
          {(data.findings || []).length === 0 && (
            <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>No open findings.</Typography>
          )}
          {(data.findings || []).map((f, i) => (
            <Box key={i} sx={{ py: 0.75, borderTop: i === 0 ? 0 : `1px solid ${TL.gray100}` }}>
              <Typography sx={{ fontWeight: 600, color: TL.gray800 }}>{f.title || f.detail}</Typography>
              <Typography variant="caption" sx={{ color: TL.gray500 }}>
                {[f.status, f.dueDate ? `Due ${f.dueDate}` : null].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: TL.gray500, mb: 1 }}>
            Returns
          </Typography>
          {(data.returns || []).length === 0 && (
            <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>No returns.</Typography>
          )}
          {(data.returns || []).map((r, i) => (
            <Box key={i} sx={{ py: 0.75, borderTop: i === 0 ? 0 : `1px solid ${TL.gray100}` }}>
              <Typography sx={{ fontWeight: 600, color: TL.gray800 }}>{r.title}</Typography>
              <Typography variant="caption" sx={{ color: TL.gray500 }}>
                {[r.detail, r.status].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        <Chip size="small" label="Secure reporting link" sx={{ bgcolor: TL.gray100 }} />
      </Box>
    </Box>
  );
}
