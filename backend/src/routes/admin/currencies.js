import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

// List all currencies
router.get('/', async (req, res, next) => {
  try {
    const rates = await prisma.currencyRate.findMany({ orderBy: { id: 'asc' } });
    res.json({ success: true, data: rates });
  } catch (err) {
    next(err);
  }
});

// Create currency
router.post('/', async (req, res, next) => {
  try {
    const { code, symbol, rate, isActive } = req.body;
    if (!code?.trim() || !symbol?.trim() || rate == null) {
      return res.status(400).json({ success: false, message: 'code, symbol, and rate are required' });
    }
    const currency = await prisma.currencyRate.create({
      data: {
        code: code.trim().toUpperCase(),
        symbol: symbol.trim(),
        rate: Number(rate),
        isActive: isActive !== false,
      },
    });
    res.status(201).json({ success: true, data: currency });
  } catch (err) {
    next(err);
  }
});

// Update currency
router.put('/:id', async (req, res, next) => {
  try {
    const { code, symbol, rate, isActive } = req.body;
    const currency = await prisma.currencyRate.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(code != null && { code: code.trim().toUpperCase() }),
        ...(symbol != null && { symbol: symbol.trim() }),
        ...(rate != null && { rate: Number(rate) }),
        ...(isActive != null && { isActive }),
      },
    });
    res.json({ success: true, data: currency });
  } catch (err) {
    next(err);
  }
});

// Delete currency
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.currencyRate.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
