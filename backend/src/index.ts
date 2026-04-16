import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import stocksRouter from './routes/stocks';
import alertsRouter from './routes/alerts';
import marketRouter from './routes/market';
import pushTokenRouter from './routes/push-token';
import { startScheduler } from './services/scheduler.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/stocks', stocksRouter);
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
});
