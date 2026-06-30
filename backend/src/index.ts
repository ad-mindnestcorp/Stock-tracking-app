import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { log, errorMessage } from "./utils/logger";

import aiRouter from "./routes/ai";
import alertsRouter from "./routes/alerts";
import marketRouter from "./routes/market";
import newsRouter from "./routes/news";
import pushTokenRouter from "./routes/push-token";
import stocksRouter from "./routes/stocks";
import watchlistsRouter from "./routes/watchlists";
import { startScheduler } from "./services/scheduler.service";
import { initMarketCache } from "./services/market-cache.service";
import {
    addClientSubscription,
    initFinnhubWebSocket,
    removeClient,
    removeClientSubscription,
    subscribeSymbols,
} from "./services/websocket.service";
import { supabase } from "./lib/supabase";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Applied per-path before route mounts so each path gets its own window.
// AI endpoints are tightest (expensive OpenAI calls); market is moderate;
// general API (stocks/watchlists/alerts) gets a generous ceiling.
app.use(
  '/api/ai',
  rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many AI requests — please wait a minute and try again.' } })
);
app.use(
  '/api/market',
  rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many market data requests — please wait a minute and try again.' } })
);
app.use(
  '/api',
  rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many requests — please wait a minute and try again.' } })
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    log({
      level,
      tag: "[http]",
      message: `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      context: {
        userId: req.headers["x-user-id"] as string | undefined,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
      },
    });
  });
  next();
});

app.use("/api/stocks", stocksRouter);
app.use("/api/watchlists", watchlistsRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/market", marketRouter);
app.use("/api/news", newsRouter);
app.use("/api/push-token", pushTokenRouter);
app.use("/api/ai", aiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  log({
    level: "error",
    tag: "[unhandled]",
    message: errorMessage(err),
    context: { stack: err instanceof Error ? err.stack : undefined },
  });
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = createServer(app);

// Only allow safe symbol characters (letters, digits, colon, dot, dash, caret)
const SYMBOL_RE = /^[A-Z0-9:.\-^]{1,20}$/;

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as {
        type?: string;
        symbols?: unknown;
      };
      if (!Array.isArray(msg.symbols)) return;

      const symbols = (msg.symbols as unknown[])
        .filter((s): s is string => typeof s === "string" && SYMBOL_RE.test(s))
        .slice(0, 100);

      if (msg.type === "subscribe") {
        addClientSubscription(ws, symbols);
      } else if (msg.type === "unsubscribe") {
        removeClientSubscription(ws, symbols);
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => removeClient(ws));
  ws.on("error", () => ws.terminate());
});

httpServer.listen(PORT, () => {
  console.log(`Stockvest backend running on http://localhost:${PORT}`);
  initFinnhubWebSocket();
  startScheduler();
  initMarketCache();
  (async () => {
    try {
      const { data } = await supabase.from('watchlist_stocks').select('symbol');
      if (data && data.length > 0) {
        const symbols = [...new Set(data.map((r: { symbol: string }) => r.symbol))];
        subscribeSymbols(symbols);
        log({ level: 'info', tag: '[startup]', message: `Pre-subscribed ${symbols.length} watchlist symbols to WS` });
      }
    } catch (err) {
      log({ level: 'warn', tag: '[startup]', message: 'Failed to pre-subscribe watchlist symbols', context: { error: errorMessage(err) } });
    }
  })();
});
