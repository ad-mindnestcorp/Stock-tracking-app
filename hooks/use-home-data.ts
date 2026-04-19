import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/lib/api';

export function useHomeData() {
  return useQuery({
    queryKey: ['home'],
    queryFn: marketApi.getHome,
    staleTime: 60_000,
  });
}
