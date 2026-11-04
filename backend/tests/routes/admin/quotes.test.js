import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const findMany = jest.fn();
const findUnique = jest.fn();
const update = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    quoteRequest: { findMany, findUnique, update },
  })),
}));

const router = (await import('../../../src/routes/admin/quotes.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => { [findMany, findUnique, update].forEach(fn => fn.mockReset()); });

describe('Admin quotes', () => {
  it('GET / returns all quotes', async () => {
    findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /?status=Pending filters by status', async () => {
    findMany.mockResolvedValue([{ id: 1, status: 'Pending' }]);
    const res = await request(app).get('/api/?status=Pending').set(auth());
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'Pending' } }));
    expect(res.status).toBe(200);
  });

  it('GET /:id returns 404 when not found', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/99').set(auth());
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/status updates status', async () => {
    update.mockResolvedValue({ id: 1, status: 'Completed', items: [] });
    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'Completed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Completed');
  });
});
