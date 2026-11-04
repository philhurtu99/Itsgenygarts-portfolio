import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const productFindMany = jest.fn();
const productFindUnique = jest.fn();
const productCreate = jest.fn();
const productUpdate = jest.fn();
const productDelete = jest.fn();
const yarnProductFindUnique = jest.fn();
const yarnProductUpdate = jest.fn();
const cartItemDeleteMany = jest.fn();
const favoriteItemDeleteMany = jest.fn();
const categoryFindUnique = jest.fn();
const productImageFindUnique = jest.fn();
const productImageFindFirst = jest.fn();
const productImageCreate = jest.fn();
const productImageDelete = jest.fn();
const productImageUpdateMany = jest.fn();
const productVariantFindMany = jest.fn();
const productVariantUpdateMany = jest.fn();
const productVariantCreate = jest.fn();
const orderCreate = jest.fn();
const orderUpdate = jest.fn();
const orderFindUnique = jest.fn();
const orderFindMany = jest.fn();
const orderDelete = jest.fn();
const customerUpsert = jest.fn();
const checkoutSessionCreate = jest.fn();
const checkoutSessionExpire = jest.fn();
const connectionTokenCreate = jest.fn();
const locationRetrieve = jest.fn();
const paymentIntentCreate = jest.fn();
const paymentIntentRetrieve = jest.fn();
const paymentIntentCancel = jest.fn();
const reserveStockForOrder = jest.fn();
const commitStockForOrder = jest.fn();
const discardPendingOrder = jest.fn();
const markRegularOrderPaid = jest.fn();
const sendEmail = jest.fn();
const sendPaidOrderEmails = jest.fn();
const $transaction = jest.fn();
const userFindUnique = jest.fn(async () => ({ id: 1, email: 'admin@test.com', username: 'admin', role: 'ADMIN', isActive: true }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    product: { findMany: productFindMany, findUnique: productFindUnique, create: productCreate, update: productUpdate, delete: productDelete },
    yarnProduct: { findUnique: yarnProductFindUnique, update: yarnProductUpdate },
    order: { create: orderCreate, update: orderUpdate, findUnique: orderFindUnique, findMany: orderFindMany, delete: orderDelete },
    customer: { upsert: customerUpsert },
    productVariant: { findMany: productVariantFindMany, updateMany: productVariantUpdateMany, create: productVariantCreate },
    cartItem: { deleteMany: cartItemDeleteMany },
    favoriteItem: { deleteMany: favoriteItemDeleteMany },
    category: { findUnique: categoryFindUnique },
    productImage: { findUnique: productImageFindUnique, findFirst: productImageFindFirst, create: productImageCreate, delete: productImageDelete, updateMany: productImageUpdateMany },
    $transaction,
  })),
}));
jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => ({
    checkout: { sessions: { create: checkoutSessionCreate, expire: checkoutSessionExpire } },
    terminal: {
      connectionTokens: { create: connectionTokenCreate },
      locations: { retrieve: locationRetrieve },
    },
    paymentIntents: { create: paymentIntentCreate, retrieve: paymentIntentRetrieve, cancel: paymentIntentCancel },
  })),
}));
jest.unstable_mockModule('../../../src/services/cloudinary.js', () => ({
  uploadImage: jest.fn(async () => ({ secure_url: 'http://cdn/img.jpg', public_id: 'img123' })),
  deleteImage: jest.fn(async () => {}),
}));
jest.unstable_mockModule('../../../src/services/stock.js', () => ({
  reserveStockForOrder,
  commitStockForOrder,
  RESERVATION_MINUTES: 30,
}));
jest.unstable_mockModule('../../../src/services/pendingOrders.js', () => ({
  discardPendingOrder,
}));
jest.unstable_mockModule('../../../src/services/regularOrderPayment.js', () => ({
  markRegularOrderPaid,
}));
jest.unstable_mockModule('../../../src/services/email.js', () => ({
  sendEmail,
}));
jest.unstable_mockModule('../../../src/services/orderEmails.js', () => ({
  sendPaidOrderEmails,
}));
jest.unstable_mockModule('../../../src/utils/emailTemplate.js', () => ({
  emailHtml: jest.fn(() => '<html>'),
  emailBox: jest.fn((html) => html),
  emailButton: jest.fn((text, href) => `<a href="${href}">${text}</a>`),
  emailEscape: jest.fn((value) => String(value || '')),
}));

