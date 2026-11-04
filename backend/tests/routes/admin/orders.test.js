import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';
import { importFeesPolicy } from '../../../src/utils/importFeesPolicy.js';

const findMany = jest.fn();
const findUnique = jest.fn();
const update = jest.fn();
const updateMany = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));
const sendEmail = jest.fn(async () => {});
const createShippoShipment = jest.fn();
const reconcileShippoShipment = jest.fn();
const downloadShippoCommercialInvoice = jest.fn();
const downloadShippoLabel = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    order: { findMany, findUnique, update, updateMany },
  })),
}));
jest.unstable_mockModule('../../../src/services/email.js', () => ({
  sendEmail,
}));
jest.unstable_mockModule('../../../src/services/shippoLabels.js', () => ({
  createShippoShipment,
  reconcileShippoShipment,
  downloadShippoCommercialInvoice,
  downloadShippoLabel,
}));
jest.unstable_mockModule('../../../src/utils/emailTemplate.js', () => ({
  emailHtml: jest.fn(() => '<html>'),
  emailBox: jest.fn((c) => c),
  emailTextBlock: jest.fn((c) => `<p>${c}</p>`),
  emailEscape: jest.fn((c) => String(c || '')),
}));

const router = (await import('../../../src/routes/admin/orders.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => {
  [findMany, findUnique, update, updateMany, sendEmail, createShippoShipment, reconcileShippoShipment, downloadShippoCommercialInvoice, downloadShippoLabel].forEach(fn => fn.mockReset());
  updateMany.mockResolvedValue({ count: 1 });
});

