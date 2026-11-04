import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
  authLimiter,
  actionLimiter,
  analyticsLimiter,
  shippingQuoteLimiter,
  verificationResendLimiter,
} from '../../src/middleware/rateLimit.js';

function buildApp(limiter) {
  const app = express();
  app.set('trust proxy', 1);
  app.get('/ping', limiter, (req, res) => res.json({ ok: true }));
  return app;
}

// Rate-limiters share an in-memory store across tests; we isolate tests by
// setting a unique X-Forwarded-For IP per test so each has its own counter.
function forward(reqAgent, ip) {
  return reqAgent.set('X-Forwarded-For', ip);
}

describe('authLimiter', () => {
  it('allows 10 requests under the threshold', async () => {
    const app = buildApp(authLimiter);
    for (let i = 0; i < 10; i++) {
      const r = await forward(request(app).get('/ping'), '10.0.0.1');
      expect(r.status).toBe(200);
    }
  });

  it('returns 429 with a French error message past 10 requests', async () => {
    const app = buildApp(authLimiter);
    for (let i = 0; i < 10; i++) await forward(request(app).get('/ping'), '10.0.0.2');
    const r = await forward(request(app).get('/ping'), '10.0.0.2');
    expect(r.status).toBe(429);
    expect(r.body.success).toBe(false);
    expect(r.body.message).toMatch(/15 minutes/);
  });
});

describe('verificationResendLimiter', () => {
  it('limits one request per address even across different IPs', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.post('/resend', verificationResendLimiter, (req, res) => res.sendStatus(202));
    expect((await forward(request(app).post('/resend'), '10.0.3.1').send({ email: 'resend@test.com' })).status).toBe(202);
    const blocked = await forward(request(app).post('/resend'), '10.0.3.2').send({ email: 'resend@test.com' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('VERIFICATION_COOLDOWN');
    expect((await request(app).post('/resend').send({ email: 'other@test.com' })).status).toBe(202);
  });
});

describe('actionLimiter', () => {
  it('allows up to 30 requests', async () => {
    const app = buildApp(actionLimiter);
    for (let i = 0; i < 30; i++) {
      const r = await forward(request(app).get('/ping'), '10.0.1.1');
      expect(r.status).toBe(200);
    }
  });

  it('blocks the 31st request with 429', async () => {
    const app = buildApp(actionLimiter);
    for (let i = 0; i < 30; i++) await forward(request(app).get('/ping'), '10.0.1.2');
    const r = await forward(request(app).get('/ping'), '10.0.1.2');
    expect(r.status).toBe(429);
    expect(r.body.message).toMatch(/Trop de requêtes/);
  });

  it('uses a separate request budget from analytics traffic', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.get('/page-view', analyticsLimiter, (req, res) => res.json({ ok: true }));
    app.get('/checkout', actionLimiter, (req, res) => res.json({ ok: true }));

    for (let i = 0; i < 30; i++) {
      const response = await forward(request(app).get('/page-view'), '10.0.1.3');
      expect(response.status).toBe(200);
    }

    const checkout = await forward(request(app).get('/checkout'), '10.0.1.3');
    expect(checkout.status).toBe(200);
    expect(checkout.headers['ratelimit-limit']).toBe('30');
    expect(checkout.headers['ratelimit-remaining']).toBe('29');
  });
});

describe('shippingQuoteLimiter', () => {
  it('blocks the 11th shipping quote from one IP within 15 minutes', async () => {
    const app = buildApp(shippingQuoteLimiter);
    for (let i = 0; i < 10; i++) {
      const r = await forward(request(app).get('/ping'), '10.0.2.1');
      expect(r.status).toBe(200);
    }
    const r = await forward(request(app).get('/ping'), '10.0.2.1');
    expect(r.status).toBe(429);
    expect(r.body.message).toMatch(/calculs de livraison/);
  });
});
