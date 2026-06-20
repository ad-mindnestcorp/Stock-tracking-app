import cron from "node-cron";
import { runAllAlertChecks } from "./alert.service";
import { enrichStocks } from "./enrich-stocks.service";
import { supabase } from "../lib/supabase";
import { log, errorMessage } from "../utils/logger";

let isRunning = false;
let isWarming = false;

/**
 * Pre-warm the in-memory Finnhub cache for every unique symbol across all users'
 * watchlists. Runs every 60 s during market hours so that user requests always
 * hit the cache rather than firing individual Finnhub calls on demand.
 *
 * enrichStocks already batches quotes (10 at a time, 150 ms gap) and the
 * finnhub.service cache deduplicates any in-flight requests, so this is
 * safe to run concurrently with normal user traffic.
 */
async function warmWatchlistCache(): Promise<void> {
  if (isWarming) return;
  isWarming = true;
  try {
    const { data, error } = await supabase
      .from("watchlist_stocks")
      .select("symbol, company_name");

    if (error || !data || data.length === 0) return;

    // Deduplicate symbols across all users
    const seen = new Set<string>();
    const unique = data.filter((s) => {
      if (seen.has(s.symbol)) return false;
      seen.add(s.symbol);
      return true;
    });

    await enrichStocks(unique);
    log({ level: "info", tag: "[scheduler]", message: `Watchlist cache warmed — ${unique.length} unique symbols` });
  } catch (err) {
    log({ level: "warn", tag: "[scheduler]", message: "warmWatchlistCache failed", context: { error: errorMessage(err) } });
  } finally {
    isWarming = false;
  }
}

/** Start the cron scheduler — runs every 5 minutes during market hours */
export function startScheduler(): void {
  // Every 5 minutes, Mon–Fri, 13:00–21:00 UTC (9:00 AM–5:00 PM ET).
  // Covers regular market hours (9:30–16:00 ET) plus a small pre/post buffer.
  // Previously ran 24/7 on weekdays, wasting Finnhub quota overnight.
  cron.schedule("*/5 13-21 * * 1-5", async () => {
    if (isRunning) {
      console.log("Previous check still running, skipping...");
      return;
    }
    isRunning = true;
    try {
      await runAllAlertChecks();
    } finally {
      isRunning = false;
    }
  });

  // Pre-warm watchlist quote cache every 60 s during market hours.
  // Quote TTL is 60 s, so this keeps the cache perpetually fresh — any user
  // who opens their watchlist will get a cache hit instead of a live Finnhub call.
  cron.schedule("* 13-21 * * 1-5", () => {
    warmWatchlistCache();
  });

  console.log("Scheduler started — alert checks every 5 minutes, watchlist cache warm every minute (weekdays)");
}

/** Manually trigger a check immediately (useful for testing) */
export async function triggerNow(): Promise<void> {
  if (isRunning) {
    console.log("Check already in progress.");
    return;
  }
  isRunning = true;
  try {
    await runAllAlertChecks();
  } finally {
    isRunning = false;
  }
}
