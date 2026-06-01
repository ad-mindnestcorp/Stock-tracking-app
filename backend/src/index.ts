import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";

import aiRouter from "./routes/ai";
import alertsRouter from "./routes/alerts";
import marketRouter from "./routes/market";
import newsRouter from "./routes/news";
import pushTokenRouter from "./routes/push-token";
import stocksRouter from "./routes/stocks";
import watchlistsRouter from "./routes/watchlists";
import { POPULAR_SYMBOLS, getCompanyProfile } from "./services/finnhub.service";
import { getUnusualVolumeStocks } from "./services/polygon.service";
import { startScheduler } from "./services/scheduler.service";
import {
    addClientSubscription,
    initFinnhubWebSocket,
    removeClient,
    removeClientSubscription,
} from "./services/websocket.service";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

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
  Promise.allSettled(POPULAR_SYMBOLS.map((s) => getCompanyProfile(s)))
    .then(() => {
      console.log("[startup] Company profile cache pre-warmed");
      return getUnusualVolumeStocks();
    })
    .then(() => {
      console.log("[startup] Unusual volume cache pre-warmed");
    });
});
