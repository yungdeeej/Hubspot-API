import { Router } from 'express';
import { validateHubspotSignature } from '../services/webhookValidator.js';
import { syncEnrollment } from '../services/syncOrchestrator.js';
import { enqueue } from '../queue.js';
import { logger } from '../logger.js';

const router = Router();

router.post('/hubspot', async (req, res) => {
  if (!validateHubspotSignature(req)) {
    logger.warn('Rejected HubSpot webhook: invalid signature');
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const events = Array.isArray(req.body) ? req.body : [req.body];
  const stageId = process.env.HUBSPOT_CLOSED_WON_STAGE_ID;
  let enqueued = 0;

  for (const event of events) {
    if (event.propertyName === 'dealstage' && String(event.propertyValue) === String(stageId)) {
      const dealId = String(event.objectId);
      enqueue(`hubspot:${dealId}`, () => syncEnrollment(dealId, 'hubspot_webhook'))
        .catch((err) => logger.error({ err: err.message, dealId }, 'enqueued sync failed'));
      enqueued++;
    }
  }

  logger.info({ received: events.length, enqueued }, 'hubspot webhook processed');
  res.status(200).json({ received: events.length, enqueued });
});

export default router;
