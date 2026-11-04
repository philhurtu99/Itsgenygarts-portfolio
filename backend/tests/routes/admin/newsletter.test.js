import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../../helpers/app.js';
import { makeAdminToken } from '../../helpers/adminToken.js';

const customerCount = jest.fn();
const customerFindMany = jest.fn();
const userFindUnique = jest.fn(async () => ({
  id: 1,
  email: 'admin@test.com',
  username: 'admin',
  role: 'ADMIN',
  isActive: true,
}));
const sendEmail = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: userFindUnique },
    customer: { count: customerCount, findMany: customerFindMany },
  })),
}));

jest.unstable_mockModule('../../../src/services/email.js', () => ({
  sendEmail,
}));

const router = (await import('../../../src/routes/admin/newsletter.js')).default;
const app = buildApp(router);
const token = makeAdminToken();
const auth = () => ({ Cookie: `auth_admin=${token}` });

beforeEach(() => {
  [customerCount, customerFindMany, userFindUnique, sendEmail].forEach((fn) => fn.mockClear());
  userFindUnique.mockResolvedValue({
    id: 1,
    email: 'admin@test.com',
    username: 'admin',
    role: 'ADMIN',
    isActive: true,
  });
});

describe('POST /api/send', () => {
  it('sends the matching newsletter language to each subscriber', async () => {
    customerFindMany.mockResolvedValue([
      { email: 'fr@test.com', name: 'Alice', preferredLanguage: 'fr' },
      { email: 'en@test.com', name: 'Bob', preferredLanguage: 'en' },
    ]);

    const res = await request(app)
      .post('/api/send')
      .set(auth())
      .send({
        subjectFr: 'Nouveautés crochet',
        bodyFr: 'Bonjour en français.',
        subjectEn: 'Crochet news',
        bodyEn: 'Hello in English.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: 2, total: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: 'fr@test.com',
      lang: 'fr',
      subject: 'Nouveautés crochet',
      text: expect.stringContaining('Bonjour en français.'),
    }));
    expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({
      to: 'en@test.com',
      lang: 'en',
      subject: 'Crochet news',
      text: expect.stringContaining('Hello in English.'),
    }));
  });

  it('rejects incomplete bilingual newsletters', async () => {
    const res = await request(app)
      .post('/api/send')
      .set(auth())
      .send({
        subjectFr: 'Sujet',
        bodyFr: 'Message',
      });

    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
