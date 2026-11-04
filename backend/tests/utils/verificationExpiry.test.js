import { describe, it, expect, afterEach } from '@jest/globals';
import { verificationTtlHours, verificationExpiresAt, isVerificationExpired } from '../../src/utils/verificationExpiry.js';

const original = process.env.UNVERIFIED_CUSTOMER_TTL_HOURS;
afterEach(() => {
  if (original === undefined) delete process.env.UNVERIFIED_CUSTOMER_TTL_HOURS;
  else process.env.UNVERIFIED_CUSTOMER_TTL_HOURS = original;
});

describe('verification expiry', () => {
  it('uses 48 hours for missing and invalid configuration', () => {
    delete process.env.UNVERIFIED_CUSTOMER_TTL_HOURS;
    expect(verificationTtlHours()).toBe(48);
    for (const invalid of ['', 'bad', '-1', '0']) expect(verificationTtlHours(invalid)).toBe(48);
  });
  it('uses the configured duration and expires at the exact deadline', () => {
    process.env.UNVERIFIED_CUSTOMER_TTL_HOURS = '24';
    const createdAt = new Date(Date.now() - 24 * 3600000);
    expect(verificationExpiresAt(createdAt).getTime()).toBe(createdAt.getTime() + 24 * 3600000);
    expect(isVerificationExpired({ createdAt })).toBe(true);
    expect(isVerificationExpired({ createdAt: new Date() })).toBe(false);
  });
});
