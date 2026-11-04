import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';

const queryRaw = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({ $queryRaw: queryRaw })),
}));

const router = (await import('../../src/routes/health.js')).default;
const app = buildApp(router);

describe('GET /api/', () => {
  it('returns 200 and status ok when DB is reachable', async () => {
    queryRaw.mockResolvedValue([{ 1: 1 }]);
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toBe('ok');
  });

  it('returns 503 and degraded when DB is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/api/');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toMatch(/error/);
  });
});
