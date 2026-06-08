import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tradesService } from '../services/trades';
import { useDebounce } from './useDebounce';
import {
  MONTE_CARLO_DEFAULTS,
  adjustStatsForExposure,
  buildDeterministicCurves,
  buildMilestones,
  computeDailyStats,
  computeTargetRiskUnits,
  type AdjustedMonteCarloStats,
  type DailyAggregateInput,
  type DeterministicCurves,
  type MonteCarloDailyStats,
  type MonteCarloMilestone,
  type MonteCarloSimulationResult,
} from '../utils/monteCarloSimulation';

const WORKER_PATH = `${process.env.PUBLIC_URL || ''}/workers/dashboardCalculations.worker.js`;

export interface MonteCarloExposureInputs {
  medianRiskUnits: number | null;
  avgRiskUnits: number | null;
  tradesWithRiskUnits: number;
  skippedUnknownContract: number;
}

export interface UseMonteCarloProjectionParams {
  accountId: number | null | undefined;
  currentBalance: number;
  targetBalance: number | null;
  enabled: boolean;
  sizingEnabled: boolean;
  targetLots: number | null;
  targetPointValue: number | null;
}

export type MonteCarloWarning =
  | 'negativeMu'
  | 'insufficientData'
  | 'insufficientExposureData'
  | null;

export interface UseMonteCarloProjectionResult {
  rawDailyStats: MonteCarloDailyStats | null;
  dailyStats: AdjustedMonteCarloStats | null;
  exposureInputs: MonteCarloExposureInputs | null;
  exposureRatio: number;
  isExposureAdjusted: boolean;
  simulation: MonteCarloSimulationResult | null;
  curves: DeterministicCurves | null;
  milestones: MonteCarloMilestone[];
  isLoadingData: boolean;
  isSimulating: boolean;
  dataError: string | null;
  warning: MonteCarloWarning;
  validationError: 'targetTooLow' | null;
}

