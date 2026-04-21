import 'dotenv/config';
import { pool } from '../server/db.js';
import * as hubspot from '../server/services/hubspotClient.js';
import { syncEnrollment } from '../server/services/syncOrchestrator.js';
import { enqueue, syncQueue } from '../server/queue.js';

async function main() {
  const sinceArg = process.argv[2];
  const since = sinceArg ? new Date(sinceArg) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  console.log(`Backfilling Closed Won deals since ${since.toISOString()}`);

  const deals = await hubspot.listClosedWonDeals(since);
  console.log(`Found ${deals.length} deal(s).`);

  for (const deal of deals) {
    enqueue(`backfill:${deal.id}`, () => syncEnrollment(String(deal.id), 'backfill'))
      .catch((err) => console.error(`deal ${deal.id} failed:`, err.message));
  }

  await syncQueue.onIdle();
  console.log('Backfill complete.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('backfillHistorical failed:', err.message);
  await pool.end();
  process.exit(1);
});
