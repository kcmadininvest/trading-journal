import { useCallback, useEffect, useRef, useState } from 'react';
import { MarketQuotesSnapshot, marketQuotesService } from '../services/marketQuotes';

const POLL_INTERVAL_MS = 2500;
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;

function buildWebSocketUrl(): string | null {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return null;
  }
  const base = marketQuotesService.getWebSocketBaseUrl();
  return `${base}/ws/market-quotes/?token=${encodeURIComponent(token)}`;
}

export function useMarketQuotes(enabled = true) {
  const [snapshot, setSnapshot] = useState<MarketQuotesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'websocket' | 'polling'>('polling');
  const [wsConnected, setWsConnected] = useState(false);

  const mountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const usePollingFallbackRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await marketQuotesService.getSnapshot();
      if (mountedRef.current) {
        setSnapshot(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  const startPolling = useCallback(() => {
    stopPolling();
    setTransport('polling');
    setWsConnected(false);
    void refresh();
    pollIntervalRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh, stopPolling]);

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    usePollingFallbackRef.current = false;
    reconnectAttemptRef.current = 0;

    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const connect = () => {
      if (!mountedRef.current) return;
      const url = buildWebSocketUrl();
      if (!url) {
        usePollingFallbackRef.current = true;
        startPolling();
        return;
      }

      closeWebSocket();
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          reconnectAttemptRef.current = 0;
          usePollingFallbackRef.current = false;
          stopPolling();
          setTransport('websocket');
          setWsConnected(true);
          setError(null);
          setLoading(false);
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(event.data as string) as MarketQuotesSnapshot;
            setSnapshot(data);
            setError(null);
            setLoading(false);
          } catch {
            setError('invalid_payload');
          }
        };

        ws.onerror = () => {
          if (!mountedRef.current) return;
          usePollingFallbackRef.current = true;
          startPolling();
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          setWsConnected(false);
          usePollingFallbackRef.current = true;
          startPolling();
          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempt, WS_RECONNECT_MAX_MS);
          reconnectAttemptRef.current += 1;
          if (reconnectTimerRef.current !== null) {
            window.clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!usePollingFallbackRef.current) {
              connect();
            } else {
              connect();
            }
          }, delay);
        };
      } catch {
        usePollingFallbackRef.current = true;
        startPolling();
      }
    };

    connect();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          void refresh();
        } else {
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      stopPolling();
      closeWebSocket();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [closeWebSocket, enabled, refresh, startPolling, stopPolling]);

  return { snapshot, loading, error, refresh, transport, wsConnected };
}
