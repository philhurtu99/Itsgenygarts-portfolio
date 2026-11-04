import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const products = jest.fn();
const yarns = jest.fn();
const listAllImages = jest.fn();
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: jest.fn(async () => ({ id: 1, role: 'ADMIN', isActive: true })) },
    product: { findMany: products },
    yarnProduct: { findMany: yarns },
  })),
}));
jest.unstable_mockModule('../../../src/services/cloudinary.js', () => ({
  uploadImage: jest.fn(), listAllImages,
}));
const router = (await import('../../../src/routes/admin/productReferences.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const initialNodeEnv = process.env.NODE_ENV;
const initialStorage = process.env.IMAGE_STORAGE;

beforeEach(() => {
  process.env.NODE_ENV = 'development';
  process.env.IMAGE_STORAGE = 'local';
  products.mockReset().mockResolvedValue([]);
  yarns.mockReset().mockResolvedValue([]);
  listAllImages.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  process.env.NODE_ENV = initialNodeEnv;
  if (initialStorage === undefined) delete process.env.IMAGE_STORAGE;
  else process.env.IMAGE_STORAGE = initialStorage;
});

describe('GET /existing-images', () => {
  it('requires an administrator', async () => {
    const res = await request(app).get('/api/existing-images');
    expect(res.status).toBe(401);
    expect(products).not.toHaveBeenCalled();
  });

  it('includes catalog covers, variation photos, yarn photos and local uploads without duplicates', async () => {
    products.mockResolvedValue([{ name: 'Bandana', mainImageUrl: 'https://cdn/cover.jpg', images: [{ imageUrl: 'https://cdn/cover.jpg' }, { imageUrl: 'https://cdn/variation.jpg' }] }]);
    yarns.mockResolvedValue([{ name: 'Laine', mainImageUrl: null, images: [{ imageUrl: 'https://cdn/yarn.jpg' }] }]);
    listAllImages.mockResolvedValue([{ secure_url: '/api/local-images/test.png', public_id: 'local-dev/test.png' }, { secure_url: 'https://cdn/variation.jpg', public_id: 'duplicate' }]);
    const res = await request(app).get('/api/existing-images').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((image) => image.url)).toEqual(['https://cdn/cover.jpg', 'https://cdn/variation.jpg', 'https://cdn/yarn.jpg', '/api/local-images/test.png']);
    expect(res.body.data[0].label).toBe('Bandana');
    expect(products.mock.calls[0][0].where).toEqual({ isDeleted: false });
  });

  it('keeps the production Cloudinary library behavior unchanged', async () => {
    process.env.NODE_ENV = 'production';
    listAllImages.mockResolvedValue([{ secure_url: 'https://cdn/photo.jpg', public_id: 'crochet/photo' }]);
    const res = await request(app).get('/api/existing-images').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ url: 'https://cdn/photo.jpg', label: 'photo', source: 'cloudinary' }]);
    expect(products).not.toHaveBeenCalled();
    expect(yarns).not.toHaveBeenCalled();
  });
});
