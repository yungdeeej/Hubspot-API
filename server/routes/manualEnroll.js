import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth.js';
import * as hubspot from '../services/hubspotClient.js';
import { syncEnrollment } from '../services/syncOrchestrator.js';
import { enqueue } from '../queue.js';

const router = Router();
router.use(requireAuth);

const searchSchema = z.object({ email: z.string().email() });

router.post('/search', async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const contacts = await hubspot.searchContactByEmail(parsed.data.email);
  res.json({ contacts });
});

const syncSchema = z.object({ hubspotDealId: z.string().min(1) });

router.post('/sync', requireRole('admin', 'staff'), async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const dealId = parsed.data.hubspotDealId;
  enqueue(`manual:${dealId}`, () => syncEnrollment(dealId, `manual:${req.user.email}`));
  res.json({ ok: true, queued: true });
});

export default router;
