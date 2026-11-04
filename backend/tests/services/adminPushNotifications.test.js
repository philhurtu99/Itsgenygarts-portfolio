import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { notifyPaidCustomOrder } from '../../src/services/adminPushNotifications.js';

const originalFetch = global.fetch;

function prismaWithRegisteredPhone() {
  return {
    adminPushToken: {
      findMany: jest.fn(async () => [{ token: 'ExpoPushToken[test-device]' }]),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
  }));
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('admin custom payment push notifications', () => {
  it('announces a deposit with the remaining balance', async () => {
    const prisma = prismaWithRegisteredPhone();

    await notifyPaidCustomOrder(
      prisma,
      { id: 12, customerName: 'Alice', price: 200, amountPaid: 50 },
      { amount: 50, kind: 'DEPOSIT' },
    );

    const message = JSON.parse(global.fetch.mock.calls[0][1].body)[0];
    expect(message).toEqual(expect.objectContaining({
      title: 'Dépôt custom reçu',
      body: 'Alice a payé 50.00 $ pour la commande custom #12. Solde: 150.00 $.',
      data: {
        type: 'custom-order-payment',
        id: 12,
        path: '/custom-orders?id=12',
      },
    }));
  });

  it('announces when the custom order is fully paid', async () => {
    const prisma = prismaWithRegisteredPhone();

    await notifyPaidCustomOrder(
      prisma,
      { id: 12, customerName: 'Alice', price: 200, amountPaid: 200 },
      { amount: 150, kind: 'BALANCE' },
    );

    const message = JSON.parse(global.fetch.mock.calls[0][1].body)[0];
    expect(message.title).toBe('Commande custom payée');
    expect(message.body).toBe('Alice a payé 150.00 $ pour la commande custom #12. Paiement complet.');
  });
});
