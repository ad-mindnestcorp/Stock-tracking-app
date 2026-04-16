import { supabase } from '../lib/supabase';
import { sendPushNotifications } from '../lib/expo-push';
import { getQuote, getWeek52Data } from './finnhub.service';
import { calculateRSI } from './rsi.service';

type AlertType = '52w_high' | '52w_low' | 'rsi_overbought' | 'rsi_oversold';

const ALERT_COOLDOWN_HOURS = 24;

/** Check if an alert of this type was already sent for this stock today */
async function isDuplicate(
  userId: string,
  symbol: string,
  alertType: AlertType
): Promise<boolean> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('alerts_log')
    .select('id')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .eq('alert_type', alertType)
    .gte('triggered_at', cutoff)
    .limit(1);

  if (error) {
    console.error('Duplicate check error:', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
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

    // 52-week high alert
    const THRESHOLD = 0.005; // within 0.5% of 52w high/low counts as hit
    if (currentPrice >= high52w * (1 - THRESHOLD)) {
      const isDup = await isDuplicate(userId, symbol, '52w_high');
      if (!isDup) {
        await fireAlert(
          userId,
          symbol,
          '52w_high',
          `${symbol} is trading near its 52-week high of $${high52w.toFixed(2)}. Current: $${currentPrice.toFixed(2)}`,
          currentPrice,
          undefined,
          high52w,
          low52w
        );
      }
    }

    // 52-week low alert
    if (currentPrice <= low52w * (1 + THRESHOLD)) {
      const isDup = await isDuplicate(userId, symbol, '52w_low');
      if (!isDup) {
        await fireAlert(
          userId,
          symbol,
          '52w_low',
          `${symbol} is trading near its 52-week low of $${low52w.toFixed(2)}. Current: $${currentPrice.toFixed(2)}`,
          currentPrice,
          undefined,
          high52w,
          low52w
        );
      }
    }

    // RSI alerts
    if (rsiResult) {
      if (rsiResult.isOverbought) {
        const isDup = await isDuplicate(userId, symbol, 'rsi_overbought');
        if (!isDup) {
          await fireAlert(
            userId,
            symbol,
            'rsi_overbought',
            `${symbol} RSI is ${rsiResult.rsi} — overbought signal (>70). Consider taking profits.`,
            currentPrice,
            rsiResult.rsi,
            high52w,
            low52w
          );
        }
      }

      if (rsiResult.isOversold) {
        const isDup = await isDuplicate(userId, symbol, 'rsi_oversold');
        if (!isDup) {
          await fireAlert(
            userId,
            symbol,
            'rsi_oversold',
            `${symbol} RSI is ${rsiResult.rsi} — oversold signal (<30). Potential buying opportunity.`,
            currentPrice,
            rsiResult.rsi,
            high52w,
            low52w
          );
        }
      }
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
