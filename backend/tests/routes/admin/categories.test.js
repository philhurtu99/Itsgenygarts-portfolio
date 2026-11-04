import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

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

const router = (await import('../../../src/routes/admin/categories.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => { [findMany, findUnique, create, update, del].forEach(fn => fn.mockReset()); });

describe('Admin categories', () => {
  it('stores and clears the category customs default', async () => {
    create.mockResolvedValue({ id: 2, name: 'Art', customsProfileKey: 'original-hand-painted-art' });
    const created = await request(app).post('/api/').set(auth()).send({ name: 'Art', customsProfileKey: 'original-hand-painted-art' });
    expect(created.status).toBe(201);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ customsProfileKey: 'original-hand-painted-art' }) });
    update.mockResolvedValue({ id: 2, name: 'Art', customsProfileKey: null });
    const cleared = await request(app).put('/api/2').set(auth()).send({ name: 'Art', customsProfileKey: '' });
    expect(cleared.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: 2 }, data: expect.objectContaining({ customsProfileKey: null }) });
  });
  it('rejects unknown or yarn-only profiles for product categories', async () => {
    for (const key of ['unknown', 'acrylic-retail-yarn']) {
      expect((await request(app).post('/api/').set(auth()).send({ name: 'Art', customsProfileKey: key })).status).toBe(400);
      expect((await request(app).put('/api/2').set(auth()).send({ name: 'Art', customsProfileKey: key })).status).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(401);
  });

  it('GET / returns all categories', async () => {
    findMany.mockResolvedValue([{ id: 1, name: 'Hats' }]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET / returns categories alphabetically', async () => {
    findMany.mockResolvedValue([
      { id: 1, name: 'Sacs', nameFr: 'Sacs', _count: { products: 1 } },
      { id: 2, name: 'Bandanas', nameFr: 'Bandanas', _count: { products: 1 } },
    ]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.map((category) => category.name)).toEqual(['Bandanas', 'Sacs']);
  });

  it('GET / sorts categories by requested language', async () => {
    findMany.mockResolvedValue([
      { id: 1, name: 'Zebras', nameFr: 'Zèbres', nameEn: 'Apples', _count: { products: 1 } },
      { id: 2, name: 'Bees', nameFr: 'Abeilles', nameEn: 'Zebras', _count: { products: 1 } },
    ]);
    const res = await request(app).get('/api/').set(auth()).set('X-Language', 'en');
    expect(res.status).toBe(200);
    expect(res.body.data.map((category) => category.name)).toEqual(['Zebras', 'Bees']);
  });

  it('GET /:id returns 404 when not found', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/99').set(auth());
    expect(res.status).toBe(404);
  });

  it('POST / creates category', async () => {
    create.mockResolvedValue({ id: 2, name: 'Bags' });
    const res = await request(app).post('/api/').set(auth()).send({ name: 'Bags' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Bags');
  });

  it('PUT /:id updates category', async () => {
    update.mockResolvedValue({ id: 1, name: 'Updated' });
    const res = await request(app).put('/api/1').set(auth()).send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id removes category', async () => {
    del.mockResolvedValue({});
    const res = await request(app).delete('/api/1').set(auth());
    expect(res.status).toBe(200);
  });
});
