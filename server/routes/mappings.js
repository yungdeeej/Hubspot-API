import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { applyTransform } from '../services/transformers.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const mappings = await db.listFieldMappings();
  res.json({ mappings });
});

const mappingSchema = z.object({
  hubspot_field: z.string().min(1),
  amp_field: z.string().min(1),
  transform: z.string().nullable().optional(),
  default_value: z.string().nullable().optional(),
  is_required: z.boolean().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional()
});

router.post('/', requireRole('admin'), async (req, res) => {
  const parsed = mappingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  const created = await db.insertFieldMapping(parsed.data);
  res.status(201).json({ mapping: created });
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const parsed = mappingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  const updated = await db.updateFieldMapping(req.params.id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json({ mapping: updated });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  await db.deleteFieldMapping(req.params.id);
  res.json({ ok: true });
});

router.post('/test-transform', async (req, res) => {
  const { transform, value } = req.body || {};
  try {
    res.json({ result: applyTransform(transform, value) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
