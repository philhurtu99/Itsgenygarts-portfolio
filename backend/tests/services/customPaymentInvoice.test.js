import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  customPaymentInvoiceNumber,
  finalProductImageUrl,
  generateCustomPaymentInvoicePDF,
} from '../../src/services/customPaymentInvoice.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwUMMAYAj4IP8cvlVgcAAAAASUVORK5CYII=',
  'base64',
);
const originalFetch = global.fetch;

function makeOrder(overrides = {}) {
  return {
    id: 12,
    category: 'Peluche personnalisée',
    description: 'Un projet custom',
    customerName: 'Alice',
    customerEmail: 'alice@test.com',
    customerPhone: '5145551212',
    customerCountry: 'CA',
    customerLanguage: 'fr',
    price: 200,
    amountPaid: 50,
    createdAtUtc: new Date('2026-07-09T12:00:00Z'),
    images: [],
    ...overrides,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('custom payment invoice', () => {
  it('uses a unique custom payment invoice number', () => {
    expect(customPaymentInvoiceNumber(
      makeOrder(),
      { id: 3, paidAt: new Date('2026-07-10T12:00:00Z') },
    )).toBe('FACT-CUSTOM-2026-000012-003');
  });

  it('never fetches reference images for a deposit invoice', async () => {
    global.fetch = jest.fn();
    const order = makeOrder({
      images: [{
        purpose: 'REFERENCE',
        storagePathOrUrl: 'https://cdn.test/reference.png',
        uploadedAtUtc: new Date('2026-07-09T12:00:00Z'),
      }],
    });

    const pdf = await generateCustomPaymentInvoicePDF(order, {
      id: 1,
      amount: 50,
      kind: 'DEPOSIT',
      method: 'STRIPE_LINK',
      paidAt: new Date('2026-07-10T12:00:00Z'),
    });

    expect(pdf.slice(0, 4).toString('ascii')).toBe('%PDF');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('embeds only the newest finished-product image on the final invoice', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => ONE_PIXEL_PNG.buffer.slice(
        ONE_PIXEL_PNG.byteOffset,
        ONE_PIXEL_PNG.byteOffset + ONE_PIXEL_PNG.byteLength,
      ),
    }));
    const order = makeOrder({
      amountPaid: 200,
      images: [
        { purpose: 'REFERENCE', storagePathOrUrl: 'https://cdn.test/reference.png', uploadedAtUtc: new Date('2026-07-08T12:00:00Z') },
        { purpose: 'FINAL_PRODUCT', storagePathOrUrl: 'https://cdn.test/final-old.png', uploadedAtUtc: new Date('2026-07-09T12:00:00Z') },
        { purpose: 'FINAL_PRODUCT', storagePathOrUrl: 'https://cdn.test/final-new.png', uploadedAtUtc: new Date('2026-07-10T12:00:00Z') },
      ],
    });

    expect(finalProductImageUrl(order)).toBe('https://cdn.test/final-new.png');
    const pdf = await generateCustomPaymentInvoicePDF(order, {
      id: 2,
      amount: 150,
      kind: 'BALANCE',
      method: 'TAP_TO_PAY',
      paidAt: new Date('2026-07-10T12:00:00Z'),
    });

    expect(pdf.slice(0, 4).toString('ascii')).toBe('%PDF');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://cdn.test/final-new.png', expect.any(Object));
  });
});
