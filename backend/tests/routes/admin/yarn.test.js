import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const userFindUnique = jest.fn(async () => ({
  id: 1,
  email: 'admin@test.com',
  username: 'admin',
  role: 'ADMIN',
  isActive: true,
}));
const yarnFindUnique = jest.fn();
const yarnUpdate = jest.fn();
const yarnCreate = jest.fn();
const yarnCategoryFindUnique = jest.fn();
const orderCreate = jest.fn();
const orderFindUnique = jest.fn();
const orderDelete = jest.fn();
const paymentIntentRetrieve = jest.fn();
const paymentIntentCancel = jest.fn();
const markRegularOrderPaid = jest.fn();
const discardPendingOrder = jest.fn();
const customerUpsert = jest.fn();
const $transaction = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    yarnProduct: {
      findMany: jest.fn(),
      findUnique: yarnFindUnique,
      create: yarnCreate,
      update: yarnUpdate,
    },
    order: {
      create: orderCreate,
      findUnique: orderFindUnique,
      delete: orderDelete,
    },
    customer: { upsert: customerUpsert },
    yarnCategory: {
      findUnique: yarnCategoryFindUnique,
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    yarnImage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    user: { findUnique: userFindUnique, findMany: jest.fn(async () => []) },
    $transaction,
  })),
}));

jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => ({
    paymentIntents: {
      retrieve: paymentIntentRetrieve,
      cancel: paymentIntentCancel,
    },
  })),
}));
jest.unstable_mockModule('../../../src/services/cloudinary.js', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));
jest.unstable_mockModule('../../../src/services/email.js', () => ({
  sendEmail: jest.fn(),
}));
jest.unstable_mockModule('../../../src/services/orderEmails.js', () => ({
  sendPaidOrderEmails: jest.fn(),
}));
jest.unstable_mockModule('../../../src/services/regularOrderPayment.js', () => ({
  markRegularOrderPaid,
}));
jest.unstable_mockModule('../../../src/services/pendingOrders.js', () => ({
  discardPendingOrder,
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
const router = (await import('../../../src/routes/admin/yarn.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => {
  [userFindUnique, yarnFindUnique, yarnUpdate, yarnCreate, yarnCategoryFindUnique, orderCreate, orderFindUnique, orderDelete, paymentIntentRetrieve, paymentIntentCancel, markRegularOrderPaid, discardPendingOrder, customerUpsert, $transaction].forEach((fn) => fn.mockReset());
  userFindUnique.mockResolvedValue({
    id: 1,
    email: 'admin@test.com',
    username: 'admin',
    role: 'ADMIN',
    isActive: true,
  });
  orderCreate.mockResolvedValue({
    id: 22,
    customerEmail: 'yarn-market-sale@test.local',
    items: [{ productId: null, productName: 'Laine - Laine rose', quantity: 1 }],
  });
  orderFindUnique.mockResolvedValue({
    id: 22,
    status: 'PENDING',
    customerEmail: 'yarn-market-sale@test.local',
    items: [{ productId: null, productName: 'Laine - Laine rose', quantity: 1 }],
  });
  paymentIntentRetrieve.mockResolvedValue({
    id: 'pi_yarn',
    status: 'requires_payment_method',
    metadata: { orderId: '22', yarnProductId: '4' },
  });
  paymentIntentCancel.mockResolvedValue({ id: 'pi_yarn', status: 'canceled' });
  markRegularOrderPaid.mockResolvedValue({
    id: 22,
    status: 'PAID',
    customerEmail: 'yarn-market-sale@test.local',
    items: [{ productId: null, productName: 'Laine - Laine rose', quantity: 1 }],
  });
  discardPendingOrder.mockResolvedValue(true);
  $transaction.mockImplementation((callback) => callback({
    yarnProduct: {
      findUnique: yarnFindUnique,
      update: yarnUpdate,
    },
  }));
});

describe('POST /api/', () => {
  it('requires packaged weight and dimensions', async () => {
    const res = await request(app).post('/api/').set(auth()).send({ name: 'Laine rose', price: 12, stockQuantity: 1 });
    expect(res.status).toBe(400);
    expect(yarnCreate).not.toHaveBeenCalled();
  });

  it('stores packaged weight and dimensions', async () => {
    yarnCreate.mockResolvedValue({ id: 4, name: 'Laine rose', price: 12 });
    const res = await request(app).post('/api/').set(auth()).send({
      name: 'Laine rose', price: 12, stockQuantity: 1,
      packageWeightGrams: 200, packageLengthCm: 20, packageWidthCm: 15, packageHeightCm: 8,
    });

    expect(res.status).toBe(201);
    expect(yarnCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        packageWeightGrams: 200,
        packageLengthCm: 20,
        packageWidthCm: 15,
        packageHeightCm: 8,
      }),
    }));
  });
});