const { deleteImage, uploadImage } = await import('../../../src/services/cloudinary.js');
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
const router = (await import('../../../src/routes/admin/products.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => {
  delete process.env.STRIPE_TERMINAL_LOCATION_ID;
  delete process.env.STRIPE_TERMINAL_MERCHANT_NAME;
  [
    productFindMany, productFindUnique, productCreate, productUpdate, productDelete,
    yarnProductFindUnique, yarnProductUpdate,
    productVariantFindMany, productVariantUpdateMany, productVariantCreate,
    orderCreate, orderUpdate, orderFindUnique, orderFindMany, orderDelete, customerUpsert, checkoutSessionCreate, checkoutSessionExpire, connectionTokenCreate, locationRetrieve,
    paymentIntentCreate, paymentIntentRetrieve, paymentIntentCancel, reserveStockForOrder, commitStockForOrder,
    discardPendingOrder, markRegularOrderPaid, sendEmail, sendPaidOrderEmails,
    cartItemDeleteMany, favoriteItemDeleteMany, categoryFindUnique,
    productImageFindUnique, productImageFindFirst, productImageCreate, productImageDelete, productImageUpdateMany, $transaction, deleteImage,
  ]
    .forEach(fn => fn.mockReset());
  productVariantFindMany.mockResolvedValue([]);
  productVariantUpdateMany.mockResolvedValue({ count: 0 });
  checkoutSessionCreate.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.test/pay' });
  checkoutSessionExpire.mockResolvedValue({ id: 'cs_old', status: 'expired' });
  orderFindMany.mockResolvedValue([]);
  customerUpsert.mockResolvedValue({ id: 1, email: 'client@test.com', newsletterConsent: true });
  connectionTokenCreate.mockResolvedValue({ secret: 'pst_test_secret' });
  locationRetrieve.mockResolvedValue({ id: 'tml_test_location', display_name: 'Test Shop', livemode: false });
  paymentIntentCreate.mockResolvedValue({ id: 'pi_test', client_secret: 'pi_test_secret', status: 'requires_payment_method' });
  paymentIntentRetrieve.mockResolvedValue({ id: 'pi_test', status: 'requires_payment_method', metadata: { orderId: '99' } });
  paymentIntentCancel.mockResolvedValue({ id: 'pi_test', status: 'canceled' });
  reserveStockForOrder.mockResolvedValue(undefined);
  commitStockForOrder.mockResolvedValue(undefined);
  discardPendingOrder.mockResolvedValue(true);
  markRegularOrderPaid.mockResolvedValue({ id: 99, status: 'PAID' });
  sendPaidOrderEmails.mockResolvedValue(undefined);
  $transaction.mockImplementation(async (callback) => {
    let transactionProduct = null;
    const tx = {
      product: {
        create: async (args) => {
          transactionProduct = await productCreate(args);
          return transactionProduct;
        },
        update: async (args) => {
          transactionProduct = await productUpdate(args);
          return transactionProduct;
        },
        findUnique: async (args) => {
          const result = await productFindUnique(args);
          return result === undefined ? transactionProduct : result;
        },
      },
      productVariant: {
        findMany: productVariantFindMany,
        updateMany: productVariantUpdateMany,
        create: productVariantCreate,
      },
      productImage: { updateMany: productImageUpdateMany },
      yarnProduct: {
        findUnique: yarnProductFindUnique,
        update: yarnProductUpdate,
      },
    };
    return callback(tx);
  });
});

