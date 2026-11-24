import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Alert } from '@mui/material';
import { api } from '../services/api';

export default function TaskReviewRedirect({ kind }) {
  const navigate = useNavigate();
  const { id, testId } = useParams();

  const testQuery = useQuery({
    queryKey: ['tasks', 'review-redirect', String(testId)],
    queryFn: ({ signal }) => api.controls.testDetail(testId, { signal }),
    enabled: kind === 'control_test' && testId != null,
  });
  const controlId = testQuery.data?.controlId;

  useEffect(() => {
    if (kind === 'finding' && id != null) {
      navigate(`/tasks/view?subjectType=FINDING&subjectId=${id}&action=review`, { replace: true });
    }
  }, [kind, id, navigate]);

  useEffect(() => {
    if (kind === 'control_test' && controlId != null) {
      navigate(`/tasks/view?subjectType=CONTROL&subjectId=${controlId}&action=review&testId=${testId}`, { replace: true });
    }
  }, [kind, controlId, testId, navigate]);

  if (kind === 'control_test' && testQuery.isError) {
    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="error" action={<a href="/tasks">Back to Tasks</a>}>
          {testQuery.error?.message || 'Could not open the control test.'}
        </Alert>
      </Box>
    );
  }
  return <Box sx={{ py: 8 }} />;
}
