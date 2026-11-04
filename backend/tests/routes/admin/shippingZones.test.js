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
    shippingZone: { findMany, create, update, delete: del },
  })),
}));

const router = (await import('../../../src/routes/admin/shippingZones.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => { [findMany, create, update, del].forEach(fn => fn.mockReset()); });

describe('Admin shipping zones', () => {
  it('GET / returns zones', async () => {
    findMany.mockResolvedValue([{ id: 1, name: 'Canada' }]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST / returns 400 when name or countries missing', async () => {
    const res = await request(app).post('/api/').set(auth()).send({ name: 'QC' });
    expect(res.status).toBe(400);
  });

  it('POST / creates zone', async () => {
    create.mockResolvedValue({ id: 2, name: 'USA', countries: 'US' });
    const res = await request(app).post('/api/').set(auth()).send({ name: 'USA', countries: 'US' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('USA');
  });

  it('PUT /:id updates zone', async () => {
    update.mockResolvedValue({ id: 1, name: 'Updated' });
    const res = await request(app).put('/api/1').set(auth()).send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id removes zone', async () => {
    del.mockResolvedValue({});
    const res = await request(app).delete('/api/1').set(auth());
    expect(res.status).toBe(200);
  });
});
