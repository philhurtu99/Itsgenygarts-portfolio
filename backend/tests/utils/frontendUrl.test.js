import { describe, it, expect, afterEach } from '@jest/globals';
import { getConfiguredFrontendUrl, getStorefrontUrl } from '../../src/utils/frontendUrl.js';

const originalEnv = {
  FRONTEND_URL: process.env.FRONTEND_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
};

function makeReq(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    get(name) {
      return normalized[name.toLowerCase()];
    },
  };
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('frontend URL helpers', () => {
  it('falls back to the configured frontend URL', () => {
    process.env.FRONTEND_URL = 'http://configured.test';

    expect(getConfiguredFrontendUrl()).toBe('http://configured.test');
    expect(getStorefrontUrl(makeReq())).toBe('http://configured.test');
  });

  it('uses the request storefront origin in local development', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    expect(getStorefrontUrl(makeReq({ Origin: 'http://localhost:3000' }))).toBe('http://localhost:3000');
    expect(getStorefrontUrl(makeReq({ Origin: 'http://172.20.10.3:3000' }))).toBe('http://172.20.10.3:3000');
  });

  it('does not use admin origins for customer-facing links', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    expect(getStorefrontUrl(makeReq({ Origin: 'http://localhost:3002' }))).toBe('http://localhost:3000');
    expect(getStorefrontUrl(makeReq({ Origin: 'http://172.20.10.3:5174' }))).toBe('http://localhost:3000');
  });

  it('does not trust unknown origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.CORS_ORIGIN = 'http://localhost:3000';

    expect(getStorefrontUrl(makeReq({ Origin: 'https://evil.test' }))).toBe('http://localhost:3000');
  });
});
