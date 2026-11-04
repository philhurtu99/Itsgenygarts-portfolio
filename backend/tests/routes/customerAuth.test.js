import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const customerFindUnique = jest.fn();
const customerCreate = jest.fn();
const customerUpdate = jest.fn();
const customerDelete = jest.fn();
const cartItemFindMany = jest.fn();
const cartItemDeleteMany = jest.fn();
const cartItemUpsert = jest.fn();
const cartItemFindFirst = jest.fn();
const cartItemUpdate = jest.fn();
const cartItemCreate = jest.fn();
const favoriteItemFindMany = jest.fn();
const favoriteItemDeleteMany = jest.fn();
const favoriteItemUpsert = jest.fn();
const favoriteItemFindFirst = jest.fn();
const favoriteItemCreate = jest.fn();
const productFindFirst = jest.fn();
const productFindUnique = jest.fn();
const orderFindMany = jest.fn();
const customOrderFindMany = jest.fn();
const personalizedQuoteFindMany = jest.fn();
const quoteRequestFindMany = jest.fn();
const orderUpdateMany = jest.fn();
const customOrderUpdateMany = jest.fn();
const personalizedQuoteUpdateMany = jest.fn();
const $transaction = jest.fn();
const sendEmailMock = jest.fn().mockResolvedValue({ messageId: 'x' });

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: class {
    customer = {
      findUnique: customerFindUnique,
      create: customerCreate,
      update: customerUpdate,
      delete: customerDelete,
    };
    cartItem = {
      findMany: cartItemFindMany,
      deleteMany: cartItemDeleteMany,
      upsert: cartItemUpsert,
      findFirst: cartItemFindFirst,
      update: cartItemUpdate,
      create: cartItemCreate,
    };
    favoriteItem = {
      findMany: favoriteItemFindMany,
      deleteMany: favoriteItemDeleteMany,
      upsert: favoriteItemUpsert,
      findFirst: favoriteItemFindFirst,
      create: favoriteItemCreate,
    };
    product = { findFirst: productFindFirst, findUnique: productFindUnique };
    order = { findMany: orderFindMany, updateMany: orderUpdateMany };
    customOrder = { findMany: customOrderFindMany, updateMany: customOrderUpdateMany };
    quoteRequest = { findMany: quoteRequestFindMany };
    personalizedQuote = {
      findMany: personalizedQuoteFindMany,
      updateMany: personalizedQuoteUpdateMany,
    };
    $transaction = $transaction;
  },
}));

jest.unstable_mockModule('../../src/services/email.js', () => ({
  sendEmail: sendEmailMock,
}));

jest.unstable_mockModule('../../src/middleware/rateLimit.js', () => ({
  authLimiter: (req, res, next) => next(),
  actionLimiter: (req, res, next) => next(),
  verificationResendLimiter: (req, res, next) => next(),
}));

const customerAuthRouter = (await import('../../src/routes/auth.js')).default;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', customerAuthRouter);
  return app;
}

function parseCookies(setCookie) {
  const header = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
  const map = {};
  for (const line of header) {
    const [pair] = line.split(';');
    const [name, ...rest] = pair.split('=');
    map[name.trim()] = rest.join('=');
  }
  return { map, raw: header };
}

