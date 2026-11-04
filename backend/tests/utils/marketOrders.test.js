import { describe, expect, it } from '@jest/globals';
import { isInPersonMarketOrder } from '../../src/utils/marketOrders.js';

describe('isInPersonMarketOrder', () => {
  it('recognizes manual market references', () => {
    expect(isInPersonMarketOrder({ stripePaymentId: 'market-cash-12' })).toBe(true);
  });

  it('recognizes paid Terminal sales with POS identity fields', () => {
    expect(isInPersonMarketOrder({
      stripePaymentId: 'pi_terminal',
      paidAt: new Date(),
      customerAddress: 'Vente en personne',
      customerCity: 'Marché',
      customerPostalCode: 'POS',
      customerCountry: 'CA',
    })).toBe(true);
  });

  it('does not treat a Stripe Checkout shipment as an in-person sale', () => {
    expect(isInPersonMarketOrder({
      stripePaymentId: 'pi_checkout',
      stripeSessionId: 'cs_checkout',
      paidAt: new Date(),
      customerAddress: '123 Main',
      customerCity: 'Montréal',
      customerPostalCode: 'H1H 1H1',
    })).toBe(false);
  });
});
