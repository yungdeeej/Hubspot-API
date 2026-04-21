import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const providers = await db.listLeadProviders();
  res.json({ providers });
});

const patchSchema = z.object({
  program_label: z.string().optional(),
  amp_provider_id: z.string().optional(),
  amp_program_id: z.number().int().optional(),
  credential: z.enum(['Diploma', 'Certificate', 'Other']).optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional()
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  const updated = await db.updateLeadProvider(req.params.id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json({ provider: updated });
});

export default router;
