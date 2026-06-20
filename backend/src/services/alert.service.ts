import { supabase } from '../lib/supabase';
import { sendPushNotifications } from '../lib/expo-push';
import { getQuote, getWeek52Data } from './finnhub.service';
import { calculateRSI } from './rsi.service';

type AlertType = '52w_high' | '52w_low' | 'rsi_overbought' | 'rsi_oversold';

const ALERT_COOLDOWN_HOURS = 24;

/**
 * Fetch all alert types already sent for this (userId, symbol) pair in the
 * last 24 hours — one DB query instead of one query per alert type.
 */
async function getRecentAlertTypes(
  userId: string,
  symbol: string,
): Promise<Set<AlertType>> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('alerts_log')
    .select('alert_type')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .gte('triggered_at', cutoff);

  if (error) {
    console.error('Recent alert check error:', error);
    return new Set();
  }
  return new Set((data ?? []).map(r => r.alert_type as AlertType));
}

/** Persist an alert and send push notification */
async function fireAlert(
  userId: string,
  symbol: string,
  alertType: AlertType,
  message: string,
  price: number,
  rsi?: number,
  week52High?: number,
  week52Low?: number
): Promise<void> {
  // Store in DB
  const { error } = await supabase.from('alerts_log').insert({
    user_id: userId,
    symbol,
    alert_type: alertType,
    message,
    price,
    rsi: rsi ?? null,
    week52_high: week52High ?? null,
    week52_low: week52Low ?? null,
  });

  if (error) {
    console.error(`Failed to insert alert for ${symbol}:`, error);
    return;
  }

  // Fetch user's push tokens
  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (tokenRows && tokenRows.length > 0) {
    const tokens = tokenRows.map((r) => r.token);
    await sendPushNotifications(tokens, {
      title: `${symbol} Alert`,
      body: message,
      data: { symbol, alertType, price },
    });
  }
}

/** Run all alert checks for a single (userId, symbol) pair */
export async function checkAlertsForStock(userId: string, symbol: string): Promise<void> {
  try {
    const [quote, week52] = await Promise.all([
      getQuote(symbol),
      getWeek52Data(symbol),
    ]);

    if (!quote || !week52) {
      console.warn(`No data available for ${symbol}`);
      return;
    }

    const { currentPrice } = quote;
    const { high52w, low52w, closes } = week52;
    const rsiResult = calculateRSI(closes);

    // Single DB query for all alert types sent in the last 24h for this stock
    const recentAlerts = await getRecentAlertTypes(userId, symbol);

    const THRESHOLD = 0.005; // within 0.5% of 52w high/low counts as hit

    if (currentPrice >= high52w * (1 - THRESHOLD) && !recentAlerts.has('52w_high')) {
      await fireAlert(
        userId, symbol, '52w_high',
        `${symbol} is trading near its 52-week high of $${high52w.toFixed(2)}. Current: $${currentPrice.toFixed(2)}`,
        currentPrice, undefined, high52w, low52w,
      );
    }

    if (currentPrice <= low52w * (1 + THRESHOLD) && !recentAlerts.has('52w_low')) {
      await fireAlert(
        userId, symbol, '52w_low',
        `${symbol} is trading near its 52-week low of $${low52w.toFixed(2)}. Current: $${currentPrice.toFixed(2)}`,
        currentPrice, undefined, high52w, low52w,
      );
    }

    if (rsiResult?.isOverbought && !recentAlerts.has('rsi_overbought')) {
      await fireAlert(
        userId, symbol, 'rsi_overbought',
        `${symbol} RSI is ${rsiResult.rsi} — overbought signal (>70). Consider taking profits.`,
        currentPrice, rsiResult.rsi, high52w, low52w,
      );
    }

    if (rsiResult?.isOversold && !recentAlerts.has('rsi_oversold')) {
      await fireAlert(
        userId, symbol, 'rsi_oversold',
        `${symbol} RSI is ${rsiResult.rsi} — oversold signal (<30). Potential buying opportunity.`,
        currentPrice, rsiResult.rsi, high52w, low52w,
      );
    }
  } catch (err) {
    console.error(`Alert check failed for ${symbol} (user ${userId}):`, err);
  }
}

/** Fetch all user-stock pairs and run checks — called by the scheduler */
export async function runAllAlertChecks(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running alert checks...`);

  const { data: stocks, error } = await supabase
    .from('user_stocks')
    .select('user_id, symbol');

  if (error) {
    console.error('Failed to fetch user_stocks:', error);
    return;
  }

  if (!stocks || stocks.length === 0) {
    console.log('No stocks being monitored.');
    return;
  }

  // Process sequentially to respect Finnhub rate limits (2 calls per stock)
  for (const { user_id, symbol } of stocks) {
    await checkAlertsForStock(user_id, symbol);
    await new Promise((r) => setTimeout(r, 300)); // 300ms gap between stocks
  }

  console.log(`[${new Date().toISOString()}] Alert check complete. Processed ${stocks.length} stock(s).`);
}
