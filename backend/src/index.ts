import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import stocksRouter from './routes/stocks';
import alertsRouter from './routes/alerts';
import marketRouter from './routes/market';
import pushTokenRouter from './routes/push-token';
import watchlistsRouter from './routes/watchlists';
import { startScheduler } from './services/scheduler.service';
import { POPULAR_SYMBOLS, getCompanyProfile } from './services/finnhub.service';
import { getUnusualVolumeStocks } from './services/polygon.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/stocks', stocksRouter);
app.use('/api/watchlists', watchlistsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/market', marketRouter);
app.use('/api/push-token', pushTokenRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Stockvest backend running on http://localhost:${PORT}`);
  startScheduler();
  Promise.allSettled(POPULAR_SYMBOLS.map((s) => getCompanyProfile(s))).then(() => {
    console.log('[startup] Company profile cache pre-warmed');
    return getUnusualVolumeStocks();
  }).then(() => {
    console.log('[startup] Unusual volume cache pre-warmed');
  });
});
