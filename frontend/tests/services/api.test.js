import {
  getProducts,
  getProduct,
  getProductsByCategory,
  getFeaturedProducts,
  getCategories,
  createCustomOrder,
  createQuoteRequest,
  uploadCustomOrderImages,
  createPersonalizedQuote,
  customerRegister,
  customerLogin,
  customerLogout,
  getCustomerProfile,
  getCustomerOrders,
  requestDeleteCustomerAccount,
  confirmDeleteCustomerAccount,
  verifyEmail,
  forgotPassword,
  resetPassword,
  cancelPendingOrder,
  checkout,
  calculateShipping,
  getCurrencies,
  downloadInvoice,
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

describe('frontend api client', () => {
  describe('GET helpers', () => {
    it('getProducts GETs /products with credentials', async () => {
      mockJson(200, { data: [] });
      await getProducts();
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/products`);
      expect(opts.method).toBe('GET');
      expect(opts.credentials).toBe('include');
    });

    it('getProduct appends the id to the path', async () => {
      mockJson(200, { data: { id: 1 } });
      await getProduct(1);
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/products/1`);
    });

    it('getProductsByCategory url-encodes the category', async () => {
      mockJson(200, { data: [] });
      await getProductsByCategory('Hats & Scarves');
      expect(global.fetch.mock.calls[0][0]).toBe(
        `${API_BASE}/products?category=Hats%20%26%20Scarves`,
      );
    });

    it('getFeaturedProducts defaults limit to 6', async () => {
      mockJson(200, { data: [] });
      await getFeaturedProducts();
      expect(global.fetch.mock.calls[0][0]).toBe(
        `${API_BASE}/products?featured=true&limit=6`,
      );
    });

    it('getCategories calls /categories', async () => {
      mockJson(200, { data: [] });
      await getCategories();
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/categories`);
    });

    it('getCurrencies calls /orders/currencies', async () => {
      mockJson(200, { data: [] });
      await getCurrencies();
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/orders/currencies`);
    });
  });

  describe('POST helpers', () => {
    it('createCustomOrder POSTs body to /custom-orders', async () => {
      mockJson(201, { data: { id: 1 } });
      await createCustomOrder({ name: 'x' });
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/custom-orders`);
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ name: 'x' });
    });

    it('createPersonalizedQuote POSTs body', async () => {
      mockJson(201, { data: { id: 1 } });
      await createPersonalizedQuote({ foo: 'bar' });
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/personalized-quotes`);
      expect(JSON.parse(opts.body)).toEqual({ foo: 'bar' });
    });

    it('createQuoteRequest maps customer fields to /quotes payload', async () => {
      mockJson(201, { data: { id: 1 } });
      await createQuoteRequest({
        customer: {
          name: 'Ada',
          email: 'ada@example.com',
          phone: '(514)-555-1212',
          address: '123 Main',
          city: 'Montreal',
          postalCode: 'H2X 1Y4',
          country: 'Canada',
          notes: 'Details',
        },
        items: [{ productId: 1, quantity: 2 }],
      });
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/quotes`);
      expect(JSON.parse(opts.body)).toEqual({
        customerName: 'Ada',
        customerEmail: 'ada@example.com',
        customerPhone: '(514)-555-1212',
        shippingAddress: '123 Main',
        city: 'Montreal',
        postalCode: 'H2X 1Y4',
        country: 'Canada',
        message: 'Details',
        items: [{ productId: 1, quantity: 2 }],
      });
    });

    it('customerRegister POSTs /auth/register', async () => {
      mockJson(201, { data: {} });
      await customerRegister({ email: 'a@b.c', password: 'pw' });
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/auth/register`);
    });

    it('customerLogin POSTs /auth/login', async () => {
      mockJson(200, { data: {} });
      await customerLogin({ email: 'a@b.c', password: 'pw' });
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/auth/login`);
    });

    it('customerLogout POSTs /auth/logout', async () => {
      mockJson(200, { success: true });
      await customerLogout();
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/auth/logout`);
      expect(opts.method).toBe('POST');
    });

    it('forgotPassword POSTs /auth/forgot-password with { email }', async () => {
      mockJson(200, { success: true });
      await forgotPassword('a@b.c');
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/auth/forgot-password`);
      expect(JSON.parse(opts.body)).toEqual({ email: 'a@b.c' });
    });

    it('resetPassword POSTs /auth/reset-password with token + password', async () => {
      mockJson(200, { success: true });
      await resetPassword('tok', 'pw');
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/auth/reset-password`);
      expect(JSON.parse(opts.body)).toEqual({ token: 'tok', password: 'pw' });
    });

    it('checkout POSTs to /orders/checkout', async () => {
      mockJson(200, { data: { url: 'https://stripe' } });
      await checkout({ items: [] });
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/orders/checkout`);
    });

    it('cancelPendingOrder POSTs the cancel token', async () => {
      mockJson(200, { success: true });
      await cancelPendingOrder('tok');
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/orders/cancel-pending`);
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ token: 'tok' });
    });

    it('calculateShipping POSTs to /orders/calculate-shipping', async () => {
      mockJson(200, { data: {} });
      await calculateShipping({ country: 'CA' });
      expect(global.fetch.mock.calls[0][0]).toBe(
        `${API_BASE}/orders/calculate-shipping`,
      );
    });
  });

  describe('GET auth helpers', () => {
    it('verifyEmail builds url with token', async () => {
      mockJson(200, { success: true });
      await verifyEmail('abc');
      expect(global.fetch.mock.calls[0][0]).toBe(
        `${API_BASE}/auth/verify-email?token=abc`,
      );
    });

    it('getCustomerProfile GETs /auth/me', async () => {
      mockJson(200, { data: { email: 'x' } });
      await getCustomerProfile();
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/auth/me`);
    });

    it('getCustomerOrders GETs /auth/orders', async () => {
      mockJson(200, { data: { orders: [] } });
      await getCustomerOrders();
      expect(global.fetch.mock.calls[0][0]).toBe(`${API_BASE}/auth/orders`);
    });

    it('requestDeleteCustomerAccount POSTs /auth/me/delete-request with password body', async () => {
      mockJson(200, { success: true });
      await requestDeleteCustomerAccount('pw');
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/auth/me/delete-request`);
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ password: 'pw' });
    });

    it('confirmDeleteCustomerAccount POSTs the confirmation token', async () => {
      mockJson(200, { success: true });
      await confirmDeleteCustomerAccount('abc');
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/auth/delete-account/confirm`);
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ token: 'abc' });
    });
  });

  describe('multipart uploads', () => {
    it('uploadCustomOrderImages POSTs FormData with credentials', async () => {
      mockJson(200, { data: { uploaded: 2 } });
      const files = [new File(['a'], 'a.png'), new File(['b'], 'b.png')];
      await uploadCustomOrderImages(5, files);
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe(`${API_BASE}/custom-orders/5/images`);
      expect(opts.method).toBe('POST');
      expect(opts.credentials).toBe('include');
      expect(opts.body).toBeInstanceOf(FormData);
      expect(opts.body.getAll('images')).toHaveLength(2);
    });

    it('uploadCustomOrderImages throws on non-2xx', async () => {
      mockJson(500, { message: 'oops' });
      await expect(
        uploadCustomOrderImages(1, [new File(['a'], 'a.png')]),
      ).rejects.toThrow('oops');
    });
  });

  describe('unwrap + errors', () => {
    it('unwraps json.data when present', async () => {
      mockJson(200, { data: { hello: 'world' } });
      const out = await getProducts();
      expect(out).toEqual({ hello: 'world' });
    });

    it('returns full body when data field is absent', async () => {
      mockJson(200, { direct: 'value' });
      const out = await getProducts();
      expect(out).toEqual({ direct: 'value' });
    });

    it('throws with server message on non-2xx', async () => {
      mockJson(400, { message: 'Bad' });
      await expect(getProducts()).rejects.toThrow('Bad');
    });

    it('falls back to error field when message is absent', async () => {
      mockJson(400, { error: 'validation failed' });
      await expect(getProducts()).rejects.toThrow('validation failed');
    });

    it('throws HTTP <status> when body cannot be parsed', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('not json')),
      });
      await expect(getProducts()).rejects.toThrow(/HTTP 503/);
    });
  });

  describe('downloadInvoice', () => {
    let createObjectURL, revokeObjectURL;

    beforeEach(() => {
      createObjectURL = jest.fn(() => 'blob:mock');
      revokeObjectURL = jest.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;
    });

    it('fetches the PDF and triggers a download with the disposition filename', async () => {
      const blob = new Blob(['pdf'], { type: 'application/pdf' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'attachment; filename="FACT-2024-000042.pdf"' },
        blob: () => Promise.resolve(blob),
      });
      const anchor = document.createElement('a');
      const clickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
      jest.spyOn(document, 'createElement').mockReturnValueOnce(anchor);
      await downloadInvoice(42);
      expect(clickSpy).toHaveBeenCalled();
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(anchor.download).toBe('FACT-2024-000042.pdf');
    });

    it('throws when the server returns non-OK', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });
      await expect(downloadInvoice(1)).rejects.toThrow('Forbidden');
    });
  });
});
