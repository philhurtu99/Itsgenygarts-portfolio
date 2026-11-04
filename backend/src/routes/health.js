import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const checks = { database: 'unknown', stripe: 'unknown', sentry: 'unknown' };
  let ok = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    checks.database = `error: ${err.message}`;
    ok = false;
  }

  checks.stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
    ? 'configured'
    : 'missing-env';
  checks.sentry = process.env.SENTRY_DSN ? 'configured' : 'disabled';

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
