import { afterEach, describe, expect, it } from '@jest/globals';
import {
  createNewsletterUnsubscribeToken,
  verifyNewsletterUnsubscribeToken,
} from '../../src/utils/newsletterUnsubscribe.js';

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = originalJwtSecret;
});

describe('newsletter unsubscribe tokens', () => {
  it('fails closed when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => createNewsletterUnsubscribeToken('client@example.com'))
      .toThrow('JWT_SECRET is required for newsletter unsubscribe tokens');
  });

  it('creates and verifies a scoped unsubscribe token', () => {
    process.env.JWT_SECRET = 'newsletter-test-secret';

    const token = createNewsletterUnsubscribeToken('Client@Example.com');

    expect(verifyNewsletterUnsubscribeToken(token)).toBe('client@example.com');
  });
});
