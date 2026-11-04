import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';

const findMany = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({ productReference: { findMany } })),
}));

const router = (await import('../../src/routes/productReferences.js')).default;
const app = buildApp(router);

beforeEach(() => { findMany.mockReset(); });

describe('GET /api/', () => {
  it('returns all references', async () => {
    findMany.mockResolvedValue([{ id: 1, category: 'Hats' }]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filters by category query param', async () => {
    findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/?category=Hats');
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { category: { equals: 'Hats', mode: 'insensitive' } },
    }));
  });

  it('forwards DB errors', async () => {
    findMany.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/');
    expect(res.status).toBe(500);
  });
});
