import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const findMany = jest.fn();
const create = jest.fn();
const update = jest.fn();
const del = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    currencyRate: { findMany, create, update, delete: del },
  })),
}));

const router = (await import('../../../src/routes/admin/currencies.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => { [findMany, create, update, del].forEach(fn => fn.mockReset()); });

describe('Admin currencies', () => {
  it('GET / returns currencies', async () => {
    findMany.mockResolvedValue([{ id: 1, code: 'USD', rate: 0.74 }]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST / returns 400 when required fields missing', async () => {
    const res = await request(app).post('/api/').set(auth()).send({ code: 'USD' });
    expect(res.status).toBe(400);
  });

  it('POST / creates currency', async () => {
    create.mockResolvedValue({ id: 2, code: 'EUR', symbol: '€', rate: 0.68 });
    const res = await request(app).post('/api/').set(auth()).send({ code: 'EUR', symbol: '€', rate: 0.68 });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('EUR');
  });

  it('PUT /:id updates currency', async () => {
    update.mockResolvedValue({ id: 1, rate: 0.75 });
    const res = await request(app).put('/api/1').set(auth()).send({ rate: 0.75 });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id removes currency', async () => {
    del.mockResolvedValue({});
    const res = await request(app).delete('/api/1').set(auth());
    expect(res.status).toBe(200);
  });
});
