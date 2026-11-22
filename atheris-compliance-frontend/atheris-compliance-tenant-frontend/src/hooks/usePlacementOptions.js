import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function usePlacementOptions() {
  const depts = useQuery({
    queryKey: ['org', 'departments', false],
    queryFn: () => api.org.departments(false),
    staleTime: 5 * 60 * 1000,
  });
  const units = useQuery({
    queryKey: ['org', 'teams'],
    queryFn: () => api.org.teams(),
    staleTime: 5 * 60 * 1000,
  });
  return { departments: depts.data || [], units: units.data || [] };
}

export function departmentOptions(departments) {
  return (departments || []).map((d) => ({ value: String(d.departmentId), label: d.name }));
}

export function unitOptions(units, departmentId) {
  return (units || [])
    .filter((t) => !departmentId || departmentId === 'All' || t.departmentId === Number(departmentId))
    .map((t) => ({ value: String(t.teamId), label: t.name }));
}
