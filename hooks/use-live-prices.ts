import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
// Convert http(s):// → ws(s)://
const WS_URL = BASE_URL.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/ws';

export interface LivePrice {
  price: number;
  timestamp: number;
}

/**
 * Opens a WebSocket to the backend price relay and subscribes to the given symbols.
 * Returns a map of symbol → latest trade price.
 *
 * Only price & timestamp are delivered via WS; all other data (RSI, sparklines, etc.)
 * continues to come from the initial REST load.
 */
export function useLivePrices(symbols: string[]): Record<string, LivePrice> {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const symbolsRef = useRef<string[]>(symbols);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  symbolsRef.current = symbols;

  const sendSubscribe = useCallback((syms: string[]) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && syms.length > 0) {
      ws.send(JSON.stringify({ type: 'subscribe', symbols: syms }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const ws = wsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      sendSubscribe(symbolsRef.current);
    };

    socket.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as {
          type: string;
          symbol: string;
          price: number;
          timestamp: number;
        };
        if (msg.type === 'price' && typeof msg.symbol === 'string') {
          setPrices((prev) => ({
            ...prev,
            [msg.symbol]: { price: msg.price, timestamp: msg.timestamp },
          }));
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      wsRef.current = null;
      if (mountedRef.current && symbolsRef.current.length > 0) {
        reconnectTimer.current = setTimeout(connect, 5000);
      }
    };

    socket.onerror = () => socket.close();
  }, [sendSubscribe]);

  // Mount / unmount + AppState (background → close, foreground → reconnect)
  useEffect(() => {
    mountedRef.current = true;
    if (symbolsRef.current.length > 0) connect();

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active' && symbolsRef.current.length > 0) {
        connect();
      } else if (state === 'background') {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        wsRef.current?.close();
        wsRef.current = null;
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-subscribe / connect when the symbol list changes
  useEffect(() => {
    if (symbols.length === 0) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connect();
    } else {
      sendSubscribe(symbols);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  return prices;
}
