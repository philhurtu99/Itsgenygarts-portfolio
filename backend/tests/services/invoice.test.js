import { describe, it, expect, jest } from '@jest/globals';
import { invoiceNumber, generateInvoicePDF } from '../../src/services/invoice.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwUMMAYAj4IP8cvlVgcAAAAASUVORK5CYII=',
  'base64',
);

describe('invoiceNumber', () => {
  it('returns FACT-{year}-{6-digit-id}', () => {
    const order = { id: 42, createdAt: new Date('2025-06-15T12:00:00Z') };
    expect(invoiceNumber(order)).toBe('FACT-2025-000042');
  });

  it('pads small ids with leading zeros', () => {
    expect(invoiceNumber({ id: 1, createdAt: '2024-06-15T12:00:00Z' })).toBe('FACT-2024-000001');
  });

  it('does not pad when id is already 6+ digits', () => {
    expect(invoiceNumber({ id: 1234567, createdAt: '2024-06-15T12:00:00Z' })).toBe('FACT-2024-1234567');
  });

  it('uses the createdAt year', () => {
    expect(invoiceNumber({ id: 10, createdAt: '2030-06-15T12:00:00Z' })).toBe('FACT-2030-000010');
  });
});

describe('generateInvoicePDF', () => {
  function makeOrder(overrides = {}) {
    return {
      id: 1,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      paidAt: new Date('2025-01-02T00:00:00Z'),
      status: 'PAID',
      currency: 'CAD',
      customerName: 'Alice',
      customerEmail: 'alice@test.com',
      customerPhone: '555-0000',
      customerAddress: '1 Main St',
      customerCity: 'Montreal',
      customerProvince: 'QC',
      customerPostalCode: 'H1A 0A0',
      customerCountry: 'Canada',
      items: [
        { productName: 'Chapeau', quantity: 1, unitPrice: 30, subtotal: 30 },
        { productName: 'Écharpe', quantity: 2, unitPrice: 20, subtotal: 40 },
      ],
      subtotal: 70,
      shippingTotal: 10,
      total: 80,
      ...overrides,
    };
  }

  it('resolves to a Buffer with PDF magic bytes', async () => {
    const buf = await generateInvoicePDF(makeOrder());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('handles orders without paidAt (unpaid)', async () => {
    const buf = await generateInvoicePDF(makeOrder({ paidAt: null, status: 'PENDING' }));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('handles empty items array', async () => {
    const buf = await generateInvoicePDF(makeOrder({ items: [] }));
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('embeds product images when order items include image URLs', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => ONE_PIXEL_PNG.buffer.slice(
        ONE_PIXEL_PNG.byteOffset,
        ONE_PIXEL_PNG.byteOffset + ONE_PIXEL_PNG.byteLength,
      ),
    }));

    try {
      const buf = await generateInvoicePDF(makeOrder({
        items: [
          { productName: 'Chapeau', quantity: 1, unitPrice: 30, subtotal: 30, productImageUrl: 'https://cdn.test/chapeau.png' },
        ],
        subtotal: 30,
        shippingTotal: 0,
        total: 30,
      }));
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
      expect(global.fetch).toHaveBeenCalledWith('https://cdn.test/chapeau.png', expect.any(Object));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('accepts Stripe invoice data as the source of payment details', async () => {
    const buf = await generateInvoicePDF(makeOrder(), {
      provider: 'Stripe',
      sessionId: 'cs_test_123',
      paymentIntentId: 'pi_test_123',
      chargeId: 'ch_test_123',
      receiptUrl: 'https://pay.stripe.com/receipts/test',
      currency: 'CAD',
      paidAt: new Date('2025-01-03T00:00:00Z'),
      customer: {
        name: 'Alice Stripe',
        email: 'alice-stripe@test.com',
        phone: '+15145551212',
        address: {
          line1: '2 Stripe St',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H2B 0B0',
          country: 'CA',
        },
      },
      paymentMethod: { type: 'card', brand: 'visa', last4: '4242' },
      lineItems: [
        { productName: 'Chapeau Stripe', quantity: 1, unitPrice: 30, subtotal: 30 },
      ],
      subtotal: 30,
      total: 30,
      tax: 0,
      discount: 0,
      shipping: 0,
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });
});
