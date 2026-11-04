import { describe, expect, it } from '@jest/globals';
import {
  orderCustomerUpdateFromStripeSession,
  paidOrderUpdateFromStripeSession,
} from '../../src/utils/stripeCheckout.js';

describe('Stripe Checkout customer details', () => {
  it('replaces anonymous order details with the customer information entered in Stripe', () => {
    const update = paidOrderUpdateFromStripeSession({
      id: 'cs_paid',
      payment_intent: 'pi_paid',
      created: 1_788_000_000,
      customer_details: {
        email: ' CLIENT@EXAMPLE.COM ',
        name: 'Client Stripe',
        phone: '5145550100',
        address: {
          line1: '1 rue Test',
          city: 'Montreal',
          state: 'QC',
          postal_code: 'H1A 1A1',
          country: 'CA',
        },
      },
    });

    expect(update).toMatchObject({
      status: 'PAID',
      stripePaymentId: 'pi_paid',
      customerName: 'Client Stripe',
      customerEmail: 'client@example.com',
      customerPhone: '5145550100',
      customerAddress: '1 rue Test',
      customerCity: 'Montreal',
      customerProvince: 'QC',
      customerPostalCode: 'H1A 1A1',
      customerCountry: 'CA',
    });
  });

  it('uses the Checkout session email when customer_details is absent', () => {
    expect(orderCustomerUpdateFromStripeSession({ customer_email: 'PAYMENT@EXAMPLE.COM' })).toEqual({
      customerEmail: 'payment@example.com',
    });
  });
});
