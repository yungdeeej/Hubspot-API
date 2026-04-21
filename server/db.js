import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected pg pool error');
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logger.warn({ duration, rows: res.rowCount, text: text.slice(0, 80) }, 'slow query');
  }
  return res;
}

// ---------- Enrollments ----------

export async function getEnrollmentByDealId(hubspotDealId) {
  const { rows } = await query(
    'SELECT * FROM enrollments WHERE hubspot_deal_id = $1 LIMIT 1',
    [hubspotDealId]
  );
  return rows[0] || null;
}

export async function getEnrollmentById(id) {
  const { rows } = await query('SELECT * FROM enrollments WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function listEnrollments({ status, email, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (email)  { params.push(`%${email}%`); where.push(`student_email ILIKE $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit);  const limIdx = params.length;
  params.push(offset); const offIdx = params.length;
  const { rows } = await query(
    `SELECT * FROM enrollments ${whereSql} ORDER BY created_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM enrollments ${whereSql}`,
    params.slice(0, params.length - 2)
  );
  return { rows, total: countRes.rows[0].total };
}

export async function upsertEnrollment({ hubspotDealId, status, triggeredBy, retryCount }) {
  const { rows } = await query(
    `INSERT INTO enrollments (hubspot_deal_id, hubspot_contact_id, student_email, status, triggered_by, retry_count)
     VALUES ($1, '', '', $2, $3, $4)
     ON CONFLICT (hubspot_deal_id) DO UPDATE
       SET status = EXCLUDED.status,
           triggered_by = EXCLUDED.triggered_by,
           retry_count = EXCLUDED.retry_count,
           updated_at = NOW()
     RETURNING *`,
    [hubspotDealId, status, triggeredBy, retryCount || 0]
  );
  return rows[0];
}

export async function updateEnrollment(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => fields[k]);
  const { rows } = await query(
    `UPDATE enrollments SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
}

// ---------- Providers / Aliases / Mappings ----------

export async function listLeadProviders() {
  const { rows } = await query('SELECT * FROM lead_providers ORDER BY program_code ASC');
  return rows;
}

export async function getLeadProvider(programCode) {
  const { rows } = await query(
    'SELECT * FROM lead_providers WHERE program_code = $1 AND active = TRUE LIMIT 1',
    [programCode]
  );
  return rows[0] || null;
}

export async function updateLeadProvider(id, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => fields[k]);
  const { rows } = await query(
    `UPDATE lead_providers SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
}

export async function listAliases() {
  const { rows } = await query('SELECT * FROM program_aliases ORDER BY program_code, hubspot_value');
  return rows;
}

export async function resolveProgramAlias(hubspotValue) {
  const { rows } = await query(
    `SELECT pa.*, lp.program_label
     FROM program_aliases pa
     JOIN lead_providers lp ON lp.program_code = pa.program_code
     WHERE lower(pa.hubspot_value) = lower($1) AND pa.active = TRUE AND lp.active = TRUE
     LIMIT 1`,
    [hubspotValue]
  );
  return rows[0] || null;
}

export async function insertAlias({ hubspot_value, program_code }) {
  const { rows } = await query(
    `INSERT INTO program_aliases (hubspot_value, program_code) VALUES ($1, $2) RETURNING *`,
    [hubspot_value, program_code]
  );
  return rows[0];
}

export async function deleteAlias(id) {
  await query('DELETE FROM program_aliases WHERE id = $1', [id]);
}

export async function listFieldMappings({ activeOnly = false } = {}) {
  const sql = activeOnly
    ? 'SELECT * FROM field_mappings WHERE active = TRUE ORDER BY id ASC'
    : 'SELECT * FROM field_mappings ORDER BY id ASC';
  const { rows } = await query(sql);
  return rows;
}

export async function insertFieldMapping(m) {
  const { rows } = await query(
    `INSERT INTO field_mappings (hubspot_field, amp_field, transform, default_value, is_required, active, notes)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,TRUE),$7) RETURNING *`,
    [m.hubspot_field, m.amp_field, m.transform || null, m.default_value || null,
     !!m.is_required, m.active, m.notes || null]
  );
  return rows[0];
}

export async function updateFieldMapping(id, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => fields[k]);
  const { rows } = await query(
    `UPDATE field_mappings SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
}

export async function deleteFieldMapping(id) {
  await query('DELETE FROM field_mappings WHERE id = $1', [id]);
}

// ---------- Users ----------

export async function getUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  return rows[0] || null;
}

export async function getUserById(id) {
  const { rows } = await query('SELECT id, email, role, created_at FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function createUser({ email, password_hash, role = 'staff' }) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`,
    [email, password_hash, role]
  );
  return rows[0];
}

// ---------- Audit log ----------

export async function logAudit(enrollmentId, action, actor, details) {
  await query(
    `INSERT INTO audit_log (enrollment_id, action, actor, details) VALUES ($1,$2,$3,$4)`,
    [enrollmentId, action, actor || null, details ? JSON.stringify(details) : null]
  );
}

export async function listAuditLog({ enrollmentId, actor, action, since, limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (enrollmentId) { params.push(enrollmentId); where.push(`enrollment_id = $${params.length}`); }
  if (actor)        { params.push(actor); where.push(`actor = $${params.length}`); }
  if (action)       { params.push(action); where.push(`action = $${params.length}`); }
  if (since)        { params.push(since); where.push(`created_at >= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit);
  params.push(offset);
  const { rows } = await query(
    `SELECT * FROM audit_log ${whereSql}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

// ---------- Metrics ----------

export async function getMetrics() {
  const { rows } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today,
      COUNT(*) FILTER (WHERE status IN ('pending','in_progress'))::int AS pending,
      COUNT(*) FILTER (WHERE status = 'success' AND created_at >= NOW() - INTERVAL '24 hours')::int AS success_24h,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'manual_review')::int AS manual_review,
      COUNT(*) FILTER (WHERE status = 'duplicate' AND created_at >= NOW() - INTERVAL '24 hours')::int AS duplicates_24h
    FROM enrollments
  `);
  return rows[0];
}
