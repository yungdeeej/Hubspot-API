import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const aliases = await db.listAliases();
  res.json({ aliases });
});

const createSchema = z.object({
  hubspot_value: z.string().min(1),
  program_code: z.string().min(1)
});

router.post('/', requireRole('admin', 'staff'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  try {
    const created = await db.insertAlias(parsed.data);
    res.status(201).json({ alias: created });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'alias_exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'unknown_program_code' });
    throw err;
  }
});

router.delete('/:id', requireRole('admin', 'staff'), async (req, res) => {
  await db.deleteAlias(req.params.id);
  res.json({ ok: true });
});

export default router;