function signCustomer(id, email) {
  return jwt.sign({ type: 'customer', id, email, name: 'Phil' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  [
    customerFindUnique, customerCreate, customerUpdate, customerDelete,
    cartItemFindMany, cartItemDeleteMany, cartItemUpsert, cartItemFindFirst, cartItemUpdate, cartItemCreate,
    favoriteItemFindMany, favoriteItemDeleteMany, favoriteItemUpsert, favoriteItemFindFirst, favoriteItemCreate,
    productFindFirst, productFindUnique,
    orderFindMany, customOrderFindMany, personalizedQuoteFindMany, quoteRequestFindMany,
    orderUpdateMany, customOrderUpdateMany, personalizedQuoteUpdateMany,
    $transaction, sendEmailMock,
  ].forEach((fn) => fn.mockReset());
  customerFindUnique.mockResolvedValue({
    id: 1,
    name: 'Phil',
    email: 'x@y.z',
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
  });
  sendEmailMock.mockResolvedValue({ messageId: 'x' });
  delete process.env.UNVERIFIED_CUSTOMER_TTL_HOURS;
  process.env.NOTIFICATIONS_EMAIL = 'notifications@example.test';
  process.env.BUSINESS_EMAIL = 'info@example.test';
  orderFindMany.mockResolvedValue([]);
  customOrderFindMany.mockResolvedValue([]);
  personalizedQuoteFindMany.mockResolvedValue([]);
  quoteRequestFindMany.mockResolvedValue([]);
});

describe('POST /api/auth/register', () => {
  it('rejects invalid payloads via zod', async () => {
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when the email already exists', async () => {
    customerFindUnique.mockResolvedValueOnce({ id: 1, emailVerified: true });
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ name: 'Phil', email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(409);
  });

  it('suggests resend when an unverified signup is still active', async () => {
    customerFindUnique.mockResolvedValueOnce({ id: 1, emailVerified: false, verificationToken: 'token', createdAt: new Date() });
    const res = await request(makeApp()).post('/api/auth/register').send({ name: 'Phil', email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_UNVERIFIED');
    expect(customerCreate).not.toHaveBeenCalled();
  });

  it('replaces an expired unverified signup immediately', async () => {
    customerFindUnique.mockResolvedValueOnce({ id: 9, emailVerified: false, verificationToken: 'old', createdAt: new Date(Date.now() - 49 * 3600000) });
    customerDelete.mockResolvedValueOnce({});
    customerCreate.mockResolvedValueOnce({ id: 42, name: 'Phil', email: 'ok@x.co', emailVerified: false, createdAt: new Date() });
    const res = await request(makeApp()).post('/api/auth/register').send({ name: 'Phil', email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(201);
    expect(customerDelete).toHaveBeenCalledWith({ where: { id: 9 } });
    expect(customerCreate).toHaveBeenCalledTimes(1);
  });

  it('creates the customer without a session and sends a verification email', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    customerCreate.mockResolvedValueOnce({
      id: 42, name: 'Phil', email: 'ok@x.co', emailVerified: false, createdAt: new Date(),
    });
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ name: 'Phil', email: 'ok@x.co', password: 'Password1!', preferredLanguage: 'fr' });
    expect(res.status).toBe(201);
    expect(res.body.data.verificationEmailSent).toBe(true);
    expect(customerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ preferredLanguage: 'fr' }),
    }));
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ok@x.co',
      profile: 'system',
      lang: 'fr',
      subject: 'Confirmez votre adresse courriel',
    }));
    expect(sendEmailMock.mock.calls[0][0].text).toContain('notifications@example.test');
    expect(sendEmailMock.mock.calls[0][0].html).toContain('notifications@example.test');
    expect(sendEmailMock.mock.calls[0][0].html).not.toContain('info@example.test');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('uses the storefront origin in the verification email link', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    customerCreate.mockResolvedValueOnce({
      id: 42, name: 'Phil', email: 'ok@x.co', emailVerified: false, createdAt: new Date(),
    });
    const res = await request(makeApp())
      .post('/api/auth/register')
      .set('Origin', 'http://172.20.10.3:3000')
      .send({ name: 'Phil', email: 'ok@x.co', password: 'Password1!' });

    expect(res.status).toBe(201);
    expect(sendEmailMock.mock.calls[0][0].text).toContain('http://172.20.10.3:3000/verify-email?token=');
    expect(sendEmailMock.mock.calls[0][0].html).toContain('http://172.20.10.3:3000/verify-email?token=');
  });

  it('reports delivery failure without losing the created account', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    customerCreate.mockResolvedValueOnce({
      id: 42, name: 'Phil', email: 'ok@x.co', emailVerified: false, createdAt: new Date(),
    });
    sendEmailMock.mockRejectedValueOnce(new Error('smtp down'));
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ name: 'Phil', email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(201);
    expect(res.body.data.verificationEmailSent).toBe(false);
    expect(res.body.data.customer.id).toBe(42);
  });
});

