import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';
import { uploadImage, listAllImages } from '../../services/cloudinary.js';
import { localImageStorageEnabled } from '../../services/localImages.js';
import { imageUpload, normalizeUploadedImage } from '../../utils/imageUpload.js';

const router = Router();
const prisma = new PrismaClient();
const upload = imageUpload({ files: 1, fileSize: 12 * 1024 * 1024, allowPhonePhotos: true });

router.use(requireAdmin);

// In local Dev, reuse catalog photos without requiring access to Cloudinary.
router.get('/existing-images', async (req, res, next) => {
  try {
    const resources = await listAllImages(500);
    const images = resources.map((r) => ({
      url: r.secure_url,
      label: r.public_id.split('/').pop(),
      source: localImageStorageEnabled() ? 'local' : 'cloudinary',
    }));
    if (localImageStorageEnabled()) {
      const select = { name: true, mainImageUrl: true, images: { select: { imageUrl: true }, orderBy: { order: 'asc' } } };
      const [products, yarns] = await Promise.all([
        prisma.product.findMany({ where: { isDeleted: false }, select }),
        prisma.yarnProduct.findMany({ where: { isDeleted: false }, select }),
      ]);
      const catalogImages = [...products, ...yarns].flatMap((product) => (
        [product.mainImageUrl, ...product.images.map((image) => image.imageUrl)]
          .filter(Boolean)
          .map((url) => ({ url, label: product.name, source: 'catalog' }))
      ));
      const seen = new Set();
      const uniqueImages = [...catalogImages, ...images].filter((image) => {
        if (seen.has(image.url)) return false;
        seen.add(image.url);
        return true;
      });
      return res.json({ success: true, data: uniqueImages });
    }
    res.json({ success: true, data: images });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const where = category ? { category } : {};
    const refs = await prisma.productReference.findMany({
      where,
      orderBy: { id: 'desc' },
    });
    res.json({ success: true, data: refs });
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { name, category, existingImageUrl } = req.body;
    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Nom et catégorie requis' });
    }

    let imageUrl = existingImageUrl || null;
    if (req.file) {
      const image = await normalizeUploadedImage(req.file, { allowPhonePhotos: true });
      const result = await uploadImage(image.buffer);
      imageUrl = result.secure_url;
    }

    const ref = await prisma.productReference.create({
      data: { name, category, imageUrl },
    });
    res.status(201).json({ success: true, data: ref });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', upload.single('image'), async (req, res, next) => {
  try {
    const { name, category, existingImageUrl } = req.body;
    const data = {};
    if (name) data.name = name;
    if (category) data.category = category;

    if (req.file) {
      const image = await normalizeUploadedImage(req.file, { allowPhonePhotos: true });
      const result = await uploadImage(image.buffer);
      data.imageUrl = result.secure_url;
    } else if (existingImageUrl) {
      data.imageUrl = existingImageUrl;
    }

    const ref = await prisma.productReference.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json({ success: true, data: ref });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.productReference.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true, message: 'Référence supprimée' });
  } catch (err) {
    next(err);
  }
});

export default router;