describe('Admin orders', () => {
  it.each(['en', 'fr'])('includes the %s customs reminder and tracking in the shipped system email', async (customerLanguage) => {
    findUnique.mockResolvedValue({ id: 1, status: 'PAID', stripePaymentId: 'pi_test' });
    const notice = importFeesPolicy(customerLanguage).notice;
    update.mockResolvedValue({
      id: 1, status: 'SHIPPED', customerName: 'Alice', customerEmail: 'a@b.com', customerLanguage,
      customerCountry: 'US', importFeesPolicyText: notice, shippingTrackingNumber: 'UPS123', shippingServiceName: 'UPS Standard', items: [],
    });
    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'SHIPPED' });
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      profile: 'system', lang: customerLanguage, text: expect.stringContaining(notice),
    }));
    expect(sendEmail.mock.calls[0][0].text).toContain('UPS123');
  });
  it('GET / returns all orders', async () => {
    findMany.mockResolvedValue([{ id: 1, status: 'PAID' }]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /:id returns 404 when not found', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/99').set(auth());
    expect(res.status).toBe(404);
  });

  it('GET /:id returns order', async () => {
    findUnique.mockResolvedValue({ id: 1, status: 'PAID', items: [] });
    const res = await request(app).get('/api/1').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });

  it('POST /:id/send-email sends a business email to the customer', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      customerName: 'Alice',
      customerEmail: 'a@b.com',
      items: [],
    });

    const res = await request(app)
      .post('/api/1/send-email')
      .set(auth())
      .send({ subject: 'Suivi de votre commande', body: 'Bonjour Alice,\n\nVotre commande avance.' });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      profile: 'business',
      subject: 'Suivi de votre commande',
      text: 'Bonjour Alice,\n\nVotre commande avance.',
    }));
  });

  it('POST /:id/send-email returns 400 when subject or body is missing', async () => {
    const res = await request(app)
      .post('/api/1/send-email')
      .set(auth())
      .send({ subject: '', body: 'Message' });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([null, 'sale@pos.local', 'deleted@anonymized.local'])('does not email a placeholder address %s', async (email) => {
    findUnique.mockResolvedValue({ id: 1, customerEmail: email, items: [] });
    const res = await request(app).post('/api/1/send-email').set(auth()).send({ subject: 'Hello', body: 'Message' });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status returns 400 for invalid status', async () => {
    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'BADSTATUS' });
    expect(res.status).toBe(400);
  });

  it('PATCH /:id/status updates to PAID', async () => {
    findUnique.mockResolvedValue({ id: 1, stripePaymentId: 'pi_test' });
    update.mockResolvedValue({ id: 1, status: 'PAID', items: [] });
    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'PAID' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });

  it('PATCH /:id/status PREPARING sends email', async () => {
    findUnique.mockResolvedValue({ id: 1, stripePaymentId: 'pi_test' });
    const order = {
      id: 1,
      status: 'PREPARING',
      customerName: 'Alice',
      customerEmail: 'a@b.com',
      items: [],
    };
    update.mockResolvedValue(order);
    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'PREPARING' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PREPARING');
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      profile: 'business',
      subject: 'Your order #1 is being prepared',
    }));
  });

  it('PATCH /:id/status SHIPPED sends email', async () => {
    findUnique.mockResolvedValue({ id: 1, stripePaymentId: 'pi_test', shippingTrackingIncluded: true, shippingTrackingNumber: 'PIN123' });
    const order = { id: 1, status: 'SHIPPED', customerName: 'Alice', customerEmail: 'a@b.com', customerAddress: '1 rue', customerCity: 'MTL', customerProvince: 'QC', customerPostalCode: 'H1A', customerCountry: 'CA', shippingServiceName: 'UPS Standard', shippingTrackingNumber: 'PIN123', items: [] };
    update.mockResolvedValue(order);
    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'SHIPPED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SHIPPED');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'SHIPPED', shippingTrackingNumber: 'PIN123' },
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      profile: 'system',
      subject: 'Your order #1 has shipped',
      text: expect.stringContaining('PIN123'),
    }));
    expect(sendEmail.mock.calls[0][0].text).toContain('https://www.ups.com/track?tracknum=PIN123');
  });

  it('PATCH /:id/status refuses tracked shipping without a tracking number', async () => {
    findUnique.mockResolvedValue({
      id: 5,
      stripePaymentId: 'pi_test',
      shippingTrackingIncluded: true,
      shippingTrackingNumber: null,
    });

    const res = await request(app).patch('/api/5/status').set(auth()).send({ status: 'SHIPPED' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/numéro de suivi/i);
    expect(update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status stores an optional tracking number when tracking was selected', async () => {
    findUnique.mockResolvedValue({
      id: 4,
      stripePaymentId: 'pi_test',
      shippingTrackingIncluded: true,
      shippingTrackingNumber: null,
    });
    update.mockResolvedValue({
      id: 4,
      status: 'SHIPPED',
      customerName: 'Alice',
      customerEmail: 'a@b.com',
      customerCountry: 'CA',
      shippingTrackingNumber: 'PIN456',
      items: [],
    });

    const res = await request(app)
      .patch('/api/4/status')
      .set(auth())
      .send({ status: 'SHIPPED', trackingNumber: ' PIN456 ' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'SHIPPED', shippingTrackingNumber: 'PIN456' },
    }));
  });

  it('PATCH /:id/status rejects manual market sales', async () => {
    findUnique.mockResolvedValue({ id: 1, stripePaymentId: 'market-cash-1' });

    const res = await request(app).patch('/api/1/status').set(auth()).send({ status: 'PREPARING' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cette vente sur place est déjà complétée et ne change pas de statut.');
    expect(update).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status rejects completed Tap to Pay market sales', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      stripePaymentId: 'pi_market_terminal',
      stripeSessionId: null,
      paidAt: new Date(),
      customerAddress: 'Vente en personne',
      customerCity: 'Marché',
      customerPostalCode: 'POS',
      customerCountry: 'CA',
    });

    const res = await request(app).patch('/api/2/status').set(auth()).send({ status: 'PREPARING' });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('POST /:id/shipping-label creates and stores a Shippo transaction', async () => {
    findUnique.mockResolvedValue({
      id: 3,
      status: 'PAID',
      shippingProvider: 'SHIPPO',
      items: [],
    });
    createShippoShipment.mockResolvedValue({
      transactionId: 'transaction-3',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://www.ups.com/track?tracknum=TRACK123',
      created: true,
    });
    update.mockResolvedValue({ id: 3, shippingTrackingNumber: 'TRACK123', items: [] });

    const res = await request(app).post('/api/3/shipping-label').set(auth());

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 3 },
      data: expect.objectContaining({
        shippingTrackingNumber: 'TRACK123',
        shippingTransactionId: 'transaction-3',
        shippingLabelPurchaseStartedAt: null,
      }),
    }));
  });

  it('POST /:id/shipping-label blocks a concurrent label purchase', async () => {
    findUnique
      .mockResolvedValueOnce({
        id: 3,
        status: 'PAID',
        shippingProvider: 'SHIPPO',
        shippingTransactionId: null,
        items: [],
      })
      .mockResolvedValueOnce({
        id: 3,
        status: 'PAID',
        shippingTransactionId: null,
        shippingLabelPurchaseStartedAt: new Date(),
        items: [],
      });
    updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await request(app).post('/api/3/shipping-label').set(auth());

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/déjà en cours/i);
    expect(createShippoShipment).not.toHaveBeenCalled();
  });

  it('GET /:id/shipping-label/pdf proxies the label document', async () => {
    findUnique.mockResolvedValue({ id: 3, shippingTrackingNumber: 'TRACK123', shippingTransactionId: 'transaction-3' });
    downloadShippoLabel.mockResolvedValue({ data: Buffer.from('pdf'), contentType: 'application/pdf' });

    const res = await request(app).get('/api/3/shipping-label/pdf').set(auth());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toContain('shippo-TRACK123.pdf');
  });

  it('never expires an old unresolved purchase lock', async () => {
    findUnique.mockResolvedValue({ id: 3, status: 'PAID', shippingProvider: 'SHIPPO', shippingLabelPurchaseStartedAt: new Date('2020-01-01') });
    updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app).post('/api/3/shipping-label').set(auth());
    expect(res.status).toBe(409);
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: 3, shippingTransactionId: null, shippingLabelPurchaseStartedAt: null });
    expect(createShippoShipment).not.toHaveBeenCalled();
  });

  it('keeps the lock after an uncertain purchase', async () => {
    findUnique.mockResolvedValue({ id: 3, status: 'PAID', shippingProvider: 'SHIPPO' });
    createShippoShipment.mockRejectedValue(Object.assign(new Error('uncertain'), { statusCode: 502, purchaseOutcomeUnknown: true }));
    const res = await request(app).post('/api/3/shipping-label').set(auth());
    expect(res.status).toBe(502);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('persists references and keeps the lock if the final save fails', async () => {
    findUnique.mockResolvedValue({ id: 3, status: 'PAID', shippingProvider: 'SHIPPO' });
    update.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('DB failed'));
    createShippoShipment.mockImplementation(async (_, callbacks) => {
      await callbacks.onRate('rate-3');
      await callbacks.onTransaction('transaction-3');
      return { created: true, transactionId: 'transaction-3', trackingNumber: 'TRACK3' };
    });
    const res = await request(app).post('/api/3/shipping-label').set(auth());
    expect(res.status).toBe(500);
    expect(update.mock.calls[0][0].data).toEqual({ shippingRateId: 'rate-3' });
    expect(update.mock.calls[1][0].data).toEqual({ shippingTransactionId: 'transaction-3' });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after a definitive rejection', async () => {
    findUnique.mockResolvedValue({ id: 3, status: 'PAID', shippingProvider: 'SHIPPO' });
    createShippoShipment.mockRejectedValue(Object.assign(new Error('rejected'), { statusCode: 402, purchaseRejected: true }));
    const res = await request(app).post('/api/3/shipping-label').set(auth());
    expect(res.status).toBe(402);
    expect(updateMany.mock.calls[1][0].data).toEqual({ shippingLabelPurchaseStartedAt: null, shippingTransactionId: null });
  });

  it('recovers an existing label without creating a transaction', async () => {
    const pending = { id: 3, status: 'PAID', shippingProvider: 'SHIPPO', shippingTransactionId: 'transaction-3', shippingLabelPurchaseStartedAt: new Date() };
    findUnique.mockResolvedValue(pending);
    reconcileShippoShipment.mockResolvedValue({ transactionId: 'transaction-3', trackingNumber: 'TRACK3', trackingUrl: null });
    update.mockResolvedValue({ ...pending, shippingTrackingNumber: 'TRACK3' });
    const res = await request(app).post('/api/3/shipping-label/reconcile').set(auth()).send({ transactionId: 'ignored' });
    expect(res.status).toBe(200);
    expect(reconcileShippoShipment).toHaveBeenCalledWith(pending, 'transaction-3');
    expect(createShippoShipment).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.shippingLabelPurchaseStartedAt).toBeNull();
  });

  it('does not unlock a mismatched recovery', async () => {
    findUnique.mockResolvedValue({ id: 3, status: 'PAID', shippingProvider: 'SHIPPO', shippingLabelPurchaseStartedAt: new Date() });
    reconcileShippoShipment.mockRejectedValue(Object.assign(new Error('mismatch'), { statusCode: 409 }));
    const res = await request(app).post('/api/3/shipping-label/reconcile').set(auth()).send({ transactionId: 'other' });
    expect(res.status).toBe(409);
    expect(updateMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not clear a newer purchase when an older rejected recovery finishes late', async () => {
    const started = new Date('2026-10-06T12:00:00Z');
    findUnique.mockResolvedValue({ id: 3, shippingProvider: 'SHIPPO', shippingTransactionId: 'old-transaction', shippingLabelPurchaseStartedAt: started });
    reconcileShippoShipment.mockRejectedValue(Object.assign(new Error('rejected'), { statusCode: 502, purchaseRejected: true }));
    await request(app).post('/api/3/shipping-label/reconcile').set(auth()).send({});
    expect(updateMany.mock.calls[0][0].where).toEqual({
      id: 3, shippingLabelCreatedAt: null, shippingTransactionId: 'old-transaction', shippingLabelPurchaseStartedAt: started,
    });
  });

  it('GET /:id/shipping-label/commercial-invoice/pdf proxies the customs document', async () => {
    findUnique.mockResolvedValue({
      id: 3,
      customerCountry: 'US',
      shippingTrackingNumber: 'TRACK123',
      shippingTransactionId: 'transaction-3',
    });
    downloadShippoCommercialInvoice.mockResolvedValue({ data: Buffer.from('pdf'), contentType: 'application/pdf' });

    const res = await request(app).get('/api/3/shipping-label/commercial-invoice/pdf').set(auth());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toContain('facture-commerciale-TRACK123.pdf');
  });
});
