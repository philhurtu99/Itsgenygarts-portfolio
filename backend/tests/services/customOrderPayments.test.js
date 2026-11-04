import { describe, expect, it, jest } from '@jest/globals';
import {
  customOrderFinancials,
  markLegacyCustomOrderPaid,
  recordManualCustomOrderPayment,
  validatedCustomPaymentAmount,
} from '../../src/services/customOrderPayments.js';

describe('custom order financials', () => {
  it('calculates the balance after a deposit', () => {
    expect(customOrderFinancials({ price: 200, amountPaid: 50 })).toEqual({
      total: 200,
      paid: 50,
      balance: 150,
    });
  });

  it('accepts a payment equal to the remaining balance', () => {
    expect(validatedCustomPaymentAmount({ price: 200, amountPaid: 50 }, 150)).toBe(150);
  });

  it('rejects a payment above the remaining balance', () => {
    expect(() => validatedCustomPaymentAmount({ price: 200, amountPaid: 50 }, 151))
      .toThrow('Le montant dépasse le solde de 150.00 $.');
  });

  it('records a deposit without marking the full order paid', async () => {
    const payment = { id: 1, amount: 50, kind: 'DEPOSIT', method: 'CASH', status: 'PAID' };
    const tx = {
      customOrder: {
        findUnique: jest.fn(async () => ({ id: 7, price: 200, amountPaid: 0, status: 'NEW' })),
        update: jest.fn(async ({ data }) => ({ id: 7, price: 200, ...data })),
      },
      customOrderPayment: { create: jest.fn(async () => payment) },
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };

    const result = await recordManualCustomOrderPayment(prisma, {
      customOrderId: 7,
      amount: 50,
      kind: 'DEPOSIT',
      method: 'CASH',
    });

    expect(result.order).toEqual(expect.objectContaining({
      amountPaid: 50,
      paymentStatus: 'PARTIALLY_PAID',
      status: 'AWAITING_PAYMENT',
    }));
  });

  it('marks the order paid when the balance is collected', async () => {
    const tx = {
      customOrder: {
        findUnique: jest.fn(async () => ({ id: 7, price: 200, amountPaid: 50, status: 'AWAITING_PAYMENT' })),
        update: jest.fn(async ({ data }) => ({ id: 7, price: 200, ...data })),
      },
      customOrderPayment: {
        create: jest.fn(async () => ({ id: 2, amount: 150, kind: 'BALANCE', method: 'E_TRANSFER', status: 'PAID' })),
      },
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };

    const result = await recordManualCustomOrderPayment(prisma, {
      customOrderId: 7,
      amount: 150,
      kind: 'BALANCE',
      method: 'E_TRANSFER',
    });

    expect(result.order).toEqual(expect.objectContaining({
      amountPaid: 200,
      paymentStatus: 'PAID',
      status: 'PAID',
      paidAt: expect.any(Date),
    }));
  });

  it('does not settle an already-paid legacy custom order twice', async () => {
    const order = {
      id: 7,
      price: 200,
      amountPaid: 200,
      paymentStatus: 'PAID',
      status: 'PAID',
    };
    const prisma = {
      customOrder: {
        findUnique: jest.fn(async () => order),
        update: jest.fn(),
      },
    };

    const result = await markLegacyCustomOrderPaid(prisma, 7, { id: 'pi_paid' });

    expect(result).toEqual({ order, newlyPaid: false });
    expect(prisma.customOrder.update).not.toHaveBeenCalled();
  });
});
