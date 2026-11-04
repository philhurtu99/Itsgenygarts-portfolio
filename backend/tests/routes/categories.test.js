import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';

const findMany = jest.fn();
const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
const del = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    category: { findMany, findUnique, create, update, delete: del },
  })),
}));

const router = (await import('../../src/routes/categories.js')).default;
const app = buildApp(router);

beforeEach(() => { [findMany, findUnique, create, update, del].forEach(fn => fn.mockReset()); });

describe('GET /api/', () => {
  it('returns active categories', async () => {
    findMany.mockResolvedValue([{ id: 1, name: 'Hats' }]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns categories alphabetically by display name', async () => {
    findMany.mockResolvedValue([
      { id: 1, name: 'Sacs', nameFr: 'Sacs' },
      { id: 2, name: 'Bandanas', nameFr: 'Bandanas' },
    ]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.data.map((category) => category.name)).toEqual(['Bandanas', 'Sacs']);
  });

  it('sorts by the requested language', async () => {
    findMany.mockResolvedValue([
      { id: 1, name: 'Zebras', nameFr: 'Zèbres', nameEn: 'Apples' },
      { id: 2, name: 'Bees', nameFr: 'Abeilles', nameEn: 'Zebras' },
    ]);
    const res = await request(app).get('/api/').set('X-Language', 'en');
    expect(res.status).toBe(200);
    expect(res.body.data.map((category) => category.name)).toEqual(['Zebras', 'Bees']);
  });
});

describe('GET /api/:id', () => {
  it('returns 404 when not found', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/99');
    expect(res.status).toBe(404);
  });

  it('returns category when found', async () => {
    findUnique.mockResolvedValue({ id: 1, name: 'Hats', _count: { products: 3 } });
    const res = await request(app).get('/api/1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});

describe('POST /api/', () => {
  it('requires admin auth', async () => {
    const res = await request(app).post('/api/').send({ name: 'Bags' });
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/:id', () => {
  it('requires admin auth', async () => {
    const res = await request(app).put('/api/1').send({ name: 'Updated' });
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/:id', () => {
  it('requires admin auth', async () => {
    const res = await request(app).delete('/api/1');
    expect(res.status).toBe(401);
    expect(del).not.toHaveBeenCalled();
  });
});
