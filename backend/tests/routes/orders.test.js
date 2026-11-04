import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { buildApp } from '../helpers/app.js';
import { IMPORT_FEES_POLICY_VERSION, importFeesPolicy } from '../../src/utils/importFeesPolicy.js';

const currencyFindMany = jest.fn();
const currencyFindUnique = jest.fn();
const productFindMany = jest.fn();
const orderCreate = jest.fn();
const orderDelete = jest.fn();
const orderFindUnique = jest.fn();
const orderUpdateMany = jest.fn();
const reserveStockForOrder = jest.fn(async () => {});
const releaseStockForOrder = jest.fn(async () => {});
const discardPendingOrder = jest.fn(async () => true);
const quoteShipping = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    currencyRate: { findMany: currencyFindMany, findUnique: currencyFindUnique },
    product: { findMany: productFindMany },
    order: { create: orderCreate, delete: orderDelete, findUnique: orderFindUnique, updateMany: orderUpdateMany },
  })),
}));

jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/stock.js', () => ({
  commitStockForOrder: jest.fn(async () => {}),
  releaseStockForOrder,
  reserveStockForOrder,
  RESERVATION_MINUTES: 15,
}));

jest.unstable_mockModule('../../src/services/pendingOrders.js', () => ({
  discardPendingOrder,
}));

jest.unstable_mockModule('../../src/services/shipping.js', () => ({
  quoteShipping,
}));

const router = (await import('../../src/routes/orders.js')).default;
const app = buildApp(router);

beforeEach(() => {
  [currencyFindMany, currencyFindUnique, productFindMany, orderCreate, orderDelete, orderFindUnique, orderUpdateMany, reserveStockForOrder, releaseStockForOrder, discardPendingOrder, quoteShipping].forEach(fn => fn.mockReset());
  orderCreate.mockResolvedValue({ id: 55, items: [] });
  orderDelete.mockResolvedValue({});
  reserveStockForOrder.mockResolvedValue(undefined);
  releaseStockForOrder.mockResolvedValue(undefined);
  discardPendingOrder.mockResolvedValue(true);
  quoteShipping.mockResolvedValue({
    options: [{
      rateId: 'ups-rate', provider: 'SHIPPO', serviceCode: 'SHIPPO_UPS_UPS_STANDARD_CA', serviceName: 'UPS · Standard®',
      amountCad: 12.5, trackingIncluded: true, estimatedDays: 2,
    }],
    package: { weightGrams: 350, weightKg: 0.35, lengthCm: 25, widthCm: 20, heightCm: 8 },
    providerConfigured: true,
  });
});

