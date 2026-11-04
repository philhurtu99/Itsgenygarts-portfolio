import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth.js';
import { sortCategoriesAlphabetically } from '../utils/categorySort.js';
import { languageFromRequest } from '../utils/language.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, products: { some: { isDeleted: false, isDraft: false } } },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: sortCategoriesAlphabetically(categories, languageFromRequest(req, 'fr')) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: Number(req.params.id) },
      include: { _count: { select: { products: true } } },
    });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
