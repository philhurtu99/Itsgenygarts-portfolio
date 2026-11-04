import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const createOrder = jest.fn();
const findOrder = jest.fn();
const updateOrder = jest.fn();
const createPayment = jest.fn();
const customerUpsert = jest.fn();
const sendEmail = jest.fn();
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: jest.fn(async () => ({ id: 1, role: 'ADMIN', isActive: true })) },
    customOrder: { create: createOrder, findUnique: findOrder, update: updateOrder },
    customOrderPayment: { create: createPayment },
    customer: { upsert: customerUpsert },
  })),
}));
jest.unstable_mockModule('../../../src/services/email.js', () => ({ sendEmail }));
jest.unstable_mockModule('../../../src/services/adminPushNotifications.js', () => ({ notifyPaidCustomOrder: jest.fn() }));
const router = (await import('../../../src/routes/admin/customOrders.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Authorization: `Bearer ${token}` });
const payload = { customerName: 'Alice', description: 'Bandana sur mesure', price: '50', customerLanguage: 'fr' };

beforeEach(() => {
  jest.clearAllMocks();
  createOrder.mockImplementation(async ({ data }) => ({ id: 12, ...data }));
  findOrder.mockResolvedValue({ id: 12, customerName: 'Alice', customerEmail: '', price: 50, amountPaid: 0 });
});

describe('admin custom orders without contact details', () => {
  it('requires admin authentication', async () => {
    const res = await request(app).post('/api/market').send(payload);
    expect(res.status).toBe(401);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('creates an order with only the customer name as contact information', async () => {
    const res = await request(app).post('/api/market').set(auth()).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ customerName: 'Alice', customerEmail: '', customerPhone: null });
    expect(customerUpsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('accepts blank contact fields from the multipart admin form', async () => {
    const req = request(app).post('/api/market').set(auth());
    for (const [key, value] of Object.entries({ ...payload, customerEmail: '   ', customerPhone: '   ' })) req.field(key, value);
    const res = await req;
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ customerEmail: '', customerPhone: null });
  });

  it('still validates an email when one is supplied', async () => {
    const res = await request(app).post('/api/market').set(auth()).send({ ...payload, customerEmail: 'invalid-address' });
    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('retains supplied email and phone details', async () => {
    const res = await request(app).post('/api/market').set(auth()).send({ ...payload, customerEmail: ' Alice@Example.com ', customerPhone: '514 555 1234' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ customerEmail: 'alice@example.com', customerPhone: '514 555 1234' });
  });

  it('still requires the customer name', async () => {
    const res = await request(app).post('/api/market').set(auth()).send({ ...payload, customerName: '  ' });
    expect(res.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['send-email', { subject: 'Suivi', body: 'Votre commande' }],
    ['send-payment-link', {}],
  ])('explains why %s needs an email before sending or creating a payment', async (action, body) => {
    const res = await request(app).post(`/api/12/${action}`).set(auth()).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/courriel/i);
    expect(createPayment).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
