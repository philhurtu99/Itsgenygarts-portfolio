import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userFindUnique = jest.fn();
const userCreate = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: class {
    user = { findUnique: userFindUnique, create: userCreate };
  },
}));

const adminAuthRouter = (await import('../../src/routes/admin/auth.js')).default;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin/auth', adminAuthRouter);
  return app;
}

function parseCookies(setCookie) {
  const header = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
  const map = {};
  for (const line of header) {
    const [pair] = line.split(';');
    const [name, ...rest] = pair.split('=');
    map[name.trim()] = rest.join('=');
  }
  return { map, raw: header };
}

beforeEach(() => {
  userFindUnique.mockReset();
  userCreate.mockReset();
});

describe('POST /api/admin/auth/login', () => {
  it('returns 400 when credentials are missing', async () => {
    const res = await request(makeApp()).post('/api/admin/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when the user is not found', async () => {
    userFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .post('/api/admin/auth/login')
      .send({ email: 'a@b.c', password: 'pw' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when the user is inactive', async () => {
    userFindUnique.mockResolvedValueOnce({
      id: 1, email: 'a@b.c', passwordHash: 'x', isActive: false,
    });
    const res = await request(makeApp())
      .post('/api/admin/auth/login')
      .send({ email: 'a@b.c', password: 'pw' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on wrong password', async () => {
    const passwordHash = await bcrypt.hash('good', 4);
    userFindUnique.mockResolvedValueOnce({
      id: 1, email: 'a@b.c', passwordHash, isActive: true, role: 'ADMIN', username: 'a',
    });
    const res = await request(makeApp())
      .post('/api/admin/auth/login')
      .send({ email: 'a@b.c', password: 'bad' });
    expect(res.status).toBe(401);
  });

  it('sets an httpOnly auth_admin cookie and returns the user on success', async () => {
    const passwordHash = await bcrypt.hash('good', 4);
    userFindUnique.mockResolvedValueOnce({
      id: 7, email: 'a@b.c', passwordHash, isActive: true, role: 'ADMIN', username: 'a',
    });
    const res = await request(makeApp())
      .post('/api/admin/auth/login')
      .send({ email: 'a@b.c', password: 'good' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 7, email: 'a@b.c', role: 'ADMIN' });
    expect(res.body.data.token).toBeTruthy();
    const { map, raw } = parseCookies(res.headers['set-cookie']);
    expect(map.auth_admin).toBeTruthy();
    expect(raw[0].toLowerCase()).toContain('httponly');
    const decoded = jwt.verify(map.auth_admin, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ type: 'admin', id: 7, role: 'ADMIN' });
    const decodedBodyToken = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(decodedBodyToken).toMatchObject({ type: 'admin', id: 7, role: 'ADMIN' });
  });
});

describe('POST /api/admin/auth/logout', () => {
  it('clears the auth_admin cookie', async () => {
    const res = await request(makeApp()).post('/api/admin/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { raw } = parseCookies(res.headers['set-cookie']);
    expect(raw.some((c) => c.startsWith('auth_admin='))).toBe(true);
    expect(raw[0]).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });
});

describe('GET /api/admin/auth/me', () => {
  it('returns 401 when no cookie or header is provided', async () => {
    const res = await request(makeApp()).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the user when the admin cookie is valid', async () => {
    userFindUnique.mockResolvedValueOnce({
      id: 7, email: 'a@b.c', username: 'a', role: 'ADMIN', isActive: true,
    });
    const token = jwt.sign({ type: 'admin', id: 7, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(makeApp())
      .get('/api/admin/auth/me')
      .set('Cookie', [`auth_admin=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 7, email: 'a@b.c' });
  });

  it('returns 401 when the user behind the token is inactive', async () => {
    userFindUnique.mockResolvedValueOnce({
      id: 7, email: 'a@b.c', role: 'ADMIN', isActive: false,
    });
    const token = jwt.sign({ type: 'admin', id: 7, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(makeApp())
      .get('/api/admin/auth/me')
      .set('Cookie', [`auth_admin=${token}`]);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/auth/session-token', () => {
  it('returns a fresh bearer token when the admin cookie is valid', async () => {
    userFindUnique.mockResolvedValueOnce({
      id: 7, email: 'a@b.c', username: 'a', role: 'ADMIN', isActive: true,
    });
    const token = jwt.sign({ type: 'admin', id: 7, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(makeApp())
      .post('/api/admin/auth/session-token')
      .set('Cookie', [`auth_admin=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ type: 'admin', id: 7, role: 'ADMIN' });
  });
});

describe('POST /api/admin/auth/register', () => {
  function adminCookie() {
    const token = jwt.sign({ type: 'admin', id: 7, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    userFindUnique.mockResolvedValueOnce({
      id: 7, email: 'admin@x.co', username: 'admin', role: 'ADMIN', isActive: true,
    });
    return [`auth_admin=${token}`];
  }

  it('requires an authenticated admin', async () => {
    const res = await request(makeApp())
      .post('/api/admin/auth/register')
      .send({ username: 'u', email: 'u@x.co', password: 'pw' });
    expect(res.status).toBe(401);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(makeApp())
      .post('/api/admin/auth/register')
      .set('Cookie', adminCookie())
      .send({ username: 'u' });
    expect(res.status).toBe(400);
  });

  it('creates the user and returns it without the password hash', async () => {
    userCreate.mockResolvedValueOnce({
      id: 1, username: 'u', email: 'u@x.co', role: 'User', createdAt: new Date('2024-01-01'),
    });
    const res = await request(makeApp())
      .post('/api/admin/auth/register')
      .set('Cookie', adminCookie())
      .send({ username: 'u', email: 'u@x.co', password: 'pw' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 1, username: 'u', role: 'User' });
    const hash = userCreate.mock.calls[0][0].data.passwordHash;
    expect(hash).not.toBe('pw');
    expect(await bcrypt.compare('pw', hash)).toBe(true);
  });
});