describe('POST /api/auth/resend-verification', () => {
  const pending = () => ({ id: 42, email: 'pending@test.com', isActive: true, emailVerified: false, preferredLanguage: 'en', verificationToken: 'existing-token', createdAt: new Date() });

  it('resends the original token and deadline in the customer language', async () => {
    const customer = pending();
    customerFindUnique.mockResolvedValueOnce(customer);
    const res = await request(makeApp()).post('/api/auth/resend-verification').send({ email: 'PENDING@test.com' });
    expect(res.status).toBe(202);
    expect(customerFindUnique).toHaveBeenCalledWith({ where: { email: 'pending@test.com' } });
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ profile: 'system', lang: 'en' }));
    expect(sendEmailMock.mock.calls[0][0].text).toContain('existing-token');
    expect(sendEmailMock.mock.calls[0][0].text).toContain('Montreal time');
    expect(customerUpdate).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'verified', 'inactive', 'expired'])('does not reveal or email %s accounts', async (state) => {
    const customer = pending();
    if (state === 'verified') customer.emailVerified = true;
    if (state === 'inactive') customer.isActive = false;
    if (state === 'expired') customer.createdAt = new Date(Date.now() - 49 * 3600000);
    customerFindUnique.mockResolvedValueOnce(state === 'unknown' ? null : customer);
    const res = await request(makeApp()).post('/api/auth/resend-verification').send({ email: 'pending@test.com' });
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ requested: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('acknowledges only the request when SMTP fails', async () => {
    customerFindUnique.mockResolvedValueOnce(pending());
    sendEmailMock.mockRejectedValueOnce(new Error('smtp offline'));
    const res = await request(makeApp()).post('/api/auth/resend-verification').send({ email: 'pending@test.com' });
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ requested: true });
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 on wrong credentials (no such account)', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'ok@x.co', password: 'pw' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 4);
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'ok@x.co', passwordHash, isActive: true, emailVerified: false, name: 'Phil',
    });
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(403);
  });

  it('sets the customer cookie on success', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 4);
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'ok@x.co', passwordHash, isActive: true, emailVerified: true, name: 'Phil',
    });
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(200);
    const { map } = parseCookies(res.headers['set-cookie']);
    expect(map.auth_customer).toBeTruthy();
    expect(res.body.data.customer).toMatchObject({ email: 'ok@x.co' });
  });

  it('includes latest order contact details on success', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 4);
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'ok@x.co', passwordHash, isActive: true, emailVerified: true, name: 'Phil',
    });
    orderFindMany.mockResolvedValueOnce([{
      customerPhone: '5145551212',
      customerAddress: '123 rue Test',
      customerCity: 'Montreal',
      customerProvince: 'QC',
      customerPostalCode: 'H2X 1Y4',
      customerCountry: 'CA',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    }]);
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'ok@x.co', password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body.data.customer).toMatchObject({
      phone: '5145551212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the customer cookie', async () => {
    const res = await request(makeApp()).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const { raw } = parseCookies(res.headers['set-cookie']);
    expect(raw.some((c) => c.startsWith('auth_customer='))).toBe(true);
  });
});

