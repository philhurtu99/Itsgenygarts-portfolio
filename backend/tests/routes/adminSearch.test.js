import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';
import { makeAdminToken } from '../helpers/adminToken.js';

const customerFindMany = jest.fn();
const orderFindMany = jest.fn();
const customOrderFindMany = jest.fn();
const personalizedQuoteFindMany = jest.fn();
const quoteRequestFindMany = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    customer: { findMany: customerFindMany },
    order: { findMany: orderFindMany },
    customOrder: { findMany: customOrderFindMany },
    personalizedQuote: { findMany: personalizedQuoteFindMany },
    quoteRequest: { findMany: quoteRequestFindMany },
  })),
}));

const router = (await import('../../src/routes/admin/search.js')).default;
const app = buildApp(router);

beforeEach(() => {
  [
    customerFindMany,
    orderFindMany,
    customOrderFindMany,
    personalizedQuoteFindMany,
    quoteRequestFindMany,
  ].forEach((fn) => fn.mockReset());
});

function authedGet(path) {
  return request(app).get(path).set('Cookie', [`auth_admin=${makeAdminToken()}`]);
}

describe('GET /api/ admin search', () => {
  it('requires admin authentication', async () => {
    const res = await request(app).get('/api/?q=alice');
    expect(res.status).toBe(401);
  });

  it('searches customers and transaction sources', async () => {
    customerFindMany.mockResolvedValue([{ id: 1, name: 'Alice', email: 'alice@test.com', createdAt: new Date('2026-01-01') }]);
    orderFindMany.mockResolvedValue([{
      id: 10,
      customerName: 'Alice',
      customerEmail: 'alice@test.com',
      status: 'PAID',
      total: 42.5,
      currency: 'CAD',
      stripeSessionId: 'cs_123',
      stripePaymentId: 'pi_123',
      paidAt: new Date('2026-01-03'),
      createdAt: new Date('2026-01-02'),
      items: [{ id: 1 }, { id: 2 }],
    }]);
    customOrderFindMany.mockResolvedValue([]);
    personalizedQuoteFindMany.mockResolvedValue([]);
    quoteRequestFindMany.mockResolvedValue([]);

    const res = await authedGet('/api/?q=alice&limit=10');

    expect(res.status).toBe(200);
    expect(customerFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
      take: 10,
    }));
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
      take: 10,
    }));
    expect(res.body.data.customers).toHaveLength(1);
    expect(res.body.data.transactions).toEqual([
      expect.objectContaining({
        id: 10,
        type: 'order',
        customerEmail: 'alice@test.com',
        amount: 42.5,
        itemCount: 2,
      }),
    ]);
  });

  it('returns recent records when no query is provided', async () => {
    customerFindMany.mockResolvedValue([]);
    orderFindMany.mockResolvedValue([]);
    customOrderFindMany.mockResolvedValue([]);
    personalizedQuoteFindMany.mockResolvedValue([]);
    quoteRequestFindMany.mockResolvedValue([]);

    const res = await authedGet('/api/');

    expect(res.status).toBe(200);
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { not: 'PENDING' } },
    }));
    expect(res.body.data.query).toBe('');
  });
});
