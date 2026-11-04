import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const where = req.query.status ? { status: req.query.status } : {};
    const quotes = await prisma.quoteRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ success: true, data: quotes });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const quote = await prisma.quoteRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const data = { status };
    if (status === 'Completed') {
      data.completedAt = new Date();
    }
    const quote = await prisma.quoteRequest.update({
      where: { id: Number(req.params.id) },
      data,
      include: { items: true },
    });
    res.json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
});

export default router;