describe('Admin guard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/', () => {
  it('returns all products', async () => {
    productFindMany.mockResolvedValue([{ id: 1, name: 'Hat' }]);
    const res = await request(app).get('/api/').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('keeps sold variation images visible for admin edits', async () => {
    productFindMany.mockResolvedValue([{
      id: 1,
      name: 'Hat',
      images: [
        { id: 1, imageUrl: 'a.jpg', variantId: 10, order: 0 },
        { id: 2, imageUrl: 'sold-b.jpg', variantId: 11, order: 1 },
        { id: 3, imageUrl: 'general.jpg', variantId: null, order: 2 },
      ],
      variants: [
        { id: 10, status: 'AVAILABLE', sortOrder: 0, images: [] },
        { id: 11, status: 'SOLD', sortOrder: 1, images: [] },
      ],
    }]);

    const res = await request(app).get('/api/').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data[0].variants.map((variant) => [variant.id, variant.status, variant.label])).toEqual([
      [10, 'AVAILABLE', 'A'],
      [11, 'SOLD', 'B'],
    ]);
    expect(res.body.data[0].images.map((image) => [image.imageUrl, image.variantLabel])).toEqual([
      ['general.jpg', null],
      ['a.jpg', 'A'],
      ['sold-b.jpg', 'B'],
    ]);
  });
});

describe('GET /api/:id', () => {
  it('returns 404 when not found', async () => {
    productFindUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/99').set(auth());
    expect(res.status).toBe(404);
  });

  it('returns product when found', async () => {
    productFindUnique.mockResolvedValue({ id: 1, name: 'Hat' });
    const res = await request(app).get('/api/1').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});

describe('POST /api/:id/market-sale', () => {
  it('creates a paid POS order and commits stock', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 88, items: [{ productId: 1, quantity: 1 }] });
    orderUpdate.mockResolvedValueOnce({ id: 88, status: 'PAID' });
    orderFindUnique.mockResolvedValueOnce({ id: 88, status: 'PAID', customerEmail: 'client@test.com', items: [] });

    const res = await request(app)
      .post('/api/1/market-sale')
      .set(auth())
      .send({ paymentMethod: 'CASH', customerName: 'Marché', customerEmail: 'client@test.com', salePrice: 20 });

    expect(res.status).toBe(201);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerName: 'Marché',
        status: 'PENDING',
        subtotal: 20,
        total: 20,
        items: { create: [expect.objectContaining({ unitPrice: 20, subtotal: 20 })] },
      }),
    }));
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      88,
      [{ productId: 1, productVariantId: null, quantity: 1 }],
      { allowDraft: true },
    );
    expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 88 },
      data: expect.objectContaining({ status: 'PAID', stripePaymentId: 'market-cash-88', paidAt: expect.any(Date) }),
    }));
    expect(commitStockForOrder).toHaveBeenCalledWith(88);
    expect(customerUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'client@test.com' },
      update: { newsletterConsent: true },
    }));
    expect(sendPaidOrderEmails).toHaveBeenCalledWith(expect.objectContaining({ id: 88 }), expect.objectContaining({ prisma: expect.anything() }));
  });

  it('uses the sole product variant for stock without snapshotting Variation A', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [{ id: 10, status: 'AVAILABLE', sortOrder: 0, images: [] }],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 89, items: [{ productId: 1, productVariantId: 10, quantity: 1 }] });
    orderUpdate.mockResolvedValueOnce({ id: 89, status: 'PAID' });
    orderFindUnique.mockResolvedValueOnce({ id: 89, status: 'PAID', customerEmail: 'client@test.com', items: [] });

    const res = await request(app)
      .post('/api/1/market-sale')
      .set(auth())
      .send({ paymentMethod: 'CASH', salePrice: 20 });

    expect(res.status).toBe(201);
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
      }),
    }));
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      89,
      [{ productId: 1, productVariantId: 10, quantity: 1 }],
      { allowDraft: true },
    );
  });

  it('snapshots the selected variant label when multiple variants exist', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 2,
      soldOut: false,
      isDeleted: false,
      isDraft: true,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [
        { id: 10, status: 'AVAILABLE', sortOrder: 0, images: [] },
        { id: 11, status: 'AVAILABLE', sortOrder: 1, images: [] },
      ],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 90, items: [{ productId: 1, productVariantId: 11, quantity: 1 }] });
    orderUpdate.mockResolvedValueOnce({ id: 90, status: 'PAID' });
    orderFindUnique.mockResolvedValueOnce({ id: 90, status: 'PAID', customerEmail: 'client@test.com', items: [] });

    const res = await request(app)
      .post('/api/1/market-sale')
      .set(auth())
      .send({ paymentMethod: 'CASH', productVariantId: 11, salePrice: 20 });

    expect(res.status).toBe(201);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        items: {
          create: [
            expect.objectContaining({
              productVariantId: 11,
              variantLabelSnapshot: 'B',
            }),
          ],
        },
      }),
    }));
  });

  it('rejects sold products', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 0,
      soldOut: true,
      isDeleted: false,
      isDraft: false,
      variants: [],
    });

    const res = await request(app).post('/api/1/market-sale').set(auth()).send({});

    expect(res.status).toBe(409);
    expect(orderCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/market-bundle-sale', () => {
  it('creates an anonymous paid market sale without sending a customer email', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 121, items: [] });
    orderUpdate.mockResolvedValueOnce({ id: 121, status: 'PAID' });
    orderFindUnique.mockResolvedValueOnce({
      id: 121,
      status: 'PAID',
      customerEmail: 'market-bundle-test@pos.local',
      items: [{ productId: 1 }],
    });

    const res = await request(app)
      .post('/api/market-bundle-sale')
      .set(auth())
      .send({
        paymentMethod: 'CASH',
        items: [{ type: 'product', productId: 1, salePrice: 20 }],
      });

    expect(res.status).toBe(201);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerName: 'Caisse marché (CASH)',
        customerEmail: expect.stringMatching(/^market-bundle-\d+@pos\.local$/),
      }),
    }));
    expect(sendPaidOrderEmails).not.toHaveBeenCalled();
    expect(customerUpsert).not.toHaveBeenCalled();
  });

  it('creates a paid market cart order with one product', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: true,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 122, items: [] });
    orderUpdate.mockResolvedValueOnce({ id: 122, status: 'PAID' });
    orderFindUnique.mockResolvedValueOnce({
      id: 122,
      status: 'PAID',
      customerEmail: 'client@test.com',
      items: [{ productId: 1 }],
    });

    const res = await request(app)
      .post('/api/market-bundle-sale')
      .set(auth())
      .send({
        paymentMethod: 'INTERAC',
        customerName: 'Client marché',
        customerEmail: 'client@test.com',
        items: [
          { type: 'product', productId: 1, salePrice: 20 },
        ],
      });

    expect(res.status).toBe(201);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subtotal: 20,
        total: 20,
        items: {
          create: [
            expect.objectContaining({ productId: 1, productName: 'Hat', unitPrice: 20, subtotal: 20 }),
          ],
        },
      }),
    }));
    expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 122 },
      data: expect.objectContaining({ status: 'PAID', stripePaymentId: 'market-bundle-interac-122' }),
    }));
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      122,
      [{ productId: 1, productVariantId: null, quantity: 1 }],
      { allowDraft: true },
    );
    expect(commitStockForOrder).toHaveBeenCalledWith(122);
  });

  it('creates a paid mixed market order with product and yarn line prices', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    yarnProductFindUnique
      .mockResolvedValueOnce({
        id: 7,
        name: 'Merino',
        price: 12,
        stockQuantity: 3,
        soldOut: false,
        isDeleted: false,
        mainImageUrl: 'http://cdn/yarn.jpg',
        images: [],
      })
      .mockResolvedValueOnce({
        id: 7,
        name: 'Merino',
        price: 12,
        stockQuantity: 3,
        soldOut: false,
        isDeleted: false,
        mainImageUrl: 'http://cdn/yarn.jpg',
        images: [],
      });
    orderCreate.mockResolvedValueOnce({ id: 123, items: [] });
    orderUpdate.mockResolvedValueOnce({ id: 123, status: 'PAID' });
    orderFindUnique.mockResolvedValueOnce({
      id: 123,
      status: 'PAID',
      customerEmail: 'client@test.com',
      items: [{ productId: 1 }, { productId: null }],
    });
    yarnProductUpdate.mockResolvedValueOnce({ id: 7, stockQuantity: 2, soldOut: false });

    const res = await request(app)
      .post('/api/market-bundle-sale')
      .set(auth())
      .send({
        paymentMethod: 'CASH',
        customerName: 'Client marché',
        customerEmail: 'client@test.com',
        items: [
          { type: 'product', productId: 1, salePrice: 20 },
          { type: 'yarn', yarnProductId: 7, salePrice: 8 },
        ],
      });

    expect(res.status).toBe(201);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerName: 'Client marché',
        subtotal: 28,
        total: 28,
        items: {
          create: [
            expect.objectContaining({ productId: 1, productName: 'Hat', unitPrice: 20, subtotal: 20 }),
            expect.objectContaining({ productId: null, productName: 'Laine - Merino', unitPrice: 8, subtotal: 8 }),
          ],
        },
      }),
    }));
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      123,
      [{ productId: 1, productVariantId: null, quantity: 1 }],
      { allowDraft: true },
    );
    expect(yarnProductUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: { stockQuantity: 2, soldOut: false },
    }));
    expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 123 },
      data: expect.objectContaining({ status: 'PAID', stripePaymentId: 'market-bundle-cash-123' }),
    }));
    expect(commitStockForOrder).toHaveBeenCalledWith(123);
    expect(sendPaidOrderEmails).toHaveBeenCalledWith(expect.objectContaining({ id: 123 }), expect.objectContaining({ prisma: expect.anything() }));
  });

  it('creates a mixed market cart payment link without reserving stock', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    yarnProductFindUnique.mockResolvedValueOnce({
      id: 7,
      name: 'Merino',
      price: 12,
      stockQuantity: 3,
      soldOut: false,
      isDeleted: false,
      mainImageUrl: 'http://cdn/yarn.jpg',
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 124, total: 32, shippingTotal: 4, items: [] });
    orderUpdate.mockResolvedValueOnce({ id: 124, stripeSessionId: 'cs_test' });

    const res = await request(app)
      .post('/api/market-cart/payment-link')
      .set(auth())
      .send({
        customerName: 'Client marché',
        customerEmail: 'client@test.com',
        shippingTotal: 4,
        items: [
          { type: 'product', productId: 1, salePrice: 20 },
          { type: 'yarn', yarnProductId: 7, salePrice: 8 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toBe('https://checkout.stripe.test/pay');
    expect(reserveStockForOrder).not.toHaveBeenCalled();
    expect(checkoutSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      customer_email: 'client@test.com',
      metadata: expect.objectContaining({
        orderId: '124',
        source: 'admin-market-cart-payment-link',
        yarnProductIds: '[7]',
      }),
      line_items: expect.arrayContaining([
        expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 2000 }) }),
        expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 800 }) }),
        expect.objectContaining({ price_data: expect.objectContaining({ product_data: { name: 'Shipping' }, unit_amount: 400 }) }),
      ]),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'client@test.com',
      profile: 'system',
      subject: 'Payment link - 32.00 $ CAD',
    }));
  });

  it('creates a market cart payment link without a name or email', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 126, total: 20, shippingTotal: 0, items: [] });
    orderUpdate.mockResolvedValueOnce({ id: 126, stripeSessionId: 'cs_test' });

    const res = await request(app)
      .post('/api/market-cart/payment-link')
      .set(auth())
      .send({
        items: [{ type: 'product', productId: 1, salePrice: 20 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      checkoutUrl: 'https://checkout.stripe.test/pay',
      emailQueued: false,
      reserved: false,
    });
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerName: 'Client lien de paiement',
        customerEmail: expect.stringMatching(/^market-payment-link-\d+@pos\.local$/),
      }),
    }));
    expect(checkoutSessionCreate.mock.calls[0][0]).not.toHaveProperty('customer_email');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(customerUpsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/:id/payment-link', () => {
  it('creates an unreserved order, emails the Stripe checkout link, and stores newsletter consent', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 99, items: [{ productId: 1, quantity: 1 }] });
    orderUpdate.mockResolvedValueOnce({ id: 99, stripeSessionId: 'cs_test' });

    const res = await request(app)
      .post('/api/1/payment-link')
      .set(auth())
      .send({ shippingTotal: 8.5, salePrice: 20, customerName: 'Alice', customerEmail: 'client@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toBe('https://checkout.stripe.test/pay');
    expect(res.body.data.reserved).toBe(false);
    expect(reserveStockForOrder).not.toHaveBeenCalled();
    expect(checkoutSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      customer_email: 'client@test.com',
      metadata: expect.objectContaining({ orderId: '99', source: 'admin-payment-link' }),
      expires_at: expect.any(Number),
      line_items: expect.arrayContaining([
        expect.objectContaining({
          quantity: 1,
          price_data: expect.objectContaining({ unit_amount: 2000 }),
        }),
        expect.objectContaining({
          price_data: expect.objectContaining({
            product_data: { name: 'Shipping' },
            unit_amount: 850,
          }),
        }),
      ]),
    }));
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { stripeSessionId: 'cs_test' },
    });
    expect(customerUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'client@test.com' },
      update: { newsletterConsent: true },
      create: expect.objectContaining({ email: 'client@test.com', newsletterConsent: true }),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'client@test.com',
      profile: 'system',
      subject: 'Hat - payment link',
    }));
    expect(res.body.data.emailQueued).toBe(true);
    expect(res.body.data.expiresInMinutes).toBe(1440);
  });

  it('creates a copyable product payment link without customer details', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 99, items: [{ productId: 1, quantity: 1 }] });
    orderUpdate.mockResolvedValueOnce({ id: 99, stripeSessionId: 'cs_test' });

    const res = await request(app)
      .post('/api/1/payment-link')
      .set(auth())
      .send({ shippingTotal: 8.5 });

    expect(res.status).toBe(201);
    expect(res.body.data.emailQueued).toBe(false);
    expect(checkoutSessionCreate.mock.calls[0][0]).not.toHaveProperty('customer_email');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(customerUpsert).not.toHaveBeenCalled();
  });
});

