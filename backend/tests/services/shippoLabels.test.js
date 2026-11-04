import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createShippoShipment,
  reconcileShippoShipment,
  downloadShippoCommercialInvoice,
  downloadShippoLabel,
} from '../../src/services/shippoLabels.js';
import { resetShippoCarrierAccountCache } from '../../src/services/shipping.js';

const ENV_KEYS = [
  'NODE_ENV',
  'SHIPPO_API_TOKEN',
  'SHIPPO_ALLOW_TEST_RATES',
  'SHIPPO_CARRIER',
  'SHIPPO_CARRIER_ACCOUNT_IDS',
  'SHIPPING_ORIGIN_NAME',
  'SHIPPING_ORIGIN_COMPANY',
  'SHIPPING_ORIGIN_ADDRESS',
  'SHIPPING_ORIGIN_CITY',
  'SHIPPING_ORIGIN_PROVINCE',
  'SHIPPING_ORIGIN_COUNTRY',
  'SHIPPING_ORIGIN_POSTAL_CODE',
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

function configureShippo() {
  process.env.SHIPPO_API_TOKEN = 'shippo_test_example';
  process.env.SHIPPO_CARRIER = 'ups';
  process.env.SHIPPO_CARRIER_ACCOUNT_IDS = 'ups-canada-account';
  process.env.SHIPPING_ORIGIN_NAME = 'Itsgenygarts';
  process.env.SHIPPING_ORIGIN_COMPANY = 'Itsgenygarts';
  process.env.SHIPPING_ORIGIN_ADDRESS = '123 boulevard Saint-Martin';
  process.env.SHIPPING_ORIGIN_CITY = 'Laval';
  process.env.SHIPPING_ORIGIN_PROVINCE = 'QC';
  process.env.SHIPPING_ORIGIN_COUNTRY = 'CA';
  process.env.SHIPPING_ORIGIN_POSTAL_CODE = 'H7M1A1';
}

function order(overrides = {}) {
  return {
    id: 42,
    createdAt: new Date(),
    shippingProvider: 'SHIPPO',
    shippingServiceCode: 'SHIPPO_UPS_UPS_STANDARD_CA',
    shippingRateId: 'ups-rate',
    shippingPackage: { weightGrams: 350, lengthCm: 25, widthCm: 20, heightCm: 8 },
    customerName: 'Alice',
    customerEmail: 'alice@example.com',
    customerPhone: '5145555555',
    customerAddress: '456 rue Client',
    customerCity: 'Montreal',
    customerProvince: 'QC',
    customerCountry: 'CA',
    customerPostalCode: 'H2X1Y4',
    ...overrides,
  };
}

it('blocks new US label purchases even with a fresh saved rate, without contacting Shippo', async () => {
  configureShippo();
  global.fetch = jest.fn();
  await expect(createShippoShipment(order({ customerCountry: 'US' }))).rejects.toMatchObject({ statusCode: 422 });
  expect(global.fetch).not.toHaveBeenCalled();
});

beforeEach(() => {
  ENV_KEYS.forEach((key) => { delete process.env[key]; });
  configureShippo();
  resetShippoCarrierAccountCache();
});

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (originalEnv[key] == null) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('Shippo labels', () => {
  const transaction = (overrides = {}) => ({
    object_id: 'transaction-42', rate: 'ups-rate', metadata: 'Itsgenygarts order 42',
    test: true, status: 'SUCCESS', tracking_number: 'TRACK42',
    label_url: 'https://deliver.goshippo.com/transaction-42.pdf', ...overrides,
  });

  it.each(['network', 'unreadable', 'server', 'empty'])('keeps a %s purchase failure uncertain', async (failure) => {
    global.fetch = jest.fn();
    if (failure === 'network') global.fetch.mockRejectedValue(new Error('timeout'));
    if (failure === 'unreadable') global.fetch.mockResolvedValue({ ok: true, json: async () => { throw new Error('bad json'); } });
    if (failure === 'server') global.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    if (failure === 'empty') global.fetch.mockResolvedValue({ ok: true, json: async () => null });
    await expect(createShippoShipment(order())).rejects.toMatchObject({ purchaseOutcomeUnknown: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('persists the rate before purchase and transaction before evaluating a queued result', async () => {
    const events = [];
    global.fetch = jest.fn(async () => {
      events.push('purchase');
      return { ok: true, json: async () => transaction({ status: 'QUEUED' }) };
    });
    await expect(createShippoShipment(order(), {
      onRate: async (id) => events.push(`rate:${id}`),
      onTransaction: async (id) => events.push(`transaction:${id}`),
    })).rejects.toMatchObject({ statusCode: 409, purchaseOutcomeUnknown: true });
    expect(events).toEqual(['rate:ups-rate', 'purchase', 'transaction:transaction-42']);
  });

  it('does not purchase if saving the rate fails', async () => {
    global.fetch = jest.fn();
    await expect(createShippoShipment(order(), { onRate: async () => { throw new Error('DB unavailable'); } })).rejects.toThrow('DB unavailable');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the purchase uncertain if saving its reference fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => transaction() });
    await expect(createShippoShipment(order(), { onTransaction: async () => { throw new Error('DB unavailable'); } })).rejects.toMatchObject({ purchaseOutcomeUnknown: true });
  });

  it('retrieves a pending known transaction without purchasing again', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => transaction({ rate: { object_id: 'ups-rate' } }) });
    await expect(createShippoShipment(order({ shippingTransactionId: 'transaction-42' }))).resolves.toMatchObject({ trackingNumber: 'TRACK42' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.goshippo.com/transactions/transaction-42');
    expect(global.fetch.mock.calls[0][1].method).not.toBe('POST');
  });

  it.each([
    { metadata: 'Itsgenygarts order 43' }, { rate: 'other-rate' },
    { object_id: 'other-transaction' }, { test: false },
  ])('rejects recovery of a mismatched transaction: %j', async (overrides) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => transaction(overrides) });
    await expect(reconcileShippoShipment(order(), 'transaction-42')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('requires configuration before recovery', async () => {
    delete process.env.SHIPPO_API_TOKEN;
    global.fetch = jest.fn();
    await expect(reconcileShippoShipment(order(), 'transaction-42')).rejects.toMatchObject({ statusCode: 503 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('only marks a verified ERROR transaction as a rejected purchase', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => transaction({ status: 'ERROR' }) });
    await expect(reconcileShippoShipment(order(), 'transaction-42')).rejects.toMatchObject({ purchaseRejected: true });
  });

  it('uses the fresh checkout rate and purchases a PDF label', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          object_id: 'transaction-42',
          tracking_number: 'TRACK42',
          tracking_url_provider: 'https://www.ups.com/track?tracknum=TRACK42',
          label_url: 'https://shippo-delivery.s3.amazonaws.com/transaction-42.pdf',
        }),
      });

    await expect(createShippoShipment(order())).resolves.toEqual({
      transactionId: 'transaction-42',
      trackingNumber: 'TRACK42',
      trackingUrl: 'https://www.ups.com/track?tracknum=TRACK42',
      created: true,
    });
    const transactionRequest = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(transactionRequest).toEqual(expect.objectContaining({
      rate: 'ups-rate',
      async: false,
      label_file_type: 'PDF_4x6',
    }));
  });

  it('refreshes an expired checkout rate before purchasing', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rates: [{
            object_id: 'fresh-ups-rate',
            provider: 'UPS',
            amount: '11.20',
            currency: 'CAD',
            servicelevel: { name: 'Standard®', token: 'ups_standard_ca' },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          object_id: 'transaction-42',
          tracking_number: 'TRACK42',
          label_url: 'https://shippo-delivery.s3.amazonaws.com/transaction-42.pdf',
        }),
      });

    await createShippoShipment(order({ createdAt: new Date('2026-01-01') }));

    const transactionRequest = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(transactionRequest.rate).toBe('fresh-ups-rate');
  });

  it('returns an actionable payment-required error when Shippo has no billing method', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ERROR',
        messages: [{ text: 'You are required to have a valid payment method on file to purchase labels.' }],
      }),
    });

    await expect(createShippoShipment(order())).rejects.toMatchObject({
      statusCode: 402,
      message: expect.stringMatching(/moyen de paiement valide.*Shippo/i),
    });
  });

  it('downloads only a trusted Shippo label URL', async () => {
    const label = Buffer.from('pdf');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          label_url: 'https://deliver.goshippo.com/transaction-42.pdf',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/pdf' },
        arrayBuffer: async () => label,
      });

    const result = await downloadShippoLabel('transaction-42');
    expect(result.contentType).toBe('application/pdf');
    expect(result.data.equals(label)).toBe(true);
  });

  it('rejects a label URL outside Shippo storage', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'SUCCESS', label_url: 'https://example.com/label.pdf' }),
    });

    await expect(downloadShippoLabel('transaction-42')).rejects.toMatchObject({ statusCode: 409 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('downloads the commercial invoice returned for an international label', async () => {
    const invoice = Buffer.from('commercial invoice');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          commercial_invoice_url: 'https://deliver.goshippo.com/commercial-invoice-42.pdf',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/pdf' },
        arrayBuffer: async () => invoice,
      });

    const result = await downloadShippoCommercialInvoice('transaction-42');
    expect(result.contentType).toBe('application/pdf');
    expect(result.data.equals(invoice)).toBe(true);
  });

  it('rejects a missing international commercial invoice', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'SUCCESS', commercial_invoice_url: null }),
    });

    await expect(downloadShippoCommercialInvoice('transaction-42')).rejects.toMatchObject({ statusCode: 409 });
  });
});
