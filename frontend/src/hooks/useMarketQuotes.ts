import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '../services/auth';
import { MarketQuotesSnapshot, marketQuotesService } from '../services/marketQuotes';

const POLL_INTERVAL_MS = 2500;
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;

function buildWebSocketUrl(): string | null {
  const token = authService.getAccessToken();
  if (!token || !authService.isAuthenticated()) {
    return null;
  }
  const base = marketQuotesService.getWebSocketBaseUrl();
  return `${base}/ws/market-quotes/?token=${encodeURIComponent(token)}`;
}

function releaseWebSocket(ws: WebSocket) {
  ws.onmessage = null;
  ws.onerror = null;

  if (ws.readyState === WebSocket.OPEN) {
    ws.onopen = null;
    ws.onclose = null;
    ws.close(1000, 'Client disconnect');
    return;
  }

  if (ws.readyState === WebSocket.CONNECTING) {
    // Ne pas appeler close() pendant CONNECTING : le navigateur loggue une erreur
    // même si la fermeture est volontaire (React Strict Mode, remontage rapide).
    ws.onopen = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Superseded');
      }
    };
    ws.onclose = null;
  }
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
  const connectGenerationRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const closeWebSocket = useCallback(() => {
    connectGenerationRef.current += 1;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      releaseWebSocket(ws);
    }
  }, []);

  const authFailedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !authService.isAuthenticated() || authFailedRef.current) return;
    try {
      const data = await marketQuotesService.getSnapshot();
      if (mountedRef.current) {
        setSnapshot(data);
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error';
      if (message.includes('401')) {
        authFailedRef.current = true;
        stopPolling();
        closeWebSocket();
      }
      if (mountedRef.current) {
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, closeWebSocket, stopPolling]);

  const startPolling = useCallback(() => {
    if (!authService.isAuthenticated() || authFailedRef.current) return;
    stopPolling();
    setTransport('polling');
    setWsConnected(false);
    void refresh();
    pollIntervalRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    authFailedRef.current = false;

    if (!enabled || !authService.isAuthenticated()) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const connect = () => {
      if (!mountedRef.current || authFailedRef.current) return;

      closeWebSocket();
      const generation = connectGenerationRef.current;

      const url = buildWebSocketUrl();
      if (!url) {
        startPolling();
        return;
      }

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (generation !== connectGenerationRef.current || !mountedRef.current) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(1000, 'Superseded');
            }
            return;
          }
          reconnectAttemptRef.current = 0;
          stopPolling();
          setTransport('websocket');
          setWsConnected(true);
          setError(null);
          setLoading(false);
        };

        ws.onmessage = (event) => {
          if (generation !== connectGenerationRef.current || !mountedRef.current) return;
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
          if (generation !== connectGenerationRef.current || !mountedRef.current) return;
          startPolling();
        };

        ws.onclose = () => {
          if (generation !== connectGenerationRef.current || !mountedRef.current) return;
          setWsConnected(false);
          if (authFailedRef.current) return;
          startPolling();

          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempt, WS_RECONNECT_MAX_MS);
          reconnectAttemptRef.current += 1;
          if (reconnectTimerRef.current !== null) {
            window.clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, delay);
        };
      } catch {
        startPolling();
      }
    };

    reconnectAttemptRef.current = 0;
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

    const onTokenRefreshed = () => {
      authFailedRef.current = false;
      connect();
    };

    const onLogout = () => {
      authFailedRef.current = true;
      stopPolling();
      closeWebSocket();
      setSnapshot(null);
      setWsConnected(false);
      setLoading(false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('auth:token-refreshed', onTokenRefreshed);
    window.addEventListener('user:logout', onLogout);

    return () => {
      mountedRef.current = false;
      stopPolling();
      closeWebSocket();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('auth:token-refreshed', onTokenRefreshed);
      window.removeEventListener('user:logout', onLogout);
    };
  }, [closeWebSocket, enabled, refresh, startPolling, stopPolling]);

  return { snapshot, loading, error, refresh, transport, wsConnected };
}
