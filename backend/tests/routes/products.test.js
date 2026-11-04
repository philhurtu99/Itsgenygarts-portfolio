import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';

const productFindMany = jest.fn();
const productFindFirst = jest.fn();
const categoryFindMany = jest.fn();
const productImageCreate = jest.fn();
const productImageFindUnique = jest.fn();
const productImageDelete = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

const mockPrisma = {
  user: { findUnique: userFindUnique },
  product: { findMany: productFindMany, findFirst: productFindFirst },
  category: { findMany: categoryFindMany },
  productImage: {
    create: productImageCreate,
    findUnique: productImageFindUnique,
    delete: productImageDelete,
  },
};

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));
jest.unstable_mockModule('../../src/services/cloudinary.js', () => ({
  uploadImage: jest.fn(async () => ({ secure_url: 'http://cdn/img.jpg', public_id: 'img123' })),
  deleteImage: jest.fn(async () => {}),
}));

const productsRouter = (await import('../../src/routes/products.js')).default;
const app = buildApp(productsRouter);

const fakeProduct = { id: 1, name: 'Hat', soldOut: false, stockQuantity: 3, images: [], category: null };

beforeEach(() => {
  productFindMany.mockReset();
  productFindFirst.mockReset();
  categoryFindMany.mockReset();
  productImageCreate.mockReset();
  productImageFindUnique.mockReset();
  productImageDelete.mockReset();
});

describe('GET /api/', () => {
  it('preserves photos of a sold simple product without requiring presentation photos', async () => {
    productFindMany.mockResolvedValue([{ ...fakeProduct, stockQuantity: 0, soldOut: true,
      mainImageUrl: 'photo.jpg', variants: [{ id: 10, status: 'SOLD', images: [{ imageUrl: 'photo.jpg' }] }],
      images: [{ id: 1, imageUrl: 'photo.jpg', variantId: 10 }],
    }]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ mainImageUrl: 'photo.jpg', soldOut: true, stockQuantity: 0, variants: [] });
    expect(res.body.data[0].images).toEqual([expect.objectContaining({ imageUrl: 'photo.jpg', variantId: null })]);
  });
  it('includes sold variations for the explicitly enabled sold-product gallery', async () => {
    productFindMany.mockResolvedValue([{ ...fakeProduct, stockQuantity: 0, soldOut: true, showSoldVariants: true,
      variants: [{ id: 10, status: 'SOLD', images: [{ imageUrl: 'a.jpg' }] }, { id: 11, status: 'SOLD', images: [{ imageUrl: 'b.jpg' }] }],
      images: [{ id: 1, imageUrl: 'a.jpg', variantId: 10 }, { id: 2, imageUrl: 'b.jpg', variantId: 11 }],
    }]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(productFindMany.mock.calls[0][0].include.variants.where).toBeUndefined();
    expect(res.body.data[0]).toMatchObject({ stockQuantity: 0, soldOut: true, showSoldVariants: true });
    expect(res.body.data[0].variants).toHaveLength(2);
    expect(res.body.data[0].images).toHaveLength(2);
  });
  it('returns product list', async () => {
    productFindMany.mockResolvedValue([fakeProduct]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('normalizes soldOut when stock <= 0', async () => {
    productFindMany.mockResolvedValue([{ ...fakeProduct, soldOut: false, stockQuantity: 0 }]);
    const res = await request(app).get('/api/');
    expect(res.body.data[0].soldOut).toBe(true);
  });

  it('forwards DB errors to error handler', async () => {
    productFindMany.mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/api/');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/categories', () => {
  it('returns category names alphabetically', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 1, name: 'Hats', nameFr: 'Chapeaux' },
      { id: 2, name: 'Bags', nameFr: 'Sacs' },
      { id: 3, name: 'Bandanas', nameFr: 'Bandanas' },
    ]);
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['Bandanas', 'Hats', 'Bags']);
  });

  it('sorts category names by requested language', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 1, name: 'Zebras', nameFr: 'Zèbres', nameEn: 'Apples' },
      { id: 2, name: 'Bees', nameFr: 'Abeilles', nameEn: 'Zebras' },
    ]);
    const res = await request(app).get('/api/categories').set('X-Language', 'en');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['Zebras', 'Bees']);
  });
});

describe('GET /api/:id', () => {
  it('returns 404 when product not found', async () => {
    productFindFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/42');
    expect(res.status).toBe(404);
  });

  it('returns product when found', async () => {
    productFindFirst.mockResolvedValue(fakeProduct);
    const res = await request(app).get('/api/1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});

describe('GET /api/category/:category', () => {
  it('returns products filtered by category', async () => {
    productFindMany.mockResolvedValue([fakeProduct]);
    const res = await request(app).get('/api/category/hats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('DELETE /api/:productId/images/:imageId', () => {
  it('requires admin auth', async () => {
    const res = await request(app).delete('/api/1/images/99');
    expect(res.status).toBe(401);
    expect(productImageFindUnique).not.toHaveBeenCalled();
  });
});
