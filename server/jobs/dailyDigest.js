import { query } from '../db.js';
import * as slack from '../services/slackNotifier.js';
import { logger } from '../logger.js';

export async function runDailyDigest() {
  const { rows } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'success')::int AS synced,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'manual_review')::int AS manual_review,
      COUNT(*) FILTER (WHERE status = 'duplicate')::int AS duplicates
    FROM enrollments
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `);
  const s = rows[0];
  const message = `Last 24h: ${s.synced} synced · ${s.failed} failed · ${s.manual_review} in manual review · ${s.duplicates} duplicates`;
  await slack.alert(message);
  logger.info(s, 'dailyDigest job run');
  return s;
}
