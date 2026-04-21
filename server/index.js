import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './logger.js';
import authRouter from './routes/auth.js';
import webhooksRouter from './routes/webhooks.js';
import enrollmentsRouter from './routes/enrollments.js';
import mappingsRouter from './routes/mappings.js';
import providersRouter from './routes/providers.js';
import aliasesRouter from './routes/aliases.js';
import manualEnrollRouter from './routes/manualEnroll.js';
import auditLogRouter from './routes/auditLog.js';
import * as db from './db.js';
import { startCronJobs } from './jobs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigin = process.env.APP_BASE_URL || true;
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(cookieParser());

app.use('/webhooks', express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use(express.json({ limit: '1mb' }));

const webhookLimiter = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 1000, standardHeaders: true, legacyHeaders: false });

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use('/webhooks', webhookLimiter, webhooksRouter);

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/mappings', mappingsRouter);
app.use('/api/providers', providersRouter);
app.use('/api/aliases', aliasesRouter);
app.use('/api/manual-enroll', manualEnrollRouter);
app.use('/api/audit-log', auditLogRouter);

app.get('/api/metrics', async (_req, res) => {
  const metrics = await db.getMetrics();
  res.json(metrics);
});

const clientDist = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get(/^\/(?!api|webhooks|health).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run `npm run build:client`.');
  });
});

app.use((err, _req, res, _next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(err.status || 500).json({ error: 'internal_error', message: err.message });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'InFocus Lead Bridge listening');
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    startCronJobs();
  }
});
