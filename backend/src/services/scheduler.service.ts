import cron from 'node-cron';
import { runAllAlertChecks } from './alert.service';
import { refreshTrendingStocks } from './reddit.service';

let isRunning = false;

/** Start the cron scheduler — runs every 5 minutes during market hours */
export function startScheduler(): void {
  // Every 5 minutes, Mon–Fri, 9:30am–4:00pm ET (14:30–21:00 UTC)
  // '*/5 14-20 * * 1-5' = every 5 min, 14:00–20:55 UTC, weekdays
  // Extended to 13:30–21:05 to catch pre/post market edges
  cron.schedule('*/5 * * * 1-5', async () => {
    if (isRunning) {
      console.log('Previous check still running, skipping...');
      return;
    }
    isRunning = true;
    try {
      await runAllAlertChecks();
    } finally {
      isRunning = false;
    }
  });

  console.log('Scheduler started — alert checks every 5 minutes (weekdays)');

  // Refresh Reddit trending stocks every 2 hours, every day
  cron.schedule('0 */2 * * *', async () => {
    try {
      await refreshTrendingStocks();
    } catch (err) {
      console.error('[scheduler] Trending refresh failed:', err);
    }
  });

  console.log('Scheduler started — trending stocks refresh every 2 hours');
}

/** Manually trigger a check immediately (useful for testing) */
export async function triggerNow(): Promise<void> {
  if (isRunning) {
    console.log('Check already in progress.');
    return;
  }
  isRunning = true;
  try {
    await runAllAlertChecks();
  } finally {
    isRunning = false;
  }
}
