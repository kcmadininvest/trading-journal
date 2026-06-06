import type { TradingAccount } from '../services/tradingAccounts';
import type { DashboardBalanceContext } from '../services/dashboard';
import {
  hasFiniteMll,
  parseInitialCapital,
  parseOptionalAmount,
} from './accountCapital';

export interface AccountChartConfig {
  initialCapital: number;
  openingBalance: number;
  referenceBalance: number;
  showMll: boolean;
  profitTargetAbsolute: number | null;
  mllInitial: number | null;
}

export function resolveAccountChartConfig(
  account: TradingAccount | null | undefined,
  balanceContext?: DashboardBalanceContext | null,
): AccountChartConfig {
  const initialCapital = parseInitialCapital(account?.initial_capital);

  const openingFromContext = balanceContext?.opening_balance
    ? parseInitialCapital(balanceContext.opening_balance)
    : null;
  const openingBalance = openingFromContext ?? initialCapital;

  const showMll =
    account?.mll_enabled !== false &&
    hasFiniteMll(account?.maximum_loss_limit);

  const mllInitial = showMll
    ? parseOptionalAmount(account?.maximum_loss_limit)
    : null;

  let profitTargetAbsolute: number | null = null;
  if (balanceContext?.profit_target_absolute != null) {
    profitTargetAbsolute = parseInitialCapital(balanceContext.profit_target_absolute);
  } else if (
    account?.profit_target_enabled === true &&
    account?.profit_target != null &&
    account.profit_target !== ''
  ) {
    const targetDelta = parseOptionalAmount(account.profit_target);
    if (targetDelta !== null) {
      profitTargetAbsolute = initialCapital + targetDelta;
    }
  }

  return {
    initialCapital,
    openingBalance,
    referenceBalance: openingBalance,
    showMll,
    profitTargetAbsolute,
    mllInitial,
  };
}
