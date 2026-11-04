import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

// List all zones
router.get('/', async (req, res, next) => {
  try {
    const zones = await prisma.shippingZone.findMany({
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
});

// Create zone
router.post('/', async (req, res, next) => {
  try {
    const { name, countries, isActive, displayOrder } = req.body;
    if (!name?.trim() || !countries?.trim()) {
      return res.status(400).json({ success: false, message: 'name and countries are required' });
    }
    const zone = await prisma.shippingZone.create({
      data: {
        name: name.trim(),
        countries: countries.trim(),
        isActive: isActive !== false,
        displayOrder: Number(displayOrder) || 0,
      },
    });
    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
});

// Update zone
router.put('/:id', async (req, res, next) => {
  try {
    const { name, countries, isActive, displayOrder } = req.body;
    const zone = await prisma.shippingZone.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(countries != null && { countries: countries.trim() }),
        ...(isActive != null && { isActive }),
        ...(displayOrder != null && { displayOrder: Number(displayOrder) || 0 }),
      },
    });
    res.json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
});

// Delete zone
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.shippingZone.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
