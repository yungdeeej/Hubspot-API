import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { syncEnrollment } from '../services/syncOrchestrator.js';
import { enqueue } from '../queue.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const status = req.query.status;
  const email = req.query.email;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const { rows, total } = await db.listEnrollments({ status, email, limit, offset });
  res.json({ enrollments: rows, total, limit, offset });
});

router.get('/metrics', async (_req, res) => {
  const metrics = await db.getMetrics();
  res.json(metrics);
});

router.get('/:id', async (req, res) => {
  const enrollment = await db.getEnrollmentById(req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'not_found' });
  const audit = await db.listAuditLog({ enrollmentId: enrollment.id, limit: 100 });
  res.json({ enrollment, audit });
});

router.post('/:id/retry', requireRole('admin', 'staff'), async (req, res) => {
  const enrollment = await db.getEnrollmentById(req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'not_found' });
  await db.logAudit(enrollment.id, 'sync.retry_requested', req.user.email);
  enqueue(`retry:${enrollment.hubspot_deal_id}`, () =>
    syncEnrollment(enrollment.hubspot_deal_id, `manual:${req.user.email}`)
  );
  res.json({ ok: true, queued: true });
});

const patchSchema = z.object({
  payload_sent: z.record(z.any()).optional(),
  status: z.enum(['pending', 'in_progress', 'success', 'failed', 'manual_review', 'skipped', 'duplicate']).optional(),
  error_message: z.string().nullable().optional()
});

router.patch('/:id', requireRole('admin', 'staff'), async (req, res) => {
  const enrollment = await db.getEnrollmentById(req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'not_found' });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const updated = await db.updateEnrollment(enrollment.id, parsed.data);
  await db.logAudit(enrollment.id, 'enrollment.edited', req.user.email, parsed.data);
  res.json({ enrollment: updated });
});

router.post('/:id/skip', requireRole('admin', 'staff'), async (req, res) => {
  const enrollment = await db.getEnrollmentById(req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'not_found' });
  const updated = await db.updateEnrollment(enrollment.id, {
    status: 'skipped',
    error_message: req.body?.reason || 'Skipped manually'
  });
  await db.logAudit(enrollment.id, 'enrollment.skipped', req.user.email, { reason: req.body?.reason });
  res.json({ enrollment: updated });
});

export default router;
