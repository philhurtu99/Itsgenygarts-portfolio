import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { buildApp } from '../helpers/app.js';
import { createPrivateMediaUrl } from '../../src/utils/privateMedia.js';
import privateMediaRouter from '../../src/routes/privateMedia.js';

const app = buildApp(privateMediaRouter);

describe('GET /api/:area/:filename', () => {
  it('rejects an invalid capability token', async () => {
    const res = await request(app)
      .get('/api/custom-orders/123.jpg?token=invalid');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when a valid token points to a missing file', async () => {
    const signedPath = createPrivateMediaUrl('/uploads/quotes/999999999.jpg')
      .replace('/api/private-media', '/api');
    const res = await request(app).get(signedPath);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rejects unsupported paths before attempting token verification', async () => {
    const res = await request(app)
      .get('/api/products/123.jpg?token=invalid');

    expect(res.status).toBe(404);
  });
});
