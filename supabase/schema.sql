-- Stockvest MVP Schema
-- Run this in the Supabase SQL editor

-- user_stocks: tracks which stocks each user is monitoring
CREATE TABLE IF NOT EXISTS user_stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  company_name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- alerts_log: triggered alert history
CREATE TABLE IF NOT EXISTS alerts_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('52w_high', '52w_low', 'rsi_overbought', 'rsi_oversold')),
  message TEXT NOT NULL,
  price DECIMAL(12, 4),
  rsi DECIMAL(6, 2),
  week52_high DECIMAL(12, 4),
  week52_low DECIMAL(12, 4),
  is_read BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- push_tokens: expo push notification tokens per user
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_stocks_user_id ON user_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_log_user_id ON alerts_log(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_log_symbol ON alerts_log(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_log_triggered_at ON alerts_log(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
