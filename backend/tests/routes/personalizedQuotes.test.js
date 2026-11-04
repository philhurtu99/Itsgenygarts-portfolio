import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';
import { createUploadToken } from '../../src/utils/uploadToken.js';

const quoteCreate = jest.fn();
const quoteFindUnique = jest.fn();
const imageCreate = jest.fn();
const imageUpdate = jest.fn();
const sendEmail = jest.fn(async () => {});

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    personalizedQuote: { create: quoteCreate, findUnique: quoteFindUnique },
    personalizedQuoteImage: { create: imageCreate, update: imageUpdate },
  })),
}));

jest.unstable_mockModule('../../src/services/email.js', () => ({
  sendEmail,
}));

const router = (await import('../../src/routes/personalizedQuotes.js')).default;
const app = buildApp(router);

const validBody = {
  description: 'Un beau chapeau',
  customerName: 'Alice',
  customerEmail: 'alice@test.com',
  customerAddress: '1 rue du test',
  customerCity: 'Montreal',
  customerPostalCode: 'H1A1A1',
  customerCountry: 'CA',
};

beforeEach(() => {
  [quoteCreate, quoteFindUnique, imageCreate, imageUpdate, sendEmail].forEach(fn => fn.mockReset());
});

describe('POST /api/', () => {
  it('blocks US personalized quotes before creating or notifying', async () => {
    const res = await request(app).post('/api/').send({ ...validBody, customerCountry: 'US' });
    expect(res.status).toBe(422);
    expect(quoteCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/').send({ customerName: 'Alice' });
    expect(res.status).toBe(400);
  });

  it('creates a quote and returns 201', async () => {
    quoteCreate.mockResolvedValue({ id: 5, ...validBody });
    const res = await request(app).post('/api/').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(5);
  });
});

describe('POST /api/:id/images', () => {
  it('returns 404 when quote not found', async () => {
    quoteFindUnique.mockResolvedValue(null);
    const token = createUploadToken({ type: 'personalized-quote', id: 99, email: 'alice@test.com' });
    const res = await request(app)
      .post('/api/99/images')
      .field('uploadToken', token)
      .attach('images', Buffer.from('fake'), 'photo.jpg');
    expect(res.status).toBe(404);
  });

  it('returns 400 when no files provided', async () => {
    quoteFindUnique.mockResolvedValue({ id: 1 });
    const token = createUploadToken({ type: 'personalized-quote', id: 1, email: 'alice@test.com' });
    const res = await request(app).post('/api/1/images').field('uploadToken', token);
    expect(res.status).toBe(400);
  });

  it('rejects uploads without a valid token', async () => {
    const res = await request(app)
      .post('/api/1/images')
      .attach('images', Buffer.from('fake'), 'photo.jpg');
    expect(res.status).toBe(403);
    expect(quoteFindUnique).not.toHaveBeenCalled();
  });
});
