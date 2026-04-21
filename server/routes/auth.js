import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, requireRole } from '../auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff', 'viewer']).optional()
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await db.getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = signToken(user);
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  });
  res.json({ user: { id: user.id, email: user.email, role: user.role } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ ok: true });
});

router.post('/register', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const { email, password, role } = parsed.data;
  const existing = await db.getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'email_in_use' });

  const hash = await hashPassword(password);
  const user = await db.createUser({ email, password_hash: hash, role: role || 'staff' });
  res.status(201).json({ user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } });
});

export default router;
