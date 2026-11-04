import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { analyticsLimiter } from '../middleware/rateLimit.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function emptySeries(days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    return { date: dayKey(d), visits: 0, orders: 0 };
  });
}

router.post('/page-view', analyticsLimiter, async (req, res, next) => {
  try {
    const path = String(req.body?.path || '/').slice(0, 240);
    const referrer = req.body?.referrer ? String(req.body.referrer).slice(0, 500) : null;
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500) || null;
    const ipHash = req.ip
      ? crypto.createHash('sha256').update(`${req.ip}:${process.env.JWT_SECRET || 'analytics'}`).digest('hex')
      : null;

    await prisma.pageView.create({
      data: { path, referrer, userAgent, ipHash },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/admin/overview', requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 30);
    const series = emptySeries(days);
    const byDate = new Map(series.map((item) => [item.date, item]));
    const start = new Date(`${series[0].date}T00:00:00.000Z`);

    const [visits, orders] = await Promise.all([
      prisma.pageView.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: start },
          status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'PROCESSING', 'COMPLETED'] },
        },
        select: { createdAt: true },
      }),
    ]);

    for (const visit of visits) {
      const item = byDate.get(dayKey(visit.createdAt));
      if (item) item.visits += 1;
    }
    for (const order of orders) {
      const item = byDate.get(dayKey(order.createdAt));
      if (item) item.orders += 1;
    }

    res.json({
      success: true,
      data: {
        days,
        totalVisits: visits.length,
        totalOrders: orders.length,
        series,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
