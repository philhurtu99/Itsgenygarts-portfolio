import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

// Get shipping rates for a product
router.get('/:productId', async (req, res, next) => {
  try {
    const rates = await prisma.productShippingRate.findMany({
      where: { productId: Number(req.params.productId) },
      include: { shippingZone: true },
      orderBy: { shippingZone: { displayOrder: 'asc' } },
    });
    res.json({ success: true, data: rates });
  } catch (err) {
    next(err);
  }
});

// Bulk set shipping rates for a product (replaces all)
router.put('/:productId', async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const { rates } = req.body; // [{ shippingZoneId, price }]

    if (!Array.isArray(rates)) {
      return res.status(400).json({ success: false, message: 'rates array required' });
    }

    // Delete existing then insert new in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.productShippingRate.deleteMany({ where: { productId } });
      if (rates.length > 0) {
        await tx.productShippingRate.createMany({
          data: rates
            .filter((r) => r.price != null && Number(r.price) > 0)
            .map((r) => ({
              productId,
              shippingZoneId: Number(r.shippingZoneId),
              price: Number(r.price),
            })),
        });
      }
    });

    const updated = await prisma.productShippingRate.findMany({
      where: { productId },
      include: { shippingZone: true },
      orderBy: { shippingZone: { displayOrder: 'asc' } },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
