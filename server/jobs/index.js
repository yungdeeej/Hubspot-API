import cron from 'node-cron';
import { runRetryFailed } from './retryFailed.js';
import { runDailyDigest } from './dailyDigest.js';
import { logger } from '../logger.js';

export function startCronJobs() {
  // Hourly retry
  cron.schedule('0 * * * *', async () => {
    try { await runRetryFailed(); } catch (err) { logger.error({ err: err.message }, 'retryFailed cron failed'); }
  });

  // Daily digest at 08:00 Pacific
  cron.schedule('0 8 * * *', async () => {
    try { await runDailyDigest(); } catch (err) { logger.error({ err: err.message }, 'dailyDigest cron failed'); }
  }, { timezone: 'America/Los_Angeles' });

  logger.info('Cron jobs scheduled: retryFailed hourly, dailyDigest 08:00 America/Los_Angeles');
}
