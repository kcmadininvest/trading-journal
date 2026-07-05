import { useQuery } from '@tanstack/react-query';
import userService from '../services/userService';
import { authService } from '../services/auth';

export function useBootstrap(enabled = authService.isAuthenticated()) {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => userService.getBootstrap(),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
