import { useEffect, useRef, useState, useCallback } from 'react';

interface WorkerMessage {
  type: string;
  data?: any;
}

interface WorkerResponse {
  type: string;
  result?: any;
  error?: string;
}

export function useWebWorker<T>(workerPath: string) {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(workerPath);

    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [workerPath]);

  const postMessage = useCallback((message: WorkerMessage): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      setIsProcessing(true);
      setError(null);

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        setIsProcessing(false);
        
        if (event.data.error) {
          setError(event.data.error);
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result as T);
        }

        // Remove listener after receiving response
        workerRef.current?.removeEventListener('message', handleMessage);
      };

      const handleError = (error: ErrorEvent) => {
        setIsProcessing(false);
        setError(error.message);
        reject(error);
        workerRef.current?.removeEventListener('error', handleError);
      };

      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.addEventListener('error', handleError);
      workerRef.current.postMessage(message);
    });
  }, []);

  return { postMessage, isProcessing, error };
}
