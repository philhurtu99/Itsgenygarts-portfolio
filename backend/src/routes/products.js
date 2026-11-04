import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { uploadImage, deleteImage } from '../services/cloudinary.js';
import { requireAdmin } from '../middleware/auth.js';
import { removeProductFromCustomerLists } from '../services/cartCleanup.js';
import { imageUpload, normalizeUploadedImage } from '../utils/imageUpload.js';
import { bilingualData } from '../utils/bilingualFields.js';
import { sortCategoriesAlphabetically } from '../utils/categorySort.js';
import { languageFromRequest } from '../utils/language.js';
import { normalizeProductVariants, syncProductVariants } from '../utils/productVariants.js';

const router = Router();
const prisma = new PrismaClient();
const upload = imageUpload({ files: 1 });

function productInclude(now = new Date()) {
  return {
    images: { orderBy: { order: 'asc' } },
    category: true,
    variants: {
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { images: { orderBy: { order: 'asc' } } },
    },
    reservations: {
      where: { expiresAt: { gt: now } },
      select: { quantity: true },
    },
  };
}

function normalizeAvailability(product) {
  return normalizeProductVariants(product);
}

function withStockDerivedSoldOut(data) {
  const next = { ...data };
  if (Object.prototype.hasOwnProperty.call(next, 'stockQuantity')) {
    next.soldOut = Number(next.stockQuantity) <= 0;
    if (!next.soldOut) next.showSoldVariants = false;
  }
  return next;
}

function withOptionalBilingualData(body) {
  const hasBilingualInput = ['name', 'nameFr', 'nameEn', 'description', 'descriptionFr', 'descriptionEn']
    .some((key) => Object.prototype.hasOwnProperty.call(body, key));
  return hasBilingualInput ? { ...body, ...bilingualData(body) } : body;
}

router.get('/', async (req, res, next) => {
  try {
    const { category, featured, limit } = req.query;
    const where = { isDeleted: false, isDraft: false };
    if (category) {
      where.category = { name: { equals: category, mode: 'insensitive' } };
    }
    if (featured === 'true') {
      where.isFeatured = true;
    }

    const parsedLimit = Number(limit);
    const take = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
    const now = new Date();

    const products = await prisma.product.findMany({
      where,
      include: productInclude(now),
      orderBy: featured === 'true'
        ? [
            { isFeatured: 'desc' },
            { createdAt: 'desc' },
          ]
        : { createdAt: 'desc' },
      ...(take ? { take } : {}),
    });
    res.json({ success: true, data: products.map(normalizeAvailability) });
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, products: { some: { isDeleted: false, isDraft: false } } },
      select: { id: true, name: true, nameFr: true, nameEn: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: sortCategoriesAlphabetically(categories, languageFromRequest(req, 'fr')).map((c) => c.name) });
  } catch (err) {
    next(err);
  }
});

router.get('/category/:category', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isDeleted: false,
        isDraft: false,
        category: {
          name: { equals: req.params.category, mode: 'insensitive' },
        },
      },
      include: productInclude(new Date()),
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: products.map(normalizeAvailability) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), isDeleted: false, isDraft: false },
      include: productInclude(new Date()),
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: normalizeAvailability(product) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = withStockDerivedSoldOut(withOptionalBilingualData(req.body));
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data });
      await syncProductVariants(tx, created.id, created.stockQuantity);
      return tx.product.findUnique({ where: { id: created.id }, include: productInclude(new Date()) });
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const data = withStockDerivedSoldOut(withOptionalBilingualData(req.body));
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data,
      });
      if (Object.prototype.hasOwnProperty.call(data, 'stockQuantity')) {
        await syncProductVariants(tx, productId, updated.stockQuantity);
      }
      return tx.product.findUnique({ where: { id: productId }, include: productInclude(new Date()) });
    });
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { isDeleted: true },
    });
    await removeProductFromCustomerLists(prisma, product);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/stock', requireAdmin, async (req, res, next) => {
  try {
    const stock = Number(req.body.stock);
    const productId = Number(req.params.id);
    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: stock, soldOut: stock <= 0, ...(stock > 0 ? { showSoldVariants: false } : {}) },
      });
      await syncProductVariants(tx, productId, stock);
      return tx.product.findUnique({ where: { id: productId }, include: productInclude(new Date()) });
    });
    await removeProductFromCustomerLists(prisma, product);
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upload-image', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const productId = Number(req.params.id);
    const variantId = req.body.variantId ? Number(req.body.variantId) : null;
    if (variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: variantId, productId },
      });
      if (!variant) return res.status(400).json({ success: false, message: 'Variation invalide pour ce produit' });
    }
    const normalizedImage = await normalizeUploadedImage(req.file);
    const result = await uploadImage(normalizedImage.buffer);
    const image = await prisma.productImage.create({
      data: {
        productId,
        variantId,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        order: req.body.order ? Number(req.body.order) : 0,
      },
    });
    res.status(201).json({ success: true, data: image });
  } catch (err) {
    next(err);
  }
});

router.delete('/:productId/images/:imageId', requireAdmin, async (req, res, next) => {
  try {
    const image = await prisma.productImage.findUnique({
      where: { id: Number(req.params.imageId) },
    });
    if (!image) return res.status(404).json({ success: false, message: 'Image not found' });
    if (image.publicId) await deleteImage(image.publicId);
    await prisma.productImage.delete({ where: { id: image.id } });
    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
