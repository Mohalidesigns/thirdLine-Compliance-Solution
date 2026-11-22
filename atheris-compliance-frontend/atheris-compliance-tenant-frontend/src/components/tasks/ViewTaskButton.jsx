import { useQuery } from '@tanstack/react-query';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function ViewTaskButton({ subjectType, subjectId, category, size = 'small', variant = 'outlined', sx }) {
  const navigate = useNavigate();
  const enabled = subjectType != null && subjectId != null;
  const query = useQuery({
    queryKey: ['tasks', 'exists', subjectType, subjectId],
    queryFn: ({ signal }) => api.tasks.center(
      { assignee: 'all', subjectType, subjectId, size: 1 }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const hasTask = (query.data?.totalElements ?? 0) > 0;

  return (
    <Button size={size} variant={variant} sx={sx} disabled={!enabled || !hasTask}
      onClick={() => navigate(`/tasks?assignee=all&category=${category}&subjectType=${subjectType}&subjectId=${subjectId}`)}>
      View task
    </Button>
  );
}
