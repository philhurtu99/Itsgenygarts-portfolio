import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  setAuthCookie,
  clearAuthCookie,
  readAuthCookie,
  COOKIE_NAMES,
} from '../../src/utils/authCookie.js';

function makeRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

const ORIGINAL_ENV = process.env.NODE_ENV;
const ORIGINAL_FRONTEND_URL = process.env.FRONTEND_URL;
const ORIGINAL_ADMIN_URL = process.env.ADMIN_URL;
const ORIGINAL_CORS_ORIGIN = process.env.CORS_ORIGIN;
const ORIGINAL_AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE;
const ORIGINAL_COOKIE_SECURE = process.env.COOKIE_SECURE;
const ORIGINAL_AUTH_COOKIE_SAMESITE = process.env.AUTH_COOKIE_SAMESITE;
const ORIGINAL_COOKIE_SAMESITE = process.env.COOKIE_SAMESITE;

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv('NODE_ENV', ORIGINAL_ENV);
  restoreEnv('FRONTEND_URL', ORIGINAL_FRONTEND_URL);
  restoreEnv('ADMIN_URL', ORIGINAL_ADMIN_URL);
  restoreEnv('CORS_ORIGIN', ORIGINAL_CORS_ORIGIN);
  restoreEnv('AUTH_COOKIE_SECURE', ORIGINAL_AUTH_COOKIE_SECURE);
  restoreEnv('COOKIE_SECURE', ORIGINAL_COOKIE_SECURE);
  restoreEnv('AUTH_COOKIE_SAMESITE', ORIGINAL_AUTH_COOKIE_SAMESITE);
  restoreEnv('COOKIE_SAMESITE', ORIGINAL_COOKIE_SAMESITE);
});

describe('authCookie', () => {
  describe('COOKIE_NAMES', () => {
    it('exposes stable names for customer and admin', () => {
      expect(COOKIE_NAMES.customer).toBe('auth_customer');
      expect(COOKIE_NAMES.admin).toBe('auth_admin');
    });
  });

  describe('setAuthCookie', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      delete process.env.AUTH_COOKIE_SECURE;
      delete process.env.COOKIE_SECURE;
      delete process.env.AUTH_COOKIE_SAMESITE;
      delete process.env.COOKIE_SAMESITE;
      delete process.env.FRONTEND_URL;
      delete process.env.ADMIN_URL;
      delete process.env.CORS_ORIGIN;
    });

    it('sets the admin cookie with httpOnly and default 30-day maxAge', () => {
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok');
      expect(res.cookie).toHaveBeenCalledTimes(1);
      const [name, value, opts] = res.cookie.mock.calls[0];
      expect(name).toBe('auth_admin');
      expect(value).toBe('tok');
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
      expect(opts.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('sets the customer cookie under the right name', () => {
      const res = makeRes();
      setAuthCookie(res, 'customer', 'tok');
      expect(res.cookie.mock.calls[0][0]).toBe('auth_customer');
    });

    it('honors an explicit maxAgeMs override', () => {
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok', { maxAgeMs: 1000 });
      expect(res.cookie.mock.calls[0][2].maxAge).toBe(1000);
    });

    it('secure=false when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'development';
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok');
      expect(res.cookie.mock.calls[0][2].secure).toBe(false);
    });

    it('secure=true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok');
      expect(res.cookie.mock.calls[0][2].secure).toBe(true);
    });

    it('secure=false in production when all configured origins are local http', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'http://10.0.0.168:5173';
      process.env.CORS_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5174';
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok');
      expect(res.cookie.mock.calls[0][2].secure).toBe(false);
    });

    it('allows AUTH_COOKIE_SECURE to override automatic secure behavior', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'http://10.0.0.168:5173';
      process.env.AUTH_COOKIE_SECURE = 'true';
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok');
      expect(res.cookie.mock.calls[0][2].secure).toBe(true);
    });

    it('allows AUTH_COOKIE_SAMESITE to override SameSite', () => {
      process.env.AUTH_COOKIE_SAMESITE = 'none';
      const res = makeRes();
      setAuthCookie(res, 'admin', 'tok');
      expect(res.cookie.mock.calls[0][2].sameSite).toBe('none');
    });

    it('throws on unknown cookie type', () => {
      expect(() => setAuthCookie(makeRes(), 'bogus', 'tok')).toThrow(/Unknown auth cookie type/);
    });
  });

  describe('clearAuthCookie', () => {
    it('clears the admin cookie with matching base options', () => {
      const res = makeRes();
      clearAuthCookie(res, 'admin');
      expect(res.clearCookie).toHaveBeenCalledTimes(1);
      const [name, opts] = res.clearCookie.mock.calls[0];
      expect(name).toBe('auth_admin');
      expect(opts.httpOnly).toBe(true);
      expect(opts.path).toBe('/');
      expect(opts.maxAge).toBeUndefined();
    });

    it('clears the customer cookie', () => {
      const res = makeRes();
      clearAuthCookie(res, 'customer');
      expect(res.clearCookie.mock.calls[0][0]).toBe('auth_customer');
    });

    it('throws on unknown cookie type', () => {
      expect(() => clearAuthCookie(makeRes(), 'bogus')).toThrow(/Unknown auth cookie type/);
    });
  });

  describe('readAuthCookie', () => {
    it('returns the admin cookie value when present', () => {
      const req = { cookies: { auth_admin: 'xyz' } };
      expect(readAuthCookie(req, 'admin')).toBe('xyz');
    });

    it('returns the customer cookie value when present', () => {
      const req = { cookies: { auth_customer: 'cust-tok' } };
      expect(readAuthCookie(req, 'customer')).toBe('cust-tok');
    });

    it('returns null when the cookie is not set', () => {
      const req = { cookies: {} };
      expect(readAuthCookie(req, 'admin')).toBeNull();
    });

    it('returns null when req has no cookies object', () => {
      expect(readAuthCookie({}, 'admin')).toBeNull();
    });
  });
});
