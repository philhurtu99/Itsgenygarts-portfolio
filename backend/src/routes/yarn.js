import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const yarnInclude = {
  images: { orderBy: { order: 'asc' } },
  category: true,
};

function normalizeAvailability(yarn) {
  return {
    ...yarn,
    soldOut: Boolean(yarn.soldOut) || Number(yarn.stockQuantity ?? 0) <= 0,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const where = { isDeleted: false };
    if (category) {
      where.category = { name: { equals: category, mode: 'insensitive' } };
    }

    const yarn = await prisma.yarnProduct.findMany({
      where,
      include: yarnInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: yarn.map(normalizeAvailability) });
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.yarnCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const yarn = await prisma.yarnProduct.findFirst({
      where: { id: Number(req.params.id), isDeleted: false },
      include: yarnInclude,
    });
    if (!yarn) return res.status(404).json({ success: false, message: 'Yarn not found' });
    res.json({ success: true, data: normalizeAvailability(yarn) });
  } catch (err) {
    next(err);
  }
});

export default router;
