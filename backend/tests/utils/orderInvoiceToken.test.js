import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  canDownloadInvoice,
  orderInvoiceDownloadUrl,
  verifyOrderInvoiceToken,
} from '../../src/utils/orderInvoiceToken.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.JWT_SECRET = 'invoice-token-test-secret';
  process.env.PUBLIC_API_URL = 'https://api.test.local/api';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('order invoice download tokens', () => {
  it('creates a signed invoice download URL for paid orders', () => {
    const order = {
      id: 123,
      customerEmail: 'Client@Test.local',
      status: 'PAID',
    };

    const url = orderInvoiceDownloadUrl(order);
    const token = new URL(url).searchParams.get('token');

    expect(url).toMatch(/^https:\/\/api\.test\.local\/api\/orders\/123\/invoice\?token=/);
    expect(verifyOrderInvoiceToken(token, 123)).toEqual({
      orderId: 123,
      email: 'client@test.local',
    });
    expect(canDownloadInvoice(order)).toBe(true);
  });

  it('rejects tokens for the wrong order', () => {
    const url = orderInvoiceDownloadUrl({ id: 123, customerEmail: 'client@test.local' });
    const token = new URL(url).searchParams.get('token');

    expect(() => verifyOrderInvoiceToken(token, 124)).toThrow('Invalid invoice token');
  });

  it('does not allow pending orders to download invoices', () => {
    expect(canDownloadInvoice({ status: 'PENDING', paidAt: null })).toBe(false);
  });
});
