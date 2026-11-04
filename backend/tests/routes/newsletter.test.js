import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';
import { createNewsletterUnsubscribeToken } from '../../src/utils/newsletterUnsubscribe.js';

const updateMany = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    customer: { updateMany },
  })),
}));

const router = (await import('../../src/routes/newsletter.js')).default;
const app = buildApp(router);

beforeEach(() => {
  updateMany.mockReset();
});

describe('GET /api/unsubscribe', () => {
  it('turns off newsletterConsent for the signed email', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const token = createNewsletterUnsubscribeToken('Client@Example.com');

    const res = await request(app).get(`/api/unsubscribe?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Désabonnement confirmé');
    expect(updateMany).toHaveBeenCalledWith({
      where: { email: 'client@example.com' },
      data: { newsletterConsent: false },
    });
  });

  it('rejects invalid tokens without changing preferences', async () => {
    const res = await request(app).get('/api/unsubscribe?token=bad');

    expect(res.status).toBe(400);
    expect(res.text).toContain('Lien invalide');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('supports one-click unsubscribe POST requests', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const token = createNewsletterUnsubscribeToken('client@example.com');

    const res = await request(app).post(`/api/unsubscribe?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { email: 'client@example.com' },
      data: { newsletterConsent: false },
    });
  });
});
