import WebSocket from 'ws';

interface FinnhubTradeMsg {
  type: 'trade';
  data: Array<{ p: number; s: string; t: number; v: number }>;
}

// symbol → connected client WebSockets
const subscriptions = new Map<string, Set<WebSocket>>();

// symbol → latest known trade price (for immediate delivery on connect)
const latestPrices = new Map<string, number>();

let finnhubWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function subscribeFinnhub(symbol: string) {
  if (finnhubWs?.readyState === WebSocket.OPEN) {
    finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }));
  }
}

function unsubscribeFinnhub(symbol: string) {
  if (finnhubWs?.readyState === WebSocket.OPEN) {
    finnhubWs.send(JSON.stringify({ type: 'unsubscribe', symbol }));
  }
}

function connectFinnhub() {
  const apiKey = process.env.FINNHUB_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[finnhub-ws] FINNHUB_API_KEY not set — live price WebSocket disabled');
    return;
  }

  finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

  finnhubWs.on('open', () => {
    console.log('[finnhub-ws] Connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Re-subscribe all currently active symbols after reconnect
    for (const symbol of subscriptions.keys()) {
      subscribeFinnhub(symbol);
    }
  });

  finnhubWs.on('message', (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string; data?: FinnhubTradeMsg['data'] };
      if (msg.type !== 'trade' || !msg.data) return;

      for (const trade of msg.data) {
        latestPrices.set(trade.s, trade.p);

        const clients = subscriptions.get(trade.s);
        if (!clients?.size) continue;

        const payload = JSON.stringify({
          type: 'price',
          symbol: trade.s,
          price: trade.p,
          timestamp: trade.t,
        });

        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        }
      }
    } catch {
      // ignore malformed messages
    }
  });

  finnhubWs.on('close', () => {
    console.log('[finnhub-ws] Disconnected — reconnecting in 5 s');
    finnhubWs = null;
    reconnectTimer = setTimeout(connectFinnhub, 5000);
  });

  finnhubWs.on('error', (err) => {
    console.error('[finnhub-ws] Error:', err.message);
    finnhubWs?.terminate();
  });
}

/** Subscribe a client WebSocket to a list of symbols */
export function addClientSubscription(client: WebSocket, symbols: string[]) {
  for (const symbol of symbols) {
    if (!subscriptions.has(symbol)) {
      subscriptions.set(symbol, new Set());
      subscribeFinnhub(symbol);
    }
    subscriptions.get(symbol)!.add(client);

    // Immediately deliver the latest known price if available
    const latest = latestPrices.get(symbol);
    if (latest !== undefined && client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({ type: 'price', symbol, price: latest, timestamp: Date.now() })
      );
    }
  }
}

/** Unsubscribe a client from specific symbols */
export function removeClientSubscription(client: WebSocket, symbols: string[]) {
  for (const symbol of symbols) {
    const clients = subscriptions.get(symbol);
    if (!clients) continue;
    clients.delete(client);
    if (clients.size === 0) {
      subscriptions.delete(symbol);
      unsubscribeFinnhub(symbol);
    }
  }
}

/** Remove a client from all subscriptions (called on WS close) */
export function removeClient(client: WebSocket) {
  for (const [symbol, clients] of subscriptions.entries()) {
    clients.delete(client);
    if (clients.size === 0) {
      subscriptions.delete(symbol);
      unsubscribeFinnhub(symbol);
    }
  }
}

export function initFinnhubWebSocket() {
  connectFinnhub();
}