describe('POST /api/:id/market-sale', () => {
  it('decrements yarn stock by one and marks soldOut only at zero', async () => {
    const availableYarn = {
      id: 4,
      name: 'Laine rose',
      price: 12,
      stockQuantity: 2,
      soldOut: false,
      isDeleted: false,
    };
    yarnFindUnique.mockResolvedValueOnce(availableYarn).mockResolvedValueOnce(availableYarn);
    yarnUpdate.mockResolvedValueOnce({
      id: 4,
      name: 'Laine rose',
      stockQuantity: 1,
      soldOut: false,
    });

    const res = await request(app).post('/api/4/market-sale').set(auth()).send({ paymentMethod: 'CASH', salePrice: 10 });

    expect(res.status).toBe(201);
    expect(yarnUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 4 },
      data: { stockQuantity: 1, soldOut: false },
    }));
    expect(res.body.data.sale).toMatchObject({ paymentMethod: 'CASH', salePrice: 10, soldQuantity: 1 });
  });

  it('rejects already sold yarn', async () => {
    yarnFindUnique.mockResolvedValueOnce({
      id: 4,
      name: 'Laine rose',
      stockQuantity: 0,
      soldOut: true,
      isDeleted: false,
    });

    const res = await request(app).post('/api/4/market-sale').set(auth()).send({});

    expect(res.status).toBe(409);
    expect(yarnUpdate).not.toHaveBeenCalled();
  });
});

describe('POST /api/terminal/payment-intents/:paymentIntentId/sync', () => {
  it('decrements yarn stock before marking a succeeded Tap to Pay order paid', async () => {
    const pendingOrder = {
      id: 22,
      status: 'PENDING',
      customerEmail: 'yarn-market-sale@test.local',
      items: [{ productId: null, productName: 'Laine - Laine rose', quantity: 1 }],
    };
    const paidOrder = { ...pendingOrder, status: 'PAID' };
    paymentIntentRetrieve.mockResolvedValueOnce({
      id: 'pi_yarn_paid',
      status: 'succeeded',
      metadata: { orderId: '22', yarnProductId: '4', source: 'admin-yarn-tap-to-pay' },
    });
    orderFindUnique.mockResolvedValueOnce(pendingOrder).mockResolvedValueOnce(paidOrder);
    yarnFindUnique.mockResolvedValueOnce({
      id: 4,
      name: 'Laine rose',
      stockQuantity: 2,
      soldOut: false,
      isDeleted: false,
    });
    yarnUpdate.mockResolvedValueOnce({
      id: 4,
      stockQuantity: 1,
      soldOut: false,
    });
    markRegularOrderPaid.mockResolvedValueOnce(paidOrder);

    const res = await request(app)
      .post('/api/terminal/payment-intents/pi_yarn_paid/sync')
      .set(auth())
      .send({});

    expect(res.status).toBe(200);
    expect(yarnUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 4 },
      data: { stockQuantity: 1, soldOut: false },
    }));
    expect(markRegularOrderPaid).toHaveBeenCalledWith(expect.anything(), 22, expect.objectContaining({ id: 'pi_yarn_paid' }), 'terminal.yarn.tap-to-pay.sync');
    expect(yarnUpdate.mock.invocationCallOrder[0]).toBeLessThan(markRegularOrderPaid.mock.invocationCallOrder[0]);
    expect(res.body.data.order).toEqual(paidOrder);
  });

  it('does not decrement yarn stock again when the Tap to Pay order is already paid', async () => {
    const paidOrder = {
      id: 22,
      status: 'PAID',
      customerEmail: 'yarn-market-sale@test.local',
      items: [{ productId: null, productName: 'Laine - Laine rose', quantity: 1 }],
    };
    paymentIntentRetrieve.mockResolvedValueOnce({
      id: 'pi_yarn_paid',
      status: 'succeeded',
      metadata: { orderId: '22', yarnProductId: '4', source: 'admin-yarn-tap-to-pay' },
    });
    orderFindUnique.mockResolvedValueOnce(paidOrder);

    const res = await request(app)
      .post('/api/terminal/payment-intents/pi_yarn_paid/sync')
      .set(auth())
      .send({});

    expect(res.status).toBe(200);
    expect(yarnUpdate).not.toHaveBeenCalled();
    expect(markRegularOrderPaid).not.toHaveBeenCalled();
    expect(res.body.data.order).toEqual(paidOrder);
  });
});