describe('GET /api/currencies', () => {
  it('returns active currencies', async () => {
    currencyFindMany.mockResolvedValue([{ code: 'CAD', rate: 1 }]);
    const res = await request(app).get('/api/currencies');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/calculate-shipping', () => {
  it.each(['US', ' us ', 'USA', 'United States', 'États-Unis'])('blocks US destination %s before any quote or database query', async (country) => {
    const res = await request(app).post('/api/calculate-shipping').send({ items: [{ productId: 1 }], country, customerLanguage: 'fr' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/États-Unis.*suspendue/);
    expect(productFindMany).not.toHaveBeenCalled();
    expect(quoteShipping).not.toHaveBeenCalled();
  });
  it.each(['en', 'fr'])('returns the current international notice in %s', async (customerLanguage) => {
    productFindMany.mockResolvedValue([]);
    const res = await request(app).post('/api/calculate-shipping').send({ items: [{ productId: 1 }], country: 'FR', customerLanguage });
    expect(res.status).toBe(200);
    expect(res.body.data.importFeesPolicy).toEqual(importFeesPolicy(customerLanguage));
  });
  it('returns 400 when items is not an array', async () => {
    const res = await request(app).post('/api/calculate-shipping').send({ items: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns shipping options and selects tracked shipping by default', async () => {
    productFindMany.mockResolvedValue([{ id: 1, packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8 }]);
    const res = await request(app).post('/api/calculate-shipping').send({
      items: [{ productId: 1 }],
      country: 'CA',
      province: 'QC',
      postalCode: 'H2X 1Y4',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.shippingTotal).toBe(12.5);
    expect(res.body.data.importFeesPolicy).toBeNull();
    expect(res.body.data.defaultServiceCode).toBe('SHIPPO_UPS_UPS_STANDARD_CA');
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [1] }, isDeleted: false, isDraft: false },
    }));
    expect(quoteShipping).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({ country: 'CA', province: 'QC', postalCode: 'H2X 1Y4' }),
    }));
  });

  it('passes missing products to the shipping validator', async () => {
    productFindMany.mockResolvedValue([]);
    quoteShipping.mockRejectedValue(Object.assign(new Error('Produit introuvable (ID 99)'), { statusCode: 400 }));
    const res = await request(app).post('/api/calculate-shipping').send({
      items: [{ productId: 99 }],
      country: 'CA',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/checkout', () => {
  it.each(['en', 'fr'])('blocks US checkout in %s even with a supplied rate and customs consent, before stock reservation', async (customerLanguage) => {
    const res = await request(app).post('/api/checkout').send({
      items: [{ productId: 1 }], customerCountry: 'US', customerLanguage,
      shippingServiceCode: 'forged-rate', importFeesAccepted: true, importFeesPolicyVersion: IMPORT_FEES_POLICY_VERSION,
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(customerLanguage === 'en' ? /United States.*unavailable/ : /États-Unis.*suspendue/);
    expect(productFindMany).not.toHaveBeenCalled();
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
    expect(reserveStockForOrder).not.toHaveBeenCalled();
  });
  const internationalCheckout = {
    items: [{ productId: 1 }], customerName: 'Alice', customerEmail: 'alice@example.com',
    customerAddress: '123 Broadway', customerCity: 'New York', customerProvince: 'NY',
    customerPostalCode: '10001', customerCountry: 'FR', customerPhone: '33142345678',
  };

  it.each([undefined, false, 'true', 1])('rejects international checkout without explicit boolean consent (%s) before quoting or reserving', async (accepted) => {
    const res = await request(app).post('/api/checkout').send({
      ...internationalCheckout, importFeesAccepted: accepted, importFeesPolicyVersion: IMPORT_FEES_POLICY_VERSION,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/accept.*import fees/i);
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
    expect(reserveStockForOrder).not.toHaveBeenCalled();
  });

  it('rejects an old notice version', async () => {
    const res = await request(app).post('/api/checkout').send({
      ...internationalCheckout, importFeesAccepted: true, importFeesPolicyVersion: 'old', customerLanguage: 'fr',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/avertissement actuel/);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it.each(['en', 'fr'])('records the server time and exact %s policy, not client-supplied evidence', async (customerLanguage) => {
    productFindMany.mockResolvedValue([{ id: 1, name: 'Hat', price: 25, variants: [] }]);
    const before = Date.now();
    const res = await request(app).post('/api/checkout').send({
      ...internationalCheckout, customerLanguage,
      importFeesAccepted: true, importFeesPolicyVersion: IMPORT_FEES_POLICY_VERSION,
      importFeesAcceptedAt: '2000-01-01', importFeesPolicyText: 'fake', importFeesPolicyLanguage: 'fake',
    });
    expect(res.status).toBe(201);
    const { data } = orderCreate.mock.calls[0][0];
    expect(data.importFeesAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.importFeesPolicyVersion).toBe(IMPORT_FEES_POLICY_VERSION);
    expect(data.importFeesPolicyLanguage).toBe(customerLanguage);
    expect(data.importFeesPolicyText).toBe(importFeesPolicy(customerLanguage).notice);
  });

  it('does not attach customs consent to a domestic order, even if the client sends it', async () => {
    productFindMany.mockResolvedValue([{ id: 1, name: 'Hat', price: 25, variants: [] }]);
    const res = await request(app).post('/api/checkout').send({
      ...internationalCheckout, customerCountry: 'CA', importFeesAccepted: true, importFeesPolicyVersion: IMPORT_FEES_POLICY_VERSION,
    });
    expect(res.status).toBe(201);
    expect(orderCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({
      importFeesAcceptedAt: null, importFeesPolicyVersion: null, importFeesPolicyLanguage: null, importFeesPolicyText: null,
    }));
  });
  it('returns 400 when cart is empty', async () => {
    const res = await request(app).post('/api/checkout').send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty/i);
  });

  it('returns 400 when customer info is missing', async () => {
    const res = await request(app).post('/api/checkout').send({
      items: [{ productId: 1, quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 400 when product not found', async () => {
    productFindMany.mockResolvedValue([]);
    const res = await request(app).post('/api/checkout').send({
      items: [{ productId: 99, quantity: 1 }],
      customerName: 'Alice', customerEmail: 'a@b.com',
      customerAddress: '1 rue', customerCity: 'MTL',
      customerPostalCode: 'H1A', customerCountry: 'CA',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/introuvable/);
  });

  it('keeps the sole variant id for stock without snapshotting Variation A', async () => {
    productFindMany.mockResolvedValue([{
      id: 1,
      name: 'Hat',
      price: 25,
      mainImageUrl: 'http://cdn/hat.jpg',
      shippingQC: 0,
      shippingCA: 0,
      shippingUS: 0,
      shippingINT: 0,
      variants: [{ id: 10, status: 'AVAILABLE', sortOrder: 0, images: [] }],
    }]);

    const res = await request(app).post('/api/checkout').send({
      items: [{ productId: 1, productVariantId: 10, quantity: 1 }],
      customerName: 'Alice',
      customerEmail: 'a@b.com',
      customerAddress: '1 rue',
      customerCity: 'MTL',
      customerProvince: 'QC',
      customerPostalCode: 'H1A',
      customerCountry: 'CA',
      shippingServiceCode: 'SHIPPO_UPS_UPS_STANDARD_CA',
    });

    expect(res.status).toBe(201);
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [1] }, isDeleted: false, isDraft: false },
    }));
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        items: {
          create: [
            expect.objectContaining({
              productVariantId: 10,
              variantLabelSnapshot: null,
            }),
          ],
        },
        shippingTotal: 12.5,
        shippingProvider: 'SHIPPO',
        shippingServiceCode: 'SHIPPO_UPS_UPS_STANDARD_CA',
        shippingRateId: 'ups-rate',
        shippingTrackingIncluded: true,
      }),
      include: { items: true },
    }));
    expect(reserveStockForOrder).toHaveBeenCalledWith(55, [{ productId: 1, productVariantId: 10, quantity: 1 }]);
  });

  it('rejects a shipping service that was not returned by the server quote', async () => {
    productFindMany.mockResolvedValue([{
      id: 1, name: 'Hat', price: 25, mainImageUrl: null, variants: [],
    }]);
    const res = await request(app).post('/api/checkout').send({
      items: [{ productId: 1, quantity: 1 }],
      customerName: 'Alice', customerEmail: 'a@b.com',
      customerAddress: '1 rue', customerCity: 'MTL', customerProvince: 'QC',
      customerPostalCode: 'H2X1Y4', customerCountry: 'CA',
      shippingServiceCode: 'FAKE.FREE',
    });

    expect(res.status).toBe(400);
    expect(orderCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/cancel-pending', () => {
  function cancelToken(orderId) {
    return jwt.sign({ type: 'order-cancel', orderId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  }

  it('returns 400 when the cancel token is invalid', async () => {
    const res = await request(app)
      .post('/api/cancel-pending')
      .send({ token: 'bad' });
    expect(res.status).toBe(400);
  });

  it('discards a pending order and releases its stock reservation', async () => {
    orderFindUnique.mockResolvedValue({
      id: 7,
      status: 'PENDING',
      stripeSessionId: 'cs_123',
    });

    const res = await request(app)
      .post('/api/cancel-pending')
      .send({ token: cancelToken(7) });

    expect(res.status).toBe(200);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(releaseStockForOrder).not.toHaveBeenCalled();
    expect(discardPendingOrder).toHaveBeenCalledWith(7);
    expect(res.body.data).toEqual({ cancelled: true, discarded: true, status: 'DISCARDED' });
  });

  it('does not release stock when the order is no longer pending', async () => {
    orderFindUnique.mockResolvedValue({
      id: 7,
      status: 'PAID',
      stripeSessionId: 'cs_123',
    });

    const res = await request(app)
      .post('/api/cancel-pending')
      .send({ token: cancelToken(7) });

    expect(res.status).toBe(200);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(releaseStockForOrder).not.toHaveBeenCalled();
    expect(discardPendingOrder).not.toHaveBeenCalled();
    expect(res.body.data).toEqual({ cancelled: false, status: 'PAID' });
  });
});