describe('GET /api/auth/verify-email', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(makeApp()).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });

  it('returns 400 when token does not match', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp()).get('/api/auth/verify-email?token=abc');
    expect(res.status).toBe(400);
  });

  it('marks the customer verified when the token matches', async () => {
    customerFindUnique.mockResolvedValueOnce({ id: 5, isActive: true, emailVerified: false, createdAt: new Date() });
    customerUpdate.mockResolvedValueOnce({});
    const res = await request(makeApp()).get('/api/auth/verify-email?token=abc');
    expect(res.status).toBe(200);
    expect(customerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5 },
      data: { emailVerified: true, verificationToken: null },
    }));
  });

  it('rejects expired tokens before the scheduled cleanup runs', async () => {
    customerFindUnique.mockResolvedValueOnce({ id: 5, isActive: true, emailVerified: false, createdAt: new Date(Date.now() - 49 * 3600000) });
    const res = await request(makeApp()).get('/api/auth/verify-email?token=abc');
    expect(res.status).toBe(400);
    expect(customerUpdate).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('always returns 200 to avoid enumeration (unknown email)', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'ok@x.co' });
    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('writes a reset token and sends an email for an active account', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1, name: 'Phil', email: 'ok@x.co', isActive: true,
    });
    customerUpdate.mockResolvedValueOnce({});
    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'ok@x.co' });
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalled();
    const updatePayload = customerUpdate.mock.calls[0][0].data;
    expect(updatePayload.resetPasswordToken).toMatch(/^[a-f0-9]+$/);
    expect(updatePayload.resetPasswordExpires).toBeInstanceOf(Date);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when the token is invalid / no user', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(20), password: 'Password1!' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the reset token has expired', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'x@y.z', name: 'p',
      resetPasswordToken: 'a'.repeat(20),
      resetPasswordExpires: new Date(Date.now() - 60_000),
    });
    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(20), password: 'Password1!' });
    expect(res.status).toBe(400);
  });

  it('hashes the new password and clears the reset fields on success', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'x@y.z', name: 'Phil',
      resetPasswordToken: 'a'.repeat(20),
      resetPasswordExpires: new Date(Date.now() + 60_000),
    });
    customerUpdate.mockResolvedValueOnce({});
    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(20), password: 'Password1!' });
    expect(res.status).toBe(200);
    const data = customerUpdate.mock.calls[0][0].data;
    expect(data.resetPasswordToken).toBeNull();
    expect(data.resetPasswordExpires).toBeNull();
    expect(await bcrypt.compare('Password1!', data.passwordHash)).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(makeApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the profile when the cookie is valid', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'x@y.z', name: 'Phil', emailVerified: true, isActive: true, createdAt: new Date(),
    });
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, email: 'x@y.z' });
  });

  it('returns latest quote contact details in the profile', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'x@y.z', name: 'Phil', emailVerified: true, isActive: true, createdAt: new Date(),
    });
    quoteRequestFindMany.mockResolvedValueOnce([{
      customerPhone: '4505551212',
      shippingAddress: '55 rue Devis',
      city: 'Laval',
      postalCode: 'H7A 1A1',
      country: 'CA',
      createdAt: new Date('2026-02-02T00:00:00Z'),
    }]);
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      phone: '4505551212',
      address: '55 rue Devis',
      city: 'Laval',
      postalCode: 'H7A 1A1',
      country: 'CA',
    });
  });

  it('returns 401 when the customer no longer exists', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);
    expect(res.status).toBe(401);
  });

  it('returns 403 when an old token belongs to an unverified customer', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1,
      email: 'victim@example.com',
      name: 'Unverified',
      emailVerified: false,
      isActive: true,
      createdAt: new Date(),
    });

    const res = await request(makeApp())
      .get('/api/auth/orders')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'victim@example.com')}`]);

    expect(res.status).toBe(403);
    expect(orderFindMany).not.toHaveBeenCalled();
    expect(customOrderFindMany).not.toHaveBeenCalled();
    expect(personalizedQuoteFindMany).not.toHaveBeenCalled();
  });
});

describe('Account deletion confirmation flow', () => {
  it('rejects wrong password with 401', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 4);
    customerFindUnique.mockResolvedValueOnce({
      id: 1, email: 'x@y.z', emailVerified: true, isActive: true, passwordHash,
    });
    const res = await request(makeApp())
      .post('/api/auth/me/delete-request')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .send({ password: 'WrongPass1!' });
    expect(res.status).toBe(401);
  });

  it('sends a confirmation email instead of deleting immediately', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 4);
    customerFindUnique.mockResolvedValueOnce({
      id: 1, name: 'Phil', email: 'x@y.z', emailVerified: true, isActive: true, passwordHash,
    });
    customerUpdate.mockResolvedValueOnce({});

    const res = await request(makeApp())
      .post('/api/auth/me/delete-request')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .set('Origin', 'http://localhost:3000')
      .send({ password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(customerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({
        deleteAccountToken: expect.stringMatching(/^[a-f0-9]+$/),
        deleteAccountExpires: expect.any(Date),
      }),
    }));
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'x@y.z',
      profile: 'system',
      subject: 'Confirm account deletion',
    }));
    expect(sendEmailMock.mock.calls[0][0].text).toContain('http://localhost:3000/delete-account-confirmation?token=');
    expect(customerDelete).not.toHaveBeenCalled();
  });

  it('returns 400 when the confirmation token is invalid', async () => {
    customerFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .post('/api/auth/delete-account/confirm')
      .send({ token: 'invalid-token-value' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the confirmation token has expired', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1,
      email: 'x@y.z',
      deleteAccountToken: 'a'.repeat(20),
      deleteAccountExpires: new Date(Date.now() - 60_000),
    });
    const res = await request(makeApp())
      .post('/api/auth/delete-account/confirm')
      .send({ token: 'a'.repeat(20) });
    expect(res.status).toBe(400);
  });

  it('anonymizes orders and deletes the customer only after email confirmation', async () => {
    customerFindUnique.mockResolvedValueOnce({
      id: 1,
      email: 'x@y.z',
      deleteAccountToken: 'a'.repeat(20),
      deleteAccountExpires: new Date(Date.now() + 60_000),
    });
    $transaction.mockResolvedValueOnce([]);
    orderUpdateMany.mockReturnValue('q1');
    customOrderUpdateMany.mockReturnValue('q2');
    personalizedQuoteUpdateMany.mockReturnValue('q3');
    customerDelete.mockReturnValue('q4');
    const res = await request(makeApp())
      .post('/api/auth/delete-account/confirm')
      .send({ token: 'a'.repeat(20) });
    expect(res.status).toBe(200);
    expect($transaction).toHaveBeenCalledWith(['q1', 'q2', 'q3', 'q4']);
    const { raw } = parseCookies(res.headers['set-cookie']);
    expect(raw.some((c) => c.startsWith('auth_customer='))).toBe(true);
  });
});

describe('cart routes', () => {
  it('GET /cart filters out deleted and unavailable products', async () => {
    cartItemFindMany.mockResolvedValueOnce([
      { id: 11, product: { id: 1, name: 'ok', price: 10, mainImageUrl: null, stockQuantity: 2, soldOut: false, isDeleted: false, variants: [] } },
      { id: 12, product: { id: 2, name: 'gone', price: 10, mainImageUrl: null, stockQuantity: 0, soldOut: false, isDeleted: true, variants: [] } },
      { id: 13, product: { id: 3, name: 'sold', price: 10, mainImageUrl: null, stockQuantity: 0, soldOut: true, isDeleted: false, variants: [] } },
      { id: 14, product: { id: 4, name: 'reserved', price: 10, mainImageUrl: null, stockQuantity: 1, soldOut: true, isDeleted: false, variants: [], reservations: [{ quantity: 1 }] } },
    ]);
    const res = await request(makeApp())
      .get('/api/auth/cart')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(1);
    expect(cartItemDeleteMany).toHaveBeenCalledWith({
      where: { customerId: 1, id: { in: [12, 13] } },
    });
  });

  it('POST /cart/sync rejects non-array items with 400', async () => {
    const res = await request(makeApp())
      .post('/api/auth/cart/sync')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .send({ items: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  it('POST /cart/sync creates or updates each available item', async () => {
    productFindUnique.mockResolvedValue({ id: 1, isDeleted: false, isDraft: false, soldOut: false, variants: [] });
    cartItemFindFirst.mockResolvedValue(null);
    cartItemCreate.mockResolvedValue({});
    cartItemFindMany.mockResolvedValueOnce([]);
    const res = await request(makeApp())
      .post('/api/auth/cart/sync')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .send({ items: [{ id: 1 }, { id: 2 }] });
    expect(res.status).toBe(200);
    expect(cartItemCreate).toHaveBeenCalledTimes(2);
  });

  it('replaces an emptied cart instead of leaving previously saved items', async () => {
    $transaction.mockImplementation(async work => work({ $queryRaw: jest.fn().mockResolvedValue([]), cartItem: { deleteMany: cartItemDeleteMany } }));
    cartItemFindMany.mockResolvedValue([]);
    const res = await request(makeApp()).post('/api/auth/cart/sync')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .send({ items: [], replace: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(cartItemDeleteMany).toHaveBeenCalledWith({ where: { customerId: 1 } });
  });

  it('retains only the selected available variation when replacing a cart', async () => {
    $transaction.mockImplementation(async work => work({
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: { findUnique: productFindUnique },
      cartItem: { findFirst: cartItemFindFirst, update: cartItemUpdate, create: cartItemCreate, deleteMany: cartItemDeleteMany },
    }));
    productFindUnique.mockResolvedValue({ id: 1, isDeleted: false, isDraft: false, soldOut: false, variants: [{ id: 10 }, { id: 11 }] });
    cartItemFindFirst.mockResolvedValue({ id: 101 });
    cartItemFindMany.mockResolvedValue([]);
    const res = await request(makeApp()).post('/api/auth/cart/sync')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .send({ items: [{ id: 1, productVariantId: 11 }], replace: true });
    expect(res.status).toBe(200);
    expect(cartItemFindFirst).toHaveBeenCalledWith({ where: { customerId: 1, productId: 1, productVariantId: 11 } });
    expect(cartItemDeleteMany).toHaveBeenCalledWith({ where: { customerId: 1, id: { notIn: [101] } } });
  });

  it('continues merging saved items on login without deleting the account cart', async () => {
    cartItemFindMany.mockResolvedValue([]);
    const res = await request(makeApp()).post('/api/auth/cart/sync')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`])
      .send({ items: [] });
    expect(res.status).toBe(200);
    expect(cartItemDeleteMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it('DELETE /cart clears all items for the customer', async () => {
    cartItemDeleteMany.mockResolvedValueOnce({});
    const res = await request(makeApp())
      .delete('/api/auth/cart')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);
    expect(res.status).toBe(200);
    expect(cartItemDeleteMany).toHaveBeenCalledWith({ where: { customerId: 1 } });
  });
});