describe('Terminal Tap to Pay endpoints', () => {
  it('creates a Terminal connection token', async () => {
    const res = await request(app).post('/api/terminal/connection-token').set(auth()).send({});

    expect(res.status).toBe(200);
    expect(connectionTokenCreate).toHaveBeenCalled();
    expect(res.body.data.secret).toBe('pst_test_secret');
  });

  it('returns Terminal Tap to Pay config', async () => {
    process.env.STRIPE_TERMINAL_LOCATION_ID = 'tml_test_location';
    process.env.STRIPE_TERMINAL_MERCHANT_NAME = 'Test Shop';

    const res = await request(app).get('/api/terminal/config').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      locationId: 'tml_test_location',
      merchantDisplayName: 'Test Shop',
    });
  });

  it('creates a reserved order and card-present PaymentIntent for Tap to Pay', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 100, total: 25, items: [{ productId: 1, quantity: 1 }] });
    orderUpdate.mockResolvedValueOnce({ id: 100, stripePaymentId: 'pi_test' });

    const res = await request(app).post('/api/1/tap-to-pay-intent').set(auth()).send({});

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      orderId: 100,
      paymentIntentId: 'pi_test',
      clientSecret: 'pi_test_secret',
      amount: 25,
      currency: 'CAD',
    });
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      100,
      [{ productId: 1, productVariantId: null, quantity: 1 }],
      { allowDraft: true },
    );
    expect(paymentIntentCreate).toHaveBeenCalledWith(expect.objectContaining({
      amount: 2500,
      currency: 'cad',
      payment_method_types: ['card_present', 'interac_present'],
      metadata: { orderId: '100', source: 'admin-tap-to-pay' },
    }));
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { stripePaymentId: 'pi_test' },
    });
  });

  it('creates a market cart Tap to Pay intent for mixed items', async () => {
    productFindUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Hat',
      price: 25,
      stockQuantity: 1,
      soldOut: false,
      isDeleted: false,
      isDraft: false,
      mainImageUrl: 'http://cdn/hat.jpg',
      variants: [],
      images: [],
    });
    yarnProductFindUnique.mockResolvedValueOnce({
      id: 7,
      name: 'Merino',
      price: 12,
      stockQuantity: 3,
      soldOut: false,
      isDeleted: false,
      mainImageUrl: 'http://cdn/yarn.jpg',
      images: [],
    });
    orderCreate.mockResolvedValueOnce({ id: 125, total: 28, items: [] });
    orderUpdate.mockResolvedValueOnce({ id: 125, stripePaymentId: 'pi_test' });

    const res = await request(app)
      .post('/api/market-cart/tap-to-pay-intent')
      .set(auth())
      .send({
        items: [
          { type: 'product', productId: 1, salePrice: 20 },
          { type: 'yarn', yarnProductId: 7, salePrice: 8 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ orderId: 125, amount: 28 });
    expect(reserveStockForOrder).toHaveBeenCalledWith(
      125,
      [{ productId: 1, productVariantId: null, quantity: 1 }],
      { allowDraft: true },
    );
    expect(paymentIntentCreate).toHaveBeenCalledWith(expect.objectContaining({
      amount: 2800,
      metadata: {
        orderId: '125',
        source: 'admin-market-cart-tap-to-pay',
        yarnProductIds: '[7]',
      },
    }));
  });

  it('syncs a succeeded Tap to Pay PaymentIntent into a paid order', async () => {
    paymentIntentRetrieve.mockResolvedValueOnce({
      id: 'pi_paid',
      status: 'succeeded',
      metadata: { orderId: '100' },
    });
    markRegularOrderPaid.mockResolvedValueOnce({ id: 100, status: 'PAID' });

    const res = await request(app).post('/api/terminal/payment-intents/pi_paid/sync').set(auth()).send({});

    expect(res.status).toBe(200);
    expect(markRegularOrderPaid).toHaveBeenCalledWith(
      expect.anything(),
      '100',
      expect.objectContaining({ id: 'pi_paid' }),
      'terminal.tap-to-pay.sync',
      { allowDraft: false },
    );
    expect(res.body.data.order).toEqual({ id: 100, status: 'PAID' });
  });

  it('syncs a succeeded market cart Tap to Pay PaymentIntent and decrements yarn stock', async () => {
    paymentIntentRetrieve.mockResolvedValueOnce({
      id: 'pi_cart_paid',
      status: 'succeeded',
      metadata: { orderId: '125', source: 'admin-market-cart-tap-to-pay', yarnProductIds: '[7]' },
    });
    yarnProductFindUnique.mockResolvedValueOnce({
      id: 7,
      name: 'Merino',
      stockQuantity: 3,
      soldOut: false,
      isDeleted: false,
    });
    yarnProductUpdate.mockResolvedValueOnce({ id: 7, stockQuantity: 2, soldOut: false });
    markRegularOrderPaid.mockResolvedValueOnce({ id: 125, status: 'PAID', customerEmail: 'tap@test.com', customerName: 'Tap' });

    const res = await request(app).post('/api/terminal/payment-intents/pi_cart_paid/sync').set(auth()).send({});

    expect(res.status).toBe(200);
    expect(yarnProductUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: { stockQuantity: 2, soldOut: false },
    }));
    expect(markRegularOrderPaid).toHaveBeenCalledWith(
      expect.anything(),
      '125',
      expect.objectContaining({ id: 'pi_cart_paid' }),
      'terminal.market-cart.tap-to-pay.sync',
      { allowDraft: true },
    );
    expect(res.body.data.order).toEqual({ id: 125, status: 'PAID', customerEmail: 'tap@test.com', customerName: 'Tap' });
  });

  it('cancels an unfinished Tap to Pay PaymentIntent and discards the pending order', async () => {
    paymentIntentRetrieve.mockResolvedValueOnce({
      id: 'pi_cancel',
      status: 'requires_payment_method',
      metadata: { orderId: '100' },
    });

    const res = await request(app).post('/api/terminal/payment-intents/pi_cancel/cancel').set(auth()).send({});

    expect(res.status).toBe(200);
    expect(paymentIntentCancel).toHaveBeenCalledWith('pi_cancel');
    expect(discardPendingOrder).toHaveBeenCalledWith('100');
  });
});

