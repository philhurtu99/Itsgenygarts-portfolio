import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

router.get('/:entityType/:entityId', async (req, res, next) => {
  try {
    const notes = await prisma.adminNote.findMany({
      where: {
        entityType: req.params.entityType,
        entityId: Number(req.params.entityId),
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
});

router.post('/:entityType/:entityId', async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ success: false, message: 'Note requise' });
    const note = await prisma.adminNote.create({
      data: {
        entityType: req.params.entityType,
        entityId: Number(req.params.entityId),
        body,
        authorId: req.user?.userId || null,
      },
    });
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
});

export default router;
