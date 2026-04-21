import { Router } from 'express';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

function parseFilters(q) {
  return {
    enrollmentId: q.enrollment_id || undefined,
    actor: q.actor || undefined,
    action: q.action || undefined,
    since: q.since || undefined
  };
}

router.get('/', async (req, res) => {
  const filters = parseFilters(req.query);
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const offset = Number(req.query.offset) || 0;
  const rows = await db.listAuditLog({ ...filters, limit, offset });
  res.json({ audit: rows });
});

router.get('/export.csv', async (req, res) => {
  const filters = parseFilters(req.query);
  const rows = await db.listAuditLog({ ...filters, limit: 10000 });
  const headers = ['id', 'created_at', 'enrollment_id', 'actor', 'action', 'details'];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
  res.send(csv);
});

export default router;