describe('POST /api/', () => {
  it('returns 400 when category does not exist', async () => {
    categoryFindUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/').set(auth()).send({ name: 'Hat', price: 20, categoryId: 99 });
    expect(res.status).toBe(400);
  });

  it('creates product and returns 201', async () => {
    productCreate.mockResolvedValue({ id: 5, name: 'Hat', price: 20 });
    const res = await request(app).post('/api/').set(auth()).send({
      name: 'Hat', price: 20,
      packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(5);
  });

  it('derives soldOut=false when creating with positive stock', async () => {
    productCreate.mockResolvedValue({ id: 5, name: 'Hat', stockQuantity: 1, soldOut: false });

    const res = await request(app)
      .post('/api/')
      .set(auth())
      .send({
        name: 'Hat', price: 20, stockQuantity: 1, soldOut: true,
        packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8,
      });

    expect(res.status).toBe(201);
    expect(productCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stockQuantity: 1, soldOut: false }),
    }));
  });
});

describe('PUT /api/:id', () => {
  it('saves the sold-product gallery option without restoring stock', async () => {
    productUpdate.mockResolvedValue({ id: 1, name: 'Hat', stockQuantity: 0, soldOut: true, showSoldVariants: true });
    const res = await request(app).put('/api/1').set(auth())
      .send({ name: 'Hat', price: 20, stockQuantity: 0, soldOut: true, showSoldVariants: true });
    expect(res.status).toBe(200);
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ stockQuantity: 0, soldOut: true, showSoldVariants: true }) }));
    expect(productVariantCreate).not.toHaveBeenCalled();
    expect(productVariantUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SOLD' } }));
  });
  it('derives soldOut=false when updating to positive stock', async () => {
    productUpdate.mockResolvedValue({ id: 1, name: 'Hat', stockQuantity: 1, soldOut: false });

    const res = await request(app)
      .put('/api/1')
      .set(auth())
      .send({ name: 'Hat', price: 20, stockQuantity: 1, soldOut: true, showSoldVariants: true });

    expect(res.status).toBe(200);
    expect(productUpdate.mock.calls[0][0].data.showSoldVariants).toBe(false);
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ stockQuantity: 1, soldOut: false }),
    }));
    expect(cartItemDeleteMany).not.toHaveBeenCalled();
    expect(favoriteItemDeleteMany).not.toHaveBeenCalled();
  });

  it('derives soldOut=true when updating stock to zero', async () => {
    productUpdate.mockResolvedValue({ id: 1, name: 'Hat', stockQuantity: 0, soldOut: true });

    const res = await request(app)
      .put('/api/1')
      .set(auth())
      .send({ name: 'Hat', price: 20, stockQuantity: 0, soldOut: false });

    expect(res.status).toBe(200);
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stockQuantity: 0, soldOut: true }),
    }));
  });
});