describe('favorite routes', () => {
  it('GET /favorites removes sold products from the customer favorites', async () => {
    favoriteItemFindMany.mockResolvedValueOnce([
      {
        id: 11,
        productVariant: null,
        product: {
          id: 1, name: 'ok', price: 10, mainImageUrl: null, stockQuantity: 1, soldOut: false,
          isDeleted: false, isDraft: false, images: [], category: null, reservations: [], variants: [],
        },
      },
      {
        id: 12,
        productVariant: null,
        product: {
          id: 2, name: 'sold', price: 10, mainImageUrl: null, stockQuantity: 0, soldOut: true,
          isDeleted: false, isDraft: false, images: [], category: null, reservations: [], variants: [],
        },
      },
      {
        id: 13,
        productVariant: null,
        product: {
          id: 3, name: 'reserved', price: 10, mainImageUrl: null, stockQuantity: 1, soldOut: true,
          isDeleted: false, isDraft: false, images: [], category: null, reservations: [{ quantity: 1 }], variants: [],
        },
      },
    ]);

    const res = await request(makeApp())
      .get('/api/auth/favorites')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(1);
    expect(favoriteItemDeleteMany).toHaveBeenCalledWith({
      where: { customerId: 1, id: { in: [12] } },
    });
  });

  it('POST /favorites/:productId rejects sold products and removes stale favorites globally', async () => {
    productFindFirst.mockResolvedValueOnce({
      id: 1, name: 'sold', stockQuantity: 0, soldOut: true, isDeleted: false, isDraft: false, reservations: [], variants: [],
    });

    const res = await request(makeApp())
      .post('/api/auth/favorites/1')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);

    expect(res.status).toBe(409);
    expect(favoriteItemDeleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
    expect(favoriteItemUpsert).not.toHaveBeenCalled();
    expect(favoriteItemCreate).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/orders', () => {
  it('returns orders + customOrders + personalizedQuotes for the customer', async () => {
    orderFindMany.mockResolvedValueOnce([{ id: 1 }]);
    customOrderFindMany.mockResolvedValueOnce([{ id: 2 }]);
    personalizedQuoteFindMany.mockResolvedValueOnce([{ id: 3 }]);
    const res = await request(makeApp())
      .get('/api/auth/orders')
      .set('Cookie', [`auth_customer=${signCustomer(1, 'x@y.z')}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      orders: [{ id: 1 }],
      customOrders: [{ id: 2 }],
      personalizedQuotes: [{ id: 3 }],
    });
  });
});
