import { useQuery } from '@tanstack/react-query';
import { tradingAccountsService } from '../services/tradingAccounts';
import { authService } from '../services/auth';

export interface UseTradingAccountsOptions {
  includeArchived?: boolean;
  enabled?: boolean;
}

export function useTradingAccounts(options: UseTradingAccountsOptions = {}) {
  const { includeArchived = false, enabled = authService.isAuthenticated() } = options;
  return useQuery({
    queryKey: ['tradingAccounts', { includeArchived }],
    queryFn: () =>
      tradingAccountsService.list({
        include_archived: includeArchived,
        include_inactive: includeArchived,
      }),
    enabled,
    staleTime: 60_000,
  });
}
