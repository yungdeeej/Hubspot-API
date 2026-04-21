import 'dotenv/config';
import crypto from 'crypto';
import { pool } from '../server/db.js';
import { hashPassword } from '../server/auth.js';
import * as db from '../server/db.js';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.error('ADMIN_EMAIL is not set');
    process.exit(1);
  }

  const existing = await db.getUserByEmail(email);
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    await pool.end();
    return;
  }

  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const hash = await hashPassword(password);
  const user = await db.createUser({ email, password_hash: hash, role: 'admin' });
  console.log('Admin user created.');
  console.log(`  email:    ${user.email}`);
  console.log(`  role:     ${user.role}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`  password: ${password}`);
    console.log('  (save this password — it will not be shown again)');
  } else {
    console.log('  password: <ADMIN_PASSWORD env var>');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('seedAdmin failed:', err.message);
  await pool.end();
  process.exit(1);
});
