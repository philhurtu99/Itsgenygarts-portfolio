import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import errorHandler from '../../../src/middleware/errorHandler.js';

const orderUpdateMany = jest.fn();
const orderFindUnique = jest.fn();
const customerUpsert = jest.fn();
const customOrderUpdate = jest.fn();
const customOrderFindUnique = jest.fn();
const personalizedQuoteUpdate = jest.fn();
const userFindMany = jest.fn();
const yarnProductFindUnique = jest.fn();
const yarnProductUpdate = jest.fn();
const prismaTransaction = jest.fn();
const mockConstructEvent = jest.fn();
const getStripeInvoiceData = jest.fn();
const generateInvoicePDF = jest.fn(async () => Buffer.from('%PDF'));
const sendEmail = jest.fn(async () => {});
const discardPendingOrder = jest.fn(async () => true);
const reserveStockForOrder = jest.fn(async () => {});
const notifyPaidCustomOrder = jest.fn(async () => ({ sent: 1 }));
const notifyPaidRegularOrder = jest.fn(async () => ({ sent: 1 }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    order: { updateMany: orderUpdateMany, findUnique: orderFindUnique },
    customer: { upsert: customerUpsert },
    customOrder: { update: customOrderUpdate, findUnique: customOrderFindUnique },
    personalizedQuote: { update: personalizedQuoteUpdate },
    user: { findMany: userFindMany },
    yarnProduct: { findUnique: yarnProductFindUnique, update: yarnProductUpdate },
    $transaction: prismaTransaction,
  })),
}));
jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => ({ webhooks: { constructEvent: mockConstructEvent } })),
}));
jest.unstable_mockModule('../../../src/services/stock.js', () => ({
  reserveStockForOrder,
  commitStockForOrder: jest.fn(async () => {}),
}));
jest.unstable_mockModule('../../../src/services/pendingOrders.js', () => ({
  discardPendingOrder,
}));
jest.unstable_mockModule('../../../src/services/adminPushNotifications.js', () => ({
  notifyPaidCustomOrder,
  notifyPaidRegularOrder,
}));
jest.unstable_mockModule('../../../src/services/invoice.js', () => ({
  generateInvoicePDF,
  invoiceNumber: jest.fn(() => 'FACT-2025-000001'),
}));
jest.unstable_mockModule('../../../src/services/stripeInvoice.js', () => ({
  getStripeInvoiceData,
}));
jest.unstable_mockModule('../../../src/services/email.js', () => ({
  sendEmail,
}));
jest.unstable_mockModule('../../../src/utils/emailTemplate.js', () => ({
  emailHtml: jest.fn(() => '<html>'),
  emailBox: jest.fn((c) => c),
  emailButton: jest.fn((text, href) => `<a href="${href}">${text}</a>`),
  emailEscape: jest.fn((c) => String(c || '')),
}));
jest.unstable_mockModule('@sentry/node', () => ({
  captureException: jest.fn(),
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';

const router = (await import('../../../src/routes/webhooks/stripe.js')).default;

function buildWebhookApp(r) {
  const app = express();
  app.use('/api', express.raw({ type: 'application/json' }));
  app.use('/api', r);
  app.use(errorHandler);
  return app;
}
const app = buildWebhookApp(router);
const ORIGINAL_BUSINESS_EMAIL = process.env.BUSINESS_EMAIL;

beforeEach(() => {
  [orderUpdateMany, orderFindUnique, customerUpsert, customOrderUpdate, customOrderFindUnique, personalizedQuoteUpdate, userFindMany, yarnProductFindUnique, yarnProductUpdate, prismaTransaction, mockConstructEvent, getStripeInvoiceData, generateInvoicePDF, sendEmail, discardPendingOrder, reserveStockForOrder, notifyPaidCustomOrder, notifyPaidRegularOrder].forEach(fn => fn.mockReset());
  generateInvoicePDF.mockResolvedValue(Buffer.from('%PDF'));
  getStripeInvoiceData.mockResolvedValue(null);
  userFindMany.mockResolvedValue([]);
  discardPendingOrder.mockResolvedValue(true);
  reserveStockForOrder.mockResolvedValue(undefined);
  notifyPaidCustomOrder.mockResolvedValue({ sent: 1 });
  notifyPaidRegularOrder.mockResolvedValue({ sent: 1 });
  customerUpsert.mockResolvedValue({ id: 1, email: 'a@b.com', newsletterConsent: true });
  customOrderFindUnique.mockResolvedValue({ id: 7, status: 'AWAITING_PAYMENT', price: 75, amountPaid: 0 });
  personalizedQuoteUpdate.mockResolvedValue({ id: 8, status: 'PAID' });
  yarnProductFindUnique.mockResolvedValue({
    id: 7,
    stockQuantity: 2,
    soldOut: false,
    isDeleted: false,
  });
  yarnProductUpdate.mockResolvedValue({
    id: 7,
    stockQuantity: 1,
    soldOut: false,
  });
  prismaTransaction.mockImplementation(async (arg) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg({
      yarnProduct: {
        findUnique: yarnProductFindUnique,
        update: yarnProductUpdate,
      },
    });
  });
  process.env.BUSINESS_EMAIL = ORIGINAL_BUSINESS_EMAIL;
});

async function flushAsyncWork() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

describe('POST /api/ (Stripe webhook)', () => {
  it('returns 400 on invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
    const res = await request(app).post('/api/').set('stripe-signature', 'bad').send(Buffer.from('{}'));
    expect(res.status).toBe(400);
  });

  it('returns 200 and ignores unknown event types', async () => {
    mockConstructEvent.mockReturnValue({ type: 'unknown.event', data: { object: {} } });
    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
  });

  it('handles checkout.session.completed and marks order PAID', async () => {
    process.env.BUSINESS_EMAIL = 'orders@test.local';
    userFindMany.mockResolvedValue([{ email: 'admin@test.local' }]);
    const fakeOrder = {
      id: 1, status: 'PENDING', customerEmail: 'a@b.com', customerName: 'Alice',
      customerAddress: '1 rue', customerCity: 'MTL', customerProvince: 'QC',
      customerPostalCode: 'H1A', customerCountry: 'CA', total: 50, currency: 'CAD',
      stripeSessionId: 'cs_order', stripePaymentId: 'pi_order', items: [],
    };
    const stripeInvoiceData = { provider: 'Stripe', invoiceId: 'in_123' };
    getStripeInvoiceData.mockResolvedValue(stripeInvoiceData);
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { orderId: '1' }, payment_status: 'paid' } },
    });
    orderUpdateMany.mockResolvedValue({ count: 1 });
    orderFindUnique
      .mockResolvedValueOnce({ ...fakeOrder, reservations: [] })
      .mockResolvedValueOnce({ ...fakeOrder, status: 'PAID' });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    await flushAsyncWork();
    expect(getStripeInvoiceData).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(generateInvoicePDF).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), stripeInvoiceData);
    expect(userFindMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['orders@test.local', 'admin@test.local'],
      subject: 'Nouvelle commande payée #1',
    }));
  });

  it('allows draft stock only for a payment created by the admin market flow', async () => {
    const pendingOrder = {
      id: 17,
      status: 'PENDING',
      customerEmail: 'market@pos.local',
      customerName: 'Marché',
      total: 20,
      currency: 'CAD',
      reservations: [],
      items: [{ productId: 17, productVariantId: 22, quantity: 1 }],
    };
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_market',
          metadata: { orderId: '17', source: 'admin-market-cart-payment-link' },
          payment_status: 'paid',
        },
      },
    });
    orderUpdateMany.mockResolvedValue({ count: 1 });
    orderFindUnique
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({ ...pendingOrder, status: 'PAID' });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      17,
      [{ productId: 17, productVariantId: 22, quantity: 1 }],
      { allowDraft: true },
    );
  });

  it('stores newsletter consent from Stripe Checkout promotion opt-in', async () => {
    const fakeOrder = {
      id: 1, status: 'PENDING', customerEmail: 'a@b.com', customerName: 'Alice',
      customerAddress: '1 rue', customerCity: 'MTL', customerProvince: 'QC',
      customerPostalCode: 'H1A', customerCountry: 'CA', total: 50, currency: 'CAD',
      stripeSessionId: 'cs_order', stripePaymentId: 'pi_order', items: [], reservations: [],
    };
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_order',
          metadata: { orderId: '1' },
          payment_status: 'paid',
          consent: { promotions: 'opt_in' },
          customer_details: { email: 'A@B.COM', name: 'Alice' },
        },
      },
    });
    orderFindUnique
      .mockResolvedValueOnce(fakeOrder)
      .mockResolvedValueOnce({ ...fakeOrder, status: 'PAID' });
    orderUpdateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(customerUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'a@b.com' },
      update: { newsletterConsent: true },
      create: expect.objectContaining({ email: 'a@b.com', name: 'Alice', newsletterConsent: true }),
    }));
  });

  it('marks custom orders PAID from completed paid checkout sessions', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_custom',
          payment_intent: 'pi_custom',
          payment_status: 'paid',
          metadata: { customOrderId: '7' },
        },
      },
    });
    customOrderUpdate.mockResolvedValue({
      id: 7,
      customerName: 'Alice',
      status: 'PAID',
      paymentStatus: 'PAID',
      price: 75,
      amountPaid: 75,
    });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(customOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({
        status: 'PAID',
        stripePaymentId: 'pi_custom',
      }),
    }));
    expect(notifyPaidCustomOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 7, paymentStatus: 'PAID' }),
      expect.objectContaining({ amount: 75, kind: 'FULL' }),
    );
  });

  it('does not mark custom orders paid from unpaid checkout sessions', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_custom',
          payment_status: 'unpaid',
          metadata: { customOrderId: '7' },
        },
      },
    });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(customOrderUpdate).not.toHaveBeenCalled();
  });

  it('marks personalized quotes PAID from completed paid checkout sessions', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_quote',
          payment_intent: 'pi_quote',
          payment_status: 'paid',
          metadata: { personalizedQuoteId: '8' },
        },
      },
    });
    personalizedQuoteUpdate.mockResolvedValue({ id: 8, status: 'PAID' });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(personalizedQuoteUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 8 },
      data: expect.objectContaining({
        status: 'PAID',
        stripePaymentId: 'pi_quote',
      }),
    }));
  });

  it('does not mark personalized quotes paid from unpaid checkout sessions', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_quote',
          payment_status: 'unpaid',
          metadata: { personalizedQuoteId: '8' },
        },
      },
    });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(personalizedQuoteUpdate).not.toHaveBeenCalled();
  });

  it('marks custom orders PAID from payment intent success metadata', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_custom',
          created: 1767225600,
          metadata: { customOrderId: '7' },
        },
      },
    });
    customOrderUpdate.mockResolvedValue({ id: 7, status: 'PAID' });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(customOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({
        status: 'PAID',
        stripePaymentId: 'pi_custom',
      }),
    }));
  });

  it('marks personalized quotes PAID from payment intent success metadata', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_quote',
          created: 1767225600,
          metadata: { personalizedQuoteId: '8' },
        },
      },
    });
    personalizedQuoteUpdate.mockResolvedValue({ id: 8, status: 'PAID' });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(personalizedQuoteUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 8 },
      data: expect.objectContaining({
        status: 'PAID',
        stripePaymentId: 'pi_quote',
      }),
    }));
  });

  it('decrements singular yarn stock before marking a yarn payment intent order paid', async () => {
    const fakeOrder = {
      id: 5, status: 'PENDING', customerEmail: 'client@test.com', customerName: 'Alice',
      customerAddress: 'Vente en personne', customerCity: 'Marché',
      customerPostalCode: 'POS', customerCountry: 'CA', total: 12, currency: 'CAD',
      stripePaymentId: 'pi_yarn', items: [{ productId: null, productName: 'Laine - Merino', quantity: 1 }], reservations: [],
    };
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_yarn',
          created: 1767225600,
          metadata: { orderId: '5', yarnProductId: '7', source: 'admin-yarn-tap-to-pay' },
        },
      },
    });
    orderFindUnique
      .mockResolvedValueOnce({ status: 'PENDING' })
      .mockResolvedValueOnce(fakeOrder)
      .mockResolvedValueOnce({ ...fakeOrder, status: 'PAID' });
    orderUpdateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(yarnProductUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: { stockQuantity: 1, soldOut: false },
    }));
    expect(orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5, status: 'PENDING' },
    }));
    expect(yarnProductUpdate.mock.invocationCallOrder[0]).toBeLessThan(orderUpdateMany.mock.invocationCallOrder[0]);
  });

  it('decrements singular yarn stock only once from a completed checkout session', async () => {
    const fakeOrder = {
      id: 6, status: 'PENDING', customerEmail: 'client@test.com', customerName: 'Alice',
      customerAddress: 'Adresse à confirmer', customerCity: 'MTL',
      customerPostalCode: 'H1A', customerCountry: 'CA', total: 12, currency: 'CAD',
      stripeSessionId: 'cs_yarn', stripePaymentId: 'pi_yarn', items: [{ productId: null, productName: 'Laine - Merino', quantity: 1 }], reservations: [],
    };
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_yarn',
          payment_intent: 'pi_yarn',
          payment_status: 'paid',
          metadata: { orderId: '6', yarnProductId: '7', source: 'admin-yarn-payment-link' },
        },
      },
    });
    orderFindUnique
      .mockResolvedValueOnce({ status: 'PENDING' })
      .mockResolvedValueOnce(fakeOrder)
      .mockResolvedValueOnce({ ...fakeOrder, status: 'PAID' });
    orderUpdateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(yarnProductUpdate).toHaveBeenCalledTimes(1);
    expect(yarnProductUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: { stockQuantity: 1, soldOut: false },
    }));
  });

  it('does not decrement yarn stock again when a duplicate event arrives for an already paid order', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_yarn',
          metadata: { orderId: '5', yarnProductId: '7', source: 'admin-yarn-tap-to-pay' },
        },
      },
    });
    orderFindUnique.mockResolvedValueOnce({ status: 'PAID' });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(yarnProductUpdate).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('discards abandoned regular orders when checkout sessions expire', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_expired',
          metadata: { orderId: '9' },
        },
      },
    });

    const res = await request(app).post('/api/').set('stripe-signature', 'sig').send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(discardPendingOrder).toHaveBeenCalledWith(9);
  });
});
