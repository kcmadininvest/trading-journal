import React, { useState } from 'react';
import { Calculator, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import calculatorApi, {
  PositionSizeRequest,
  FixedRiskRequest,
  RiskRewardRequest,
  BreakevenRequest,
  MarginRequest,
  ForexLotSizeRequest,
  PositionSizeResponse,
  RiskRewardResponse,
  BreakevenResponse,
  MarginResponse,
  ForexLotSizeResponse,
} from '../../services/calculatorApi';

type CalculatorMode = 'percentage' | 'fixed' | 'riskReward' | 'breakeven' | 'margin' | 'forexLotSize';

const PositionCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CalculatorMode>('percentage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountBalance, setAccountBalance] = useState<string>('50000');
  const [riskPercentage, setRiskPercentage] = useState<string>('1');
  const [riskAmount, setRiskAmount] = useState<string>('500');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLossPrice, setStopLossPrice] = useState<string>('');
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>('');
  const [positionSize, setPositionSize] = useState<string>('');
  const [tickValue, setTickValue] = useState<string>('');
  const [tickSize, setTickSize] = useState<string>('1');
  const [commissionPerContract, setCommissionPerContract] = useState<string>('2.50');
  const [leverage, setLeverage] = useState<string>('10');
  const [instrumentType, setInstrumentType] = useState<string>('futures');
  const [contractSize, setContractSize] = useState<string>('');
  const [pipValue, setPipValue] = useState<string>('');
  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  const [pairQuoteCurrency, setPairQuoteCurrency] = useState<string>('USD');

  const [result, setResult] = useState<PositionSizeResponse | RiskRewardResponse | BreakevenResponse | MarginResponse | ForexLotSizeResponse | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Validation des champs obligatoires
      if (mode === 'percentage') {
        if (!accountBalance || parseFloat(accountBalance) <= 0) {
          setError(t('calculator:errors.accountBalanceRequired'));
          setLoading(false);
          return;
        }
        if (!riskPercentage || parseFloat(riskPercentage) <= 0) {
          setError(t('calculator:errors.riskPercentageRequired'));
          setLoading(false);
          return;
        }
        if (!entryPrice || parseFloat(entryPrice) <= 0) {
          setError(t('calculator:errors.entryPriceRequired'));
          setLoading(false);
          return;
        }
        if (!stopLossPrice) {
          setError(t('calculator:errors.stopLossPriceRequired'));
          setLoading(false);
          return;
        }
      } else if (mode === 'fixed') {
        if (!riskAmount || parseFloat(riskAmount) <= 0) {
          setError(t('calculator:errors.riskAmountRequired'));
          setLoading(false);
          return;
        }
        if (!entryPrice || parseFloat(entryPrice) <= 0) {
          setError(t('calculator:errors.entryPriceRequired'));
          setLoading(false);
          return;
        }
        if (!stopLossPrice) {
          setError(t('calculator:errors.stopLossPriceRequired'));
          setLoading(false);
          return;
        }
      } else if (mode === 'riskReward') {
        if (!positionSize || parseFloat(positionSize) <= 0) {
          setError(t('calculator:errors.positionSizeRequired'));
          setLoading(false);
          return;
        }
        if (!entryPrice || parseFloat(entryPrice) <= 0) {
          setError(t('calculator:errors.entryPriceRequired'));
          setLoading(false);
          return;
        }
        if (!stopLossPrice) {
          setError(t('calculator:errors.stopLossPriceRequired'));
          setLoading(false);
          return;
        }
        if (!takeProfitPrice) {
          setError(t('calculator:errors.takeProfitPriceRequired'));
          setLoading(false);
          return;
        }
      } else if (mode === 'breakeven') {
        if (!positionSize || parseFloat(positionSize) <= 0) {
          setError(t('calculator:errors.positionSizeRequired'));
          setLoading(false);
          return;
        }
        if (!entryPrice || parseFloat(entryPrice) <= 0) {
          setError(t('calculator:errors.entryPriceRequired'));
          setLoading(false);
          return;
        }
        if (!tickSize || parseFloat(tickSize) <= 0) {
          setError(t('calculator:errors.tickSizeRequired'));
          setLoading(false);
          return;
        }
      } else if (mode === 'margin') {
        if (!positionSize || parseFloat(positionSize) <= 0) {
          setError(t('calculator:errors.positionSizeRequired'));
          setLoading(false);
          return;
        }
        if (!entryPrice || parseFloat(entryPrice) <= 0) {
          setError(t('calculator:errors.entryPriceRequired'));
          setLoading(false);
          return;
        }
        if (!leverage || parseFloat(leverage) <= 0) {
          setError(t('calculator:errors.leverageRequired'));
          setLoading(false);
          return;
        }
      } else if (mode === 'forexLotSize') {
        if (!accountBalance || parseFloat(accountBalance) <= 0) {
          setError(t('calculator:errors.accountBalanceRequired'));
          setLoading(false);
          return;
        }
        if (!riskPercentage || parseFloat(riskPercentage) <= 0) {
          setError(t('calculator:errors.riskPercentageRequired'));
          setLoading(false);
          return;
        }
        if (!entryPrice || parseFloat(entryPrice) <= 0) {
          setError(t('calculator:errors.entryPriceRequired'));
          setLoading(false);
          return;
        }
        if (!stopLossPrice) {
          setError(t('calculator:errors.stopLossPriceRequired'));
          setLoading(false);
          return;
        }
      }

      if (mode === 'percentage') {
        const data: PositionSizeRequest = {
          account_balance: parseFloat(accountBalance),
          risk_percentage: parseFloat(riskPercentage),
          entry_price: parseFloat(entryPrice),
          stop_loss_price: parseFloat(stopLossPrice),
          tick_value: tickValue ? parseFloat(tickValue) : undefined,
          tick_size: tickSize ? parseFloat(tickSize) : undefined,
        };
        const response = await calculatorApi.calculatePositionSize(data);
        setResult(response);
      } else if (mode === 'fixed') {
        const data: FixedRiskRequest = {
          risk_amount: parseFloat(riskAmount),
          entry_price: parseFloat(entryPrice),
          stop_loss_price: parseFloat(stopLossPrice),
          tick_value: tickValue ? parseFloat(tickValue) : undefined,
          tick_size: tickSize ? parseFloat(tickSize) : undefined,
        };
        const response = await calculatorApi.calculateFixedRisk(data);
        setResult(response);
      } else if (mode === 'riskReward') {
        const data: RiskRewardRequest = {
          position_size: parseFloat(positionSize),
          entry_price: parseFloat(entryPrice),
          stop_loss_price: parseFloat(stopLossPrice),
          take_profit_price: parseFloat(takeProfitPrice),
          tick_value: tickValue ? parseFloat(tickValue) : undefined,
          tick_size: tickSize ? parseFloat(tickSize) : undefined,
        };
        const response = await calculatorApi.calculateRiskReward(data);
        setResult(response);
      } else if (mode === 'breakeven') {
        const data: BreakevenRequest = {
          position_size: parseFloat(positionSize),
          entry_price: parseFloat(entryPrice),
          commission_per_contract: parseFloat(commissionPerContract),
          tick_size: parseFloat(tickSize),
        };
        const response = await calculatorApi.calculateBreakeven(data);
        setResult(response);
      } else if (mode === 'margin') {
        const data: MarginRequest = {
          position_size: parseFloat(positionSize),
          entry_price: parseFloat(entryPrice),
          leverage: parseFloat(leverage),
          instrument_type: instrumentType,
          contract_size: contractSize ? parseFloat(contractSize) : undefined,
        };
        const response = await calculatorApi.calculateMargin(data);
        setResult(response);
      } else if (mode === 'forexLotSize') {
        const data: ForexLotSizeRequest = {
          account_balance: parseFloat(accountBalance),
          risk_percentage: parseFloat(riskPercentage),
          entry_price: parseFloat(entryPrice),
          stop_loss_price: parseFloat(stopLossPrice),
          pip_value: pipValue ? parseFloat(pipValue) : undefined,
          account_currency: accountCurrency,
          pair_quote_currency: pairQuoteCurrency,
        };
        const response = await calculatorApi.calculateForexLotSize(data);
        setResult(response);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('calculator:errors.calculationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const renderResults = () => {
    if (!result) return null;

    if (mode === 'percentage' || mode === 'fixed') {
      const posResult = result as PositionSizeResponse;
      return (
        <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-blue-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            {t('calculator:results.calculationResults')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('calculator:results.positionSize')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {posResult.position_size.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">{t('calculator:results.contractsShares')}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('calculator:results.riskAmount')}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                ${posResult.risk_amount.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('calculator:results.riskPerUnit')}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                ${posResult.risk_per_unit.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('calculator:results.positionValue')}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                ${posResult.position_value.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('calculator:results.stopLossDistance')}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {posResult.stop_loss_distance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      );
    } else if (mode === 'riskReward') {
      const rrResult = result as RiskRewardResponse;
      return (
        <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-green-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
            Risk/Reward Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Risk Amount</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                ${rrResult.risk_amount.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Reward Amount</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${rrResult.reward_amount.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Risk/Reward Ratio</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                1:{rrResult.risk_reward_ratio.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      );
    } else if (mode === 'breakeven') {
      const beResult = result as BreakevenResponse;
      return (
        <div className="mt-6 p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-purple-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            Breakeven Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Commission</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ${beResult.total_commission.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Ticks to Breakeven</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {beResult.ticks_to_breakeven.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Breakeven (Long)</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                ${beResult.breakeven_long.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Breakeven (Short)</p>
              <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                ${beResult.breakeven_short.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      );
    } else if (mode === 'margin') {
      const marginResult = result as MarginResponse;
      return (
        <div className="mt-6 p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-orange-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
            Margin Requirements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Required Margin</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                ${marginResult.required_margin.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Position Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${marginResult.position_value.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Leverage</p>
              <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {marginResult.leverage.toFixed(2)}:1
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Margin %</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {marginResult.margin_percentage.toFixed(2)}%
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Buying Power</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                ${marginResult.buying_power.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      );
    } else if (mode === 'forexLotSize') {
      const forexResult = result as ForexLotSizeResponse;
      return (
        <div className="mt-6 p-6 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-cyan-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-cyan-600 dark:text-cyan-400" />
            Forex Lot Size
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Standard Lots</p>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {forexResult.standard_lots.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Mini Lots</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {forexResult.mini_lots.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Micro Lots</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {forexResult.micro_lots.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Units</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {forexResult.units.toFixed(0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Risk Amount</p>
              <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                ${forexResult.risk_amount.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Stop Loss (pips)</p>
              <p className="text-xl font-semibold text-orange-600 dark:text-orange-400">
                {forexResult.stop_loss_pips.toFixed(1)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Pip Value</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                ${forexResult.pip_value.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Position Value</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                ${forexResult.position_value.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('calculator:title')}</h1>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('calculator:modeTitle')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <button
              onClick={() => setMode('fixed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'fixed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('calculator:modes.fixed')}
            </button>
            <button
              onClick={() => setMode('percentage')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'percentage'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('calculator:modes.percentage')}
            </button>
            <button
              onClick={() => setMode('riskReward')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'riskReward'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('calculator:modes.riskReward')}
            </button>
            <button
              onClick={() => setMode('breakeven')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'breakeven'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('calculator:modes.breakeven')}
            </button>
            <button
              onClick={() => setMode('margin')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'margin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('calculator:modes.margin')}
            </button>
            <button
              onClick={() => setMode('forexLotSize')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'forexLotSize'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('calculator:modes.forexLotSize')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {mode === 'percentage' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.accountBalance')}
                </label>
                <input
                  type="number"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.riskPercentage')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercentage}
                  onChange={(e) => setRiskPercentage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="1.0"
                />
              </div>
            </>
          )}

          {mode === 'fixed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('calculator:fields.riskAmount')}
              </label>
              <input
                type="number"
                value={riskAmount}
                onChange={(e) => setRiskAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="500"
              />
            </div>
          )}

          {(mode === 'riskReward' || mode === 'breakeven' || mode === 'margin') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('calculator:fields.positionSize')}
              </label>
              <input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="2"
              />
            </div>
          )}

          {mode === 'forexLotSize' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.accountBalance')}
                </label>
                <input
                  type="number"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="10000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.riskPercentage')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercentage}
                  onChange={(e) => setRiskPercentage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="1.0"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calculator:fields.entryPrice')}
            </label>
            <input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={mode === 'forexLotSize' ? '1.1850' : '4500.00'}
            />
          </div>

          {mode !== 'breakeven' && mode !== 'margin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('calculator:fields.stopLossPrice')}
              </label>
              <input
                type="number"
                step="0.01"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder={mode === 'forexLotSize' ? '1.1830' : '4490.00'}
              />
            </div>
          )}

          {mode === 'margin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.leverage')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.instrumentType')}
                </label>
                <select
                  value={instrumentType}
                  onChange={(e) => setInstrumentType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="futures">{t('calculator:instrumentTypes.futures')}</option>
                  <option value="forex">{t('calculator:instrumentTypes.forex')}</option>
                  <option value="stocks">{t('calculator:instrumentTypes.stocks')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.contractSize')}
                </label>
                <input
                  type="number"
                  value={contractSize}
                  onChange={(e) => setContractSize(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="50"
                />
              </div>
            </>
          )}

          {mode === 'forexLotSize' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.pipValue')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={pipValue}
                  onChange={(e) => setPipValue(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.accountCurrency')}
                </label>
                <select
                  value={accountCurrency}
                  onChange={(e) => setAccountCurrency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calculator:fields.pairQuoteCurrency')}
                </label>
                <select
                  value={pairQuoteCurrency}
                  onChange={(e) => setPairQuoteCurrency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
            </>
          )}

          {mode === 'riskReward' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('calculator:fields.takeProfitPrice')}
              </label>
              <input
                type="number"
                step="0.01"
                value={takeProfitPrice}
                onChange={(e) => setTakeProfitPrice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="4530.00"
              />
            </div>
          )}

          {mode === 'breakeven' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('calculator:fields.commissionPerContract')}
              </label>
              <input
                type="number"
                step="0.01"
                value={commissionPerContract}
                onChange={(e) => setCommissionPerContract(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="2.50"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calculator:fields.tickValue')}
            </label>
            <input
              type="number"
              step="0.01"
              value={tickValue}
              onChange={(e) => setTickValue(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="12.50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calculator:fields.tickSize')}
            </label>
            <input
              type="number"
              step="0.01"
              value={tickSize}
              onChange={(e) => setTickSize(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="0.25"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {t('calculator:buttons.calculating')}
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5 mr-2" />
              {t('calculator:buttons.calculate')}
            </>
          )}
        </button>

        {renderResults()}
      </div>
    </div>
  );
};

export default PositionCalculator;
