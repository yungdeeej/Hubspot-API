import { query } from '../db.js';
import { syncEnrollment } from '../services/syncOrchestrator.js';
import { enqueue } from '../queue.js';
import { logger } from '../logger.js';

const PERMANENT_PHRASES = [
  'invalid email',
  'already exists',
  'duplicate'
];

function isPermanent(errorMessage) {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return PERMANENT_PHRASES.some((phrase) => lower.includes(phrase));
}

export async function runRetryFailed() {
  const { rows } = await query(`
    SELECT id, hubspot_deal_id, error_message, retry_count
    FROM enrollments
    WHERE status = 'failed'
      AND retry_count < 5
      AND updated_at < NOW() - INTERVAL '15 minutes'
    ORDER BY updated_at ASC
    LIMIT 50
  `);

  let scheduled = 0;
  for (const row of rows) {
    if (isPermanent(row.error_message)) continue;
    enqueue(`retry-cron:${row.hubspot_deal_id}`, () =>
      syncEnrollment(row.hubspot_deal_id, 'retry')
    ).catch((err) => logger.error({ err: err.message, dealId: row.hubspot_deal_id }, 'retry failed'));
    scheduled++;
  }

  logger.info({ candidates: rows.length, scheduled }, 'retryFailed job run');
  return { candidates: rows.length, scheduled };
}