describe('DELETE /api/:id', () => {
  it('returns 404 when product not found', async () => {
    productFindUnique.mockResolvedValue(null);
    const res = await request(app).delete('/api/99').set(auth());
    expect(res.status).toBe(404);
  });

  it('deletes product and its images', async () => {
    productFindUnique.mockResolvedValue({ id: 1, images: [{ publicId: 'abc' }] });
    cartItemDeleteMany.mockResolvedValue({});
    productDelete.mockResolvedValue({});
    const res = await request(app).delete('/api/1').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cartItemDeleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
    expect(favoriteItemDeleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
  });

  it('skips Cloudinary deletion for product images without publicId', async () => {
    productFindUnique.mockResolvedValue({ id: 1, images: [{ publicId: 'abc' }, { publicId: '' }] });
    cartItemDeleteMany.mockResolvedValue({});
    productDelete.mockResolvedValue({});

    const res = await request(app).delete('/api/1').set(auth());

    expect(res.status).toBe(200);
    expect(deleteImage).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith('abc');
  });
});

describe('DELETE /api/:id/images/:imageId', () => {
  it('uses the next presentation photo when the cover is removed', async () => {
    productImageFindFirst.mockResolvedValue({ id: 2, productId: 1, imageUrl: 'cover.jpg', publicId: '' });
    const remaining = [{ id: 1, imageUrl: 'a.jpg', variantId: 10, order: 0 }, { id: 3, imageUrl: 'overview.jpg', variantId: null, order: 2 }];
    productFindUnique.mockResolvedValueOnce({ id: 1, mainImageUrl: 'cover.jpg', images: remaining })
      .mockResolvedValueOnce({ id: 1, mainImageUrl: 'overview.jpg', images: remaining, variants: [] });
    const res = await request(app).delete('/api/1/images/2').set(auth());
    expect(res.status).toBe(200);
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { mainImageUrl: 'overview.jpg' } });
    expect(res.body.data.mainImageUrl).toBe('overview.jpg');
  });
  it('deletes the product image record without Cloudinary when publicId is missing', async () => {
    productImageFindFirst.mockResolvedValue({ id: 9, productId: 1, imageUrl: 'http://cdn/existing.jpg', publicId: '' });
    productImageDelete.mockResolvedValue({});
    productFindUnique.mockResolvedValue({ id: 1, mainImageUrl: 'http://cdn/other.jpg', images: [] });

    const res = await request(app).delete('/api/1/images/9').set(auth());

    expect(res.status).toBe(200);
    expect(deleteImage).not.toHaveBeenCalled();
    expect(productImageDelete).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});

describe('POST /api/:id/upload-image', () => {
  it('accepts a photo file and saves a local image URL as the independent product cover', async () => {
    const imageUrl = '/api/local-images/00000000-0000-4000-8000-000000000000.png';
    uploadImage.mockResolvedValueOnce({ secure_url: imageUrl, public_id: 'local-dev/00000000-0000-4000-8000-000000000000.png' });
    productFindUnique.mockResolvedValueOnce({ id: 1, mainImageUrl: 'variation.jpg', images: [], variants: [] })
      .mockResolvedValueOnce({ id: 1, mainImageUrl: imageUrl, images: [{ imageUrl, variantId: null, order: 0 }], variants: [] });
    const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ed9eb5' } }).png().toBuffer();
    const res = await request(app).post('/api/1/upload-image').set(auth())
      .attach('image', buffer, { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(productImageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ imageUrl, variantId: null }) });
    expect(res.body.data.mainImageUrl).toBe(imageUrl);
  });
  it('keeps the first presentation photo when another is added', async () => {
    const existing = { id: 1, mainImageUrl: 'cover.jpg', images: [{ id: 1, imageUrl: 'cover.jpg', variantId: null, order: 0 }], variants: [] };
    productFindUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);
    const res = await request(app).post('/api/1/upload-image').set(auth()).field('existingImageUrl', 'overview.jpg');
    expect(res.status).toBe(201);
    expect(productUpdate).not.toHaveBeenCalled();
    expect(productImageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ variantId: null, order: 1 }) });
  });
  it('adds an independent presentation photo and makes it the product cover', async () => {
    productFindUnique.mockResolvedValueOnce({ id: 1, mainImageUrl: 'a.jpg', images: [{ id: 1, imageUrl: 'a.jpg', variantId: 10, order: 0 }], variants: [{ id: 10 }, { id: 11 }] })
      .mockResolvedValueOnce({ id: 1, mainImageUrl: 'cover.jpg', images: [{ id: 2, imageUrl: 'cover.jpg', variantId: null, order: 1 }], variants: [] });
    const res = await request(app).post('/api/1/upload-image').set(auth()).field('existingImageUrl', 'cover.jpg');
    expect(res.status).toBe(201);
    expect(productImageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ variantId: null, imageUrl: 'cover.jpg' }) });
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { mainImageUrl: 'cover.jpg' } });
    expect(res.body.data.mainImageUrl).toBe('cover.jpg');
  });
  it('allows admins to attach an existing Cloudinary image to a sold variation', async () => {
    productFindUnique
      .mockResolvedValueOnce({
        id: 1,
        mainImageUrl: 'http://cdn/current.jpg',
        images: [],
        variants: [{ id: 10, status: 'SOLD', sortOrder: 0, images: [] }],
      })
      .mockResolvedValueOnce({
        id: 1,
        mainImageUrl: 'http://cdn/current.jpg',
        images: [{ id: 99, imageUrl: 'http://cdn/new.jpg', variantId: 10, order: 0 }],
        variants: [{ id: 10, status: 'SOLD', sortOrder: 0, images: [] }],
      });
    productImageCreate.mockResolvedValueOnce({ id: 99, imageUrl: 'http://cdn/new.jpg', variantId: 10 });

    const res = await request(app)
      .post('/api/1/upload-image')
      .set(auth())
      .field('existingImageUrl', 'http://cdn/new.jpg')
      .field('variantId', '10');

    expect(res.status).toBe(201);
    expect(productImageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 1,
        variantId: 10,
        imageUrl: 'http://cdn/new.jpg',
      }),
    });
  });
});


