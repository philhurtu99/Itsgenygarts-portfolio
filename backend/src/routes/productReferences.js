import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const where = category ? { category: { equals: category, mode: 'insensitive' } } : {};
    const references = await prisma.productReference.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    res.json({ success: true, data: references });
  } catch (err) {
    next(err);
  }
});

export default router;
