import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';
import { bilingualData } from '../../utils/bilingualFields.js';
import { sortCategoriesAlphabetically } from '../../utils/categorySort.js';
import { languageFromRequest } from '../../utils/language.js';
import { categoryCustomsFieldsFromBody } from '../../utils/customsFields.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { _count: { select: { products: true } } },
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

router.post('/', async (req, res, next) => {
  try {
    const customs = categoryCustomsFieldsFromBody(req.body, 'product');
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    const bilingual = bilingualData(req.body);
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const category = await prisma.category.create({ data: { ...req.body, ...bilingual, ...customs.data } });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const customs = categoryCustomsFieldsFromBody(req.body, 'product');
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    const bilingual = bilingualData(req.body);
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { ...req.body, ...bilingual, ...customs.data },
    });
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
