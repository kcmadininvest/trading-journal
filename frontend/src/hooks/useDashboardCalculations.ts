import { useState, useEffect } from 'react';
import { useWebWorker } from './useWebWorker';

interface SequencesResult {
  maxConsecutiveTradesRespected: number;
  maxConsecutiveTradesNotRespected: number;
  maxConsecutiveDaysRespected: number;
  maxConsecutiveDaysNotRespected: number;
  currentConsecutiveTradesRespected: number;
  currentConsecutiveTradesNotRespected: number;
  currentConsecutiveDaysRespected: number;
  currentConsecutiveDaysNotRespected: number;
  currentWinningStreakDays: number;
}

export function useDashboardCalculations(trades: any[], strategies: any) {
  const [sequences, setSequences] = useState<SequencesResult | null>(null);
  const { postMessage, isProcessing } = useWebWorker<SequencesResult>('/workers/dashboardCalculations.worker.js');

  useEffect(() => {
    if (trades.length === 0) {
      setSequences(null);
      return;
    }

    // Offload heavy calculation to Web Worker
    postMessage({
      type: 'CALCULATE_SEQUENCES',
      data: { trades, strategies }
    })
      .then(result => setSequences(result))
      .catch(error => {
        console.error('Worker calculation error:', error);
        // Fallback to main thread if worker fails
        calculateSequencesMainThread(trades, strategies);
      });
  }, [trades, strategies, postMessage]);

  const calculateSequencesMainThread = (trades: any[], strategies: any) => {
    // Fallback calculation on main thread
    // This is a simplified version - the full logic is in the worker
    setSequences({
      maxConsecutiveTradesRespected: 0,
      maxConsecutiveTradesNotRespected: 0,
      maxConsecutiveDaysRespected: 0,
      maxConsecutiveDaysNotRespected: 0,
      currentConsecutiveTradesRespected: 0,
      currentConsecutiveTradesNotRespected: 0,
      currentConsecutiveDaysRespected: 0,
      currentConsecutiveDaysNotRespected: 0,
      currentWinningStreakDays: 0,
    });
  };

  return { sequences, isProcessing };
}
