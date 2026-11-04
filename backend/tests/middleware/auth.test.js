import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const userFindUnique = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: class {
    user = { findUnique: userFindUnique };
  },
}));

const { requireAdmin } = await import('../../src/middleware/auth.js');

function makeRes() {
  return {
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (body) { this.body = body; return this; }),
  };
}

function signToken(payload = { type: 'admin', id: 1, role: 'ADMIN' }, opts = { expiresIn: '1h' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, opts);
}

function activeAdmin(overrides = {}) {
  return {
    id: 1,
    email: 'admin@example.com',
    username: 'admin',
    role: 'ADMIN',
    isActive: true,
    ...overrides,
  };
}

describe('requireAdmin', () => {
  beforeEach(() => {
    userFindUnique.mockReset();
  });

  it('returns 401 when no token is provided (no header, no cookie)', async () => {
    const req = { headers: {}, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc' }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is invalid', async () => {
    const req = { headers: { authorization: 'Bearer garbage-token' }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid Bearer token for an active admin', async () => {
    userFindUnique.mockResolvedValueOnce(activeAdmin());
    const token = signToken();
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 1, role: 'ADMIN' });
  });

  it('accepts a valid token from the admin auth cookie', async () => {
    userFindUnique.mockResolvedValueOnce(activeAdmin({ id: 7 }));
    const token = signToken({ type: 'admin', id: 7, role: 'ADMIN' });
    const req = { headers: {}, cookies: { auth_admin: token } };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 7, role: 'ADMIN' });
  });

  it('prefers the cookie over the Authorization header when both are present', async () => {
    userFindUnique.mockResolvedValueOnce(activeAdmin({ id: 111 }));
    const cookieToken = signToken({ type: 'admin', id: 111 });
    const bearerToken = signToken({ type: 'admin', id: 222 });
    const req = {
      headers: { authorization: `Bearer ${bearerToken}` },
      cookies: { auth_admin: cookieToken },
    };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.id).toBe(111);
  });

  it('returns 401 when the cookie token is invalid', async () => {
    const req = { headers: {}, cookies: { auth_admin: 'nope' } };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired Bearer token', async () => {
    const token = signToken({ type: 'admin', id: 1 }, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a customer token even when signed with the same secret', async () => {
    const token = signToken({ type: 'customer', id: 1, role: 'ADMIN' });
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the user is inactive', async () => {
    userFindUnique.mockResolvedValueOnce(activeAdmin({ isActive: false }));
    const token = signToken();
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the user is not an admin', async () => {
    userFindUnique.mockResolvedValueOnce(activeAdmin({ role: 'User' }));
    const token = signToken();
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = makeRes();
    const next = jest.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
