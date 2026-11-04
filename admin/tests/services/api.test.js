import {
  adminLogin,
  adminMe,
  adminCreateSessionToken,
  adminLogout,
  adminGetProducts,
  adminCreateProduct,
  adminUpdateStock,
  adminDeleteProduct,
  adminSearchDatabase,
} from '../../src/services/api.js';

const API_BASE = 'http://localhost:5000/api';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

function mockJson(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('admin api client', () => {
  it('adminLogin POSTs to /admin/auth/login with credentials included', async () => {
    mockJson(200, { data: { email: 'a@b.co' } });
    await adminLogin({ email: 'a@b.co', password: 'x' });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/auth/login`);
    expect(opts.method).toBe('POST');
    expect(opts.credentials).toBe('include');
    expect(JSON.parse(opts.body)).toEqual({ email: 'a@b.co', password: 'x' });
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('adminMe GETs /admin/auth/me with credentials', async () => {
    mockJson(200, { data: { email: 'admin@x.co' } });
    const out = await adminMe();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/auth/me`);
    expect(opts.method).toBe('GET');
    expect(opts.credentials).toBe('include');
    expect(out).toEqual({ email: 'admin@x.co' });
  });

  it('adminCreateSessionToken POSTs to /admin/auth/session-token', async () => {
    mockJson(200, { data: { token: 'fresh-token' } });
    const out = await adminCreateSessionToken();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/auth/session-token`);
    expect(opts.method).toBe('POST');
    expect(opts.credentials).toBe('include');
    expect(out).toEqual({ token: 'fresh-token' });
  });

  it('adminLogout POSTs /admin/auth/logout with credentials', async () => {
    mockJson(200, { success: true });
    await adminLogout();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/auth/logout`);
    expect(opts.method).toBe('POST');
    expect(opts.credentials).toBe('include');
  });

  it('adminGetProducts GETs with credentials and no auth header', async () => {
    mockJson(200, { data: [] });
    await adminGetProducts();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/products`);
    expect(opts.method).toBe('GET');
    expect(opts.credentials).toBe('include');
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('adminCreateProduct POSTs body without auth header', async () => {
    mockJson(201, { data: { id: 1 } });
    await adminCreateProduct({ name: 'X' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.credentials).toBe('include');
    expect(JSON.parse(opts.body)).toEqual({ name: 'X' });
  });

  it('adminUpdateStock PATCHes with { stock }', async () => {
    mockJson(200, { data: { id: 1, stock: 5 } });
    await adminUpdateStock(1, 5);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/products/1/stock`);
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ stock: 5 });
  });

  it('adminDeleteProduct sends DELETE without body', async () => {
    mockJson(200, { data: null });
    await adminDeleteProduct(42);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/products/42`);
    expect(opts.method).toBe('DELETE');
    expect(opts.body).toBeUndefined();
  });

  it('unwraps json.data when present', async () => {
    mockJson(200, { data: { hello: 'world' } });
    const out = await adminGetProducts();
    expect(out).toEqual({ hello: 'world' });
  });

  it('returns full body when data field is absent', async () => {
    mockJson(200, { direct: 'value' });
    const out = await adminGetProducts();
    expect(out).toEqual({ direct: 'value' });
  });

  it('throws with server message on non-2xx', async () => {
    mockJson(400, { message: 'Bad inputs' });
    await expect(adminGetProducts()).rejects.toThrow('Bad inputs');
  });

  it('throws with HTTP code when body is empty', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });
    await expect(adminGetProducts()).rejects.toThrow(/HTTP 500/);
  });

  it('adminSearchDatabase GETs encoded search params', async () => {
    mockJson(200, { data: { customers: [], transactions: [] } });
    await adminSearchDatabase({ query: 'alice@test.com', limit: 30 });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/search?q=alice%40test.com&limit=30`);
    expect(opts.method).toBe('GET');
    expect(opts.credentials).toBe('include');
  });
});
