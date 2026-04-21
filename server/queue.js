import PQueue from 'p-queue';
import { logger } from './logger.js';

export const syncQueue = new PQueue({ concurrency: 2 });

syncQueue.on('error', (err) => logger.error({ err }, 'sync queue error'));
syncQueue.on('idle', () => logger.debug('sync queue idle'));

export function enqueue(label, fn) {
  return syncQueue.add(async () => {
    const start = Date.now();
    try {
      const result = await fn();
      logger.info({ label, ms: Date.now() - start }, 'queue job complete');
      return result;
    } catch (err) {
      logger.error({ label, err: err.message }, 'queue job failed');
      throw err;
    }
  });
}
