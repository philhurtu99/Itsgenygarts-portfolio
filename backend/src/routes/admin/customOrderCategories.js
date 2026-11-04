import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

function parseOptions(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatCat(cat) {
  return {
    ...cat,
    nameFr: cat.nameFr || cat.name || '',
    nameEn: cat.nameEn || '',
    options: parseOptions(cat.options),
  };
}

// GET all
router.get('/', async (req, res, next) => {
  try {
    const cats = await prisma.customOrderCategoryDef.findMany({
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ success: true, data: cats.map(formatCat) });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { name, nameFr, nameEn, code, icon, options, isActive, displayOrder } = req.body;
    const canonicalName = (nameFr || name || nameEn || '').trim();
    if (!canonicalName || !code) {
      return res.status(400).json({ success: false, message: 'name et code sont requis' });
    }
    const cat = await prisma.customOrderCategoryDef.create({
      data: {
        name: canonicalName,
        nameFr: (nameFr || canonicalName).trim(),
        nameEn: (nameEn || '').trim() || null,
        code: code.toUpperCase(),
        icon: icon || null,
        options: options ? JSON.stringify(options) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      },
    });
    res.status(201).json({ success: true, data: formatCat(cat) });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Ce code existe déjà' });
    }
    next(err);
  }
});

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { name, nameFr, nameEn, code, icon, options, isActive, displayOrder } = req.body;
    const canonicalName = nameFr !== undefined || name !== undefined || nameEn !== undefined
      ? (nameFr || name || nameEn || '').trim()
      : undefined;
    const cat = await prisma.customOrderCategoryDef.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(canonicalName !== undefined && { name: canonicalName }),
        ...(nameFr !== undefined && { nameFr: (nameFr || canonicalName || '').trim() || null }),
        ...(nameEn !== undefined && { nameEn: (nameEn || '').trim() || null }),
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(options !== undefined && { options: JSON.stringify(options) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
      },
    });
    res.json({ success: true, data: formatCat(cat) });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    }
    next(err);
  }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.customOrderCategoryDef.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    }
    next(err);
  }
});

export default router;
