import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';

const productFindMany = jest.fn();
const quoteCreate = jest.fn();
const quoteFindMany = jest.fn();
const quoteFindUnique = jest.fn();
const sendEmail = jest.fn(async () => {});
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    product: { findMany: productFindMany },
    quoteRequest: { create: quoteCreate, findMany: quoteFindMany, findUnique: quoteFindUnique },
  })),
}));

jest.unstable_mockModule('../../src/services/email.js', () => ({
  sendEmail,
}));

const router = (await import('../../src/routes/quotes.js')).default;
const app = buildApp(router);

const validBody = {
  customerName: 'Alice',
  customerEmail: 'alice@test.com',
  shippingAddress: '1 rue du test',
  city: 'Montreal',
  postalCode: 'H1A1A1',
  country: 'CA',
  items: [{ productId: 1, quantity: 1 }],
};

beforeEach(() => {
  [productFindMany, quoteCreate, quoteFindMany, quoteFindUnique, sendEmail].forEach(fn => fn.mockReset());
});

describe('POST /api/', () => {
  it('blocks US quote requests before creating or notifying', async () => {
    const res = await request(app).post('/api/').send({ ...validBody, country: 'US' });
    expect(res.status).toBe(422);
    expect(quoteCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/').send({ customerName: 'Alice' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when items are empty', async () => {
    const res = await request(app).post('/api/').send({ ...validBody, items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when product not found', async () => {
    productFindMany.mockResolvedValue([]);
    const res = await request(app).post('/api/').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/not found/);
  });

  it('returns 400 when product is sold out', async () => {
    productFindMany.mockResolvedValue([{ id: 1, name: 'Hat', soldOut: true, price: 20 }]);
    const res = await request(app).post('/api/').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/sold out/);
  });

  it('creates quote and returns 201', async () => {
    productFindMany.mockResolvedValue([{ id: 1, name: 'Hat', soldOut: false, price: 20, mainImageUrl: null }]);
    quoteCreate.mockResolvedValue({ id: 10, ...validBody, totalAmount: 20, items: [] });
    const res = await request(app).post('/api/').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(10);
    expect(productFindMany).toHaveBeenCalledWith({
      where: { id: { in: [1] }, isDeleted: false, isDraft: false },
    });
  });
});

describe('GET /api/', () => {
  it('requires admin auth', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(401);
    expect(quoteFindMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/:id', () => {
  it('requires admin auth', async () => {
    const res = await request(app).get('/api/99');
    expect(res.status).toBe(401);
    expect(quoteFindUnique).not.toHaveBeenCalled();
  });
});
