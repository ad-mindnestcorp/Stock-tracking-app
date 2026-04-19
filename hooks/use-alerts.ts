import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.getAll(),
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