describe('PATCH /api/:id/images/order', () => {
  const original = { id: 1, mainImageUrl: 'general.jpg', variants: [{ id: 10, status: 'AVAILABLE', images: [] }],
    images: [{ id: 2, productId: 1, imageUrl: 'general.jpg', variantId: null, order: 0 },
      { id: 1, productId: 1, imageUrl: 'photo.jpg', variantId: 10, order: 1 }] };
  it('requires an admin session', async () => {
    expect((await request(app).patch('/api/1/images/order').send({ imageIds: [1, 2] })).status).toBe(401);
    expect(productImageUpdateMany).not.toHaveBeenCalled();
  });
  it('saves the full order and cover together without changing image ownership or variant association', async () => {
    const updated = { ...original, mainImageUrl: 'photo.jpg', images: original.images.map(image => ({ ...image, order: image.id === 1 ? 0 : 1 })) };
    productFindUnique.mockResolvedValueOnce(original).mockResolvedValueOnce(updated);
    productImageUpdateMany.mockResolvedValue({ count: 1 });
    const res = await request(app).patch('/api/1/images/order').set(auth()).send({ imageIds: [1, 2] });
    expect(res.status).toBe(200);
    expect(productImageUpdateMany.mock.calls).toEqual([
      [{ where: { id: 1, productId: 1 }, data: { order: 0 } }],
      [{ where: { id: 2, productId: 1 }, data: { order: 1 } }],
    ]);
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { mainImageUrl: 'photo.jpg' } });
    expect(res.body.data.images.map(image => image.id)).toEqual([1, 2]);
    expect(res.body.data.images.map(image => image.variantId)).toEqual([10, null]);
    expect(res.body.data.mainImageUrl).toBe('photo.jpg');
    expect(productImageDelete).not.toHaveBeenCalled();
  });
  it.each([[1], [1, 999]])('rejects missing or foreign photos before writing: %j', async (...imageIds) => {
    productFindUnique.mockResolvedValue(original);
    const res = await request(app).patch('/api/1/images/order').set(auth()).send({ imageIds });
    expect(res.status).toBe(409);
    expect(productImageUpdateMany).not.toHaveBeenCalled();
    expect(productUpdate).not.toHaveBeenCalled();
  });
  it.each([[], [1, 1], ['1', 2], [1, -1]])('rejects malformed order: %j', async (...imageIds) => {
    const res = await request(app).patch('/api/1/images/order').set(auth()).send({ imageIds });
    expect(res.status).toBe(400);
    expect(productFindUnique).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing product without updating images', async () => {
    productFindUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/1/images/order').set(auth()).send({ imageIds: [1] });
    expect(res.status).toBe(404);
    expect(productImageUpdateMany).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/:id autosave', () => {
  const existing = { id: 1, name: 'Bonnet', nameFr: 'Bonnet', nameEn: 'Hat',
    description: 'FR', descriptionFr: 'FR', descriptionEn: 'Keep English',
    price: 25, stockQuantity: 2, soldOut: false, isDraft: false,
    packageWeightGrams: 100, packageLengthCm: 10, packageWidthCm: 10, packageHeightCm: 5,
    customsWeightGrams: 90, images: [{ id: 1, imageUrl: '/photo.jpg' }], variants: [] };
  beforeEach(() => {
    productFindUnique.mockResolvedValue(existing);
    productUpdate.mockImplementation(async ({ data }) => ({ ...existing, ...data }));
  });
  it('requires authentication', async () => {
    expect((await request(app).patch('/api/1').send({ price: 30 })).status).toBe(401);
    expect(productUpdate).not.toHaveBeenCalled();
  });
  it('updates only the changed translation and derived name, preserving inventory, photos and English', async () => {
    const res = await request(app).patch('/api/1').set(auth()).send({ nameFr: 'Nouveau bonnet' });
    expect(res.status).toBe(200);
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { nameFr: 'Nouveau bonnet', name: 'Nouveau bonnet' } });
    expect(productVariantUpdateMany).not.toHaveBeenCalled();
    expect(productImageUpdateMany).not.toHaveBeenCalled();
  });
  it('writes only price without resubmitting other fields', async () => {
    const res = await request(app).patch('/api/1').set(auth()).send({ price: 30 });
    expect(res.status).toBe(200);
    expect(productUpdate.mock.calls[0][0].data).toEqual({ price: 30 });
  });
  it('checks a single shipping measure against saved measures without writing them', async () => {
    expect((await request(app).patch('/api/1').set(auth()).send({ packageWeightGrams: 120 })).status).toBe(200);
    expect(productUpdate.mock.calls[0][0].data).toEqual({ packageWeightGrams: 120 });
  });
  it('checks net weight against saved packaging and allows explicitly clearing it', async () => {
    expect((await request(app).patch('/api/1').set(auth()).send({ customsWeightGrams: 95 })).status).toBe(200);
    expect(productUpdate.mock.calls[0][0].data).toEqual({ customsWeightGrams: 95 });
    expect((await request(app).patch('/api/1').set(auth()).send({ customsWeightGrams: 105 })).status).toBe(400);
    expect((await request(app).patch('/api/1').set(auth()).send({ customsWeightGrams: null })).status).toBe(200);
    expect(productUpdate.mock.calls[1][0].data).toEqual({ customsWeightGrams: null });
  });
  it.each([{ price: '' }, { price: -1 }, { stockQuantity: 99 }, { isDraft: 'false' }, { images: [] }, { variantColors: ['invalid'] }, { nameFr: '', nameEn: '' }])('rejects invalid partial changes %j', async body => {
    const res = await request(app).patch('/api/1').set(auth()).send(body);
    expect(res.status).toBe(400);
    expect(productUpdate).not.toHaveBeenCalled();
  });
  it('validates complete packaging before publishing a draft', async () => {
    productFindUnique.mockResolvedValue({ ...existing, isDraft: true, packageHeightCm: null });
    const res = await request(app).patch('/api/1').set(auth()).send({ isDraft: false });
    expect(res.status).toBe(400);
    expect(productUpdate).not.toHaveBeenCalled();
  });
  it('returns 404 when the product has been removed', async () => {
    productFindUnique.mockResolvedValue(null);
    expect((await request(app).patch('/api/1').set(auth()).send({ price: 25 })).status).toBe(404);
  });
});

describe('Phone upload errors', () => {
  it.each(['image/heic', 'application/octet-stream', 'image/jpeg'])('converts HEIC with MIME %s before uploading', async contentType => {
    const existing = { id: 1, images: [], variants: [] };
    productFindUnique.mockResolvedValue(existing);
    const buffer = await readFile(new URL('../../fixtures/phone-photo.heic', import.meta.url));
    const res = await request(app).post('/api/1/upload-image').set(auth())
      .attach('image', buffer, { filename: 'phone.HEIC', contentType });
    expect(res.status).toBe(201);
    const [converted] = uploadImage.mock.calls.at(-1);
    expect((await sharp(converted).metadata()).format).toBe('jpeg');
  });
  it('reports unsupported files as 400 instead of an internal server error', async () => {
    const res = await request(app).post('/api/1/upload-image').set(auth())
      .attach('image', Buffer.from('not an image'), { filename: 'bad.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Type de fichier invalide');
  });
  it('reports oversized photos as 413', async () => {
    const res = await request(app).post('/api/1/upload-image').set(auth())
      .attach('image', Buffer.alloc(12 * 1024 * 1024 + 1), { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(413);
    expect(res.body.message).toContain('Photo trop volumineuse');
  });
});