export function useMonteCarloProjection({
  accountId,
  currentBalance,
  targetBalance,
  enabled,
  sizingEnabled,
  targetLots,
  targetPointValue,
}: UseMonteCarloProjectionParams): UseMonteCarloProjectionResult {
  const [dailyAggregates, setDailyAggregates] = useState<DailyAggregateInput[]>([]);
  const [exposureInputs, setExposureInputs] = useState<MonteCarloExposureInputs | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<MonteCarloSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const generationRef = useRef(0);
  const dataCacheRef = useRef<{
    accountId: number;
    dailyAggregates: DailyAggregateInput[];
    exposure: MonteCarloExposureInputs;
  } | null>(null);

  const debouncedTarget = useDebounce(targetBalance, 300);
  const debouncedLots = useDebounce(targetLots, 300);
  const debouncedPointValue = useDebounce(targetPointValue, 300);

  const rawDailyStats = useMemo(() => {
    if (!dailyAggregates.length) return null;
    return computeDailyStats(dailyAggregates);
  }, [dailyAggregates]);

  const dailyStats = useMemo((): AdjustedMonteCarloStats | null => {
    if (!rawDailyStats) return null;

    if (
      !sizingEnabled ||
      debouncedLots == null ||
      debouncedPointValue == null ||
      debouncedLots <= 0 ||
      debouncedPointValue <= 0
    ) {
      return { ...rawDailyStats, exposureRatio: 1, isAdjusted: false };
    }

    const targetRiskUnits = computeTargetRiskUnits(debouncedLots, debouncedPointValue);
    const median = exposureInputs?.medianRiskUnits;
    if (median == null || median <= 0) {
      return { ...rawDailyStats, exposureRatio: 1, isAdjusted: false };
    }

    return adjustStatsForExposure(rawDailyStats, targetRiskUnits, median);
  }, [rawDailyStats, sizingEnabled, debouncedLots, debouncedPointValue, exposureInputs]);

  const validationError = useMemo((): 'targetTooLow' | null => {
    if (debouncedTarget == null || !Number.isFinite(debouncedTarget)) return null;
    if (debouncedTarget <= currentBalance) return 'targetTooLow';
    return null;
  }, [debouncedTarget, currentBalance]);

  const warning = useMemo((): MonteCarloWarning => {
    if (!rawDailyStats) return null;
    if (rawDailyStats.tradingDayCount < MONTE_CARLO_DEFAULTS.MIN_TRADING_DAYS) {
      return 'insufficientData';
    }
    if (rawDailyStats.mu <= 0) return 'negativeMu';

    if (
      sizingEnabled &&
      debouncedLots != null &&
      debouncedPointValue != null &&
      debouncedLots > 0 &&
      debouncedPointValue > 0
    ) {
      const tradesWithUnits = exposureInputs?.tradesWithRiskUnits ?? 0;
      const median = exposureInputs?.medianRiskUnits;
      if (
        tradesWithUnits < MONTE_CARLO_DEFAULTS.MIN_TRADES_FOR_EXPOSURE ||
        median == null ||
        median <= 0
      ) {
        return 'insufficientExposureData';
      }
    }

    if (dailyStats && dailyStats.mu <= 0) return 'negativeMu';
    return null;
  }, [
    rawDailyStats,
    dailyStats,
    sizingEnabled,
    debouncedLots,
    debouncedPointValue,
    exposureInputs,
  ]);

  const curves = useMemo((): DeterministicCurves | null => {
    if (
      debouncedTarget == null ||
      validationError ||
      warning ||
      !dailyStats ||
      dailyStats.mu <= 0
    ) {
      return null;
    }
    return buildDeterministicCurves({
      currentBalance,
      targetBalance: debouncedTarget,
      mu: dailyStats.mu,
      sigma: dailyStats.sigma,
    });
  }, [currentBalance, debouncedTarget, dailyStats, validationError, warning]);

  const milestones = useMemo((): MonteCarloMilestone[] => {
    if (
      debouncedTarget == null ||
      validationError ||
      warning ||
      !dailyStats ||
      dailyStats.mu <= 0
    ) {
      return [];
    }
    return buildMilestones({
      currentBalance,
      targetBalance: debouncedTarget,
      mu: dailyStats.mu,
      tradingDaysPerWeek: dailyStats.tradingDaysPerWeek,
    });
  }, [currentBalance, debouncedTarget, dailyStats, validationError, warning]);

  useEffect(() => {
    workerRef.current = new Worker(WORKER_PATH);
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const loadProjectionData = useCallback(async (id: number) => {
    if (dataCacheRef.current?.accountId === id) {
      setDailyAggregates(dataCacheRef.current.dailyAggregates);
      setExposureInputs(dataCacheRef.current.exposure);
      return;
    }

    setIsLoadingData(true);
    setDataError(null);
    try {
      const [aggregatesResponse, inputsResponse] = await Promise.all([
        tradesService.dailyAggregates({ trading_account: id }),
        tradesService.monteCarloInputs(id),
      ]);

      const dailyData = aggregatesResponse.results.map((row) => ({
        date: row.date,
        pnl: row.pnl,
      }));

      const exposure: MonteCarloExposureInputs = {
        medianRiskUnits: inputsResponse.median_risk_units,
        avgRiskUnits: inputsResponse.avg_risk_units,
        tradesWithRiskUnits: inputsResponse.trades_with_risk_units,
        skippedUnknownContract: inputsResponse.skipped_unknown_contract,
      };

      dataCacheRef.current = { accountId: id, dailyAggregates: dailyData, exposure };
      setDailyAggregates(dailyData);
      setExposureInputs(exposure);
    } catch {
      setDataError('loadFailed');
      setDailyAggregates([]);
      setExposureInputs(null);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || accountId == null) {
      return;
    }
    void loadProjectionData(accountId);
  }, [enabled, accountId, loadProjectionData]);

  useEffect(() => {
    if (
      !enabled ||
      !workerRef.current ||
      debouncedTarget == null ||
      validationError ||
      warning ||
      !dailyStats ||
      dailyStats.mu <= 0
    ) {
      setSimulation(null);
      setIsSimulating(false);
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setIsSimulating(true);

    const worker = workerRef.current;

    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (payload?.type !== 'MONTE_CARLO_RESULT') return;
      if (payload.result?.generation !== generation) return;
      setSimulation({
        successRate: payload.result.successRate,
        p25: payload.result.p25,
        median: payload.result.median,
        p75: payload.result.p75,
        p90: payload.result.p90,
        successfulRuns: payload.result.successfulRuns,
        totalSimulations: payload.result.totalSimulations,
      });
      setIsSimulating(false);
      worker.removeEventListener('message', handleMessage);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      type: 'CALCULATE_MONTE_CARLO',
      data: {
        currentBalance,
        targetBalance: debouncedTarget,
        mu: dailyStats.mu,
        sigma: dailyStats.sigma,
        nSims: MONTE_CARLO_DEFAULTS.N_SIMULATIONS,
        maxDays: MONTE_CARLO_DEFAULTS.MAX_DAYS,
        generation,
      },
    });

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [
    enabled,
    currentBalance,
    debouncedTarget,
    dailyStats,
    validationError,
    warning,
  ]);

  return {
    rawDailyStats,
    dailyStats,
    exposureInputs,
    exposureRatio: dailyStats?.exposureRatio ?? 1,
    isExposureAdjusted: dailyStats?.isAdjusted ?? false,
    simulation,
    curves,
    milestones,
    isLoadingData,
    isSimulating,
    dataError,
    warning,
    validationError,
  };
}
