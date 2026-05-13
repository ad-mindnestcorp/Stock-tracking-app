-- Stockvest MVP Schema
-- Run this in the Supabase SQL editor

-- ─────────────────────────────────────────────
-- Enable Row Level Security helper
-- ─────────────────────────────────────────────

-- user_stocks: tracks which stocks each user is monitoring
CREATE TABLE IF NOT EXISTS user_stocks (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT        NOT NULL,
  company_name TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- alerts_log: triggered alert history
CREATE TABLE IF NOT EXISTS alerts_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT        NOT NULL,
  alert_type   TEXT        NOT NULL CHECK (alert_type IN ('52w_high', '52w_low', 'rsi_overbought', 'rsi_oversold')),
  message      TEXT        NOT NULL,
  price        DECIMAL(12, 4),
  rsi          DECIMAL(6, 2),
  week52_high  DECIMAL(12, 4),
  week52_low   DECIMAL(12, 4),
  is_read      BOOLEAN     DEFAULT FALSE,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- push_tokens: expo push notification tokens per user
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- ─────────────────────────────────────────────
-- Indexes for performance
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_stocks_user_id    ON user_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_log_user_id     ON alerts_log(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_log_symbol      ON alerts_log(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_log_triggered_at ON alerts_log(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id    ON push_tokens(user_id);

-- ─────────────────────────────────────────────
-- Row Level Security (RLS)
-- Users can only read/write their own rows.
-- The service-role key used by the backend bypasses RLS automatically.
-- ─────────────────────────────────────────────

ALTER TABLE user_stocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens  ENABLE ROW LEVEL SECURITY;

-- user_stocks policies
CREATE POLICY "user_stocks: select own"  ON user_stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_stocks: insert own"  ON user_stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_stocks: delete own"  ON user_stocks FOR DELETE USING (auth.uid() = user_id);

-- alerts_log policies
CREATE POLICY "alerts_log: select own"   ON alerts_log  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alerts_log: insert own"   ON alerts_log  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alerts_log: update own"   ON alerts_log  FOR UPDATE USING (auth.uid() = user_id);

-- push_tokens policies
CREATE POLICY "push_tokens: select own"  ON push_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_tokens: insert own"  ON push_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_tokens: delete own"  ON push_tokens FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Multi-watchlist support
-- ─────────────────────────────────────────────

-- watchlists: named collections of stocks per user
CREATE TABLE IF NOT EXISTS watchlists (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- watchlist_stocks: junction table — a symbol can belong to multiple watchlists
CREATE TABLE IF NOT EXISTS watchlist_stocks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  watchlist_id  UUID        NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol        TEXT        NOT NULL,
  company_name  TEXT,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id         ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_watchlist  ON watchlist_stocks(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_user_id   ON watchlist_stocks(user_id);

ALTER TABLE watchlists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlists: select own"  ON watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlists: insert own"  ON watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlists: update own"  ON watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watchlists: delete own"  ON watchlists FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "watchlist_stocks: select own"  ON watchlist_stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_stocks: insert own"  ON watchlist_stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_stocks: delete own"  ON watchlist_stocks FOR DELETE USING (auth.uid() = user_id);
