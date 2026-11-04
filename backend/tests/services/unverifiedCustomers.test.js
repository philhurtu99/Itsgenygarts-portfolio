import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const customerDeleteMany = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    customer: {
      deleteMany: customerDeleteMany,
    },
  })),
}));

const { deleteExpiredUnverifiedCustomers } = await import('../../src/services/unverifiedCustomers.js');

beforeEach(() => {
  customerDeleteMany.mockReset();
});

describe('deleteExpiredUnverifiedCustomers', () => {
  it('deletes only expired customer signup accounts still waiting for verification', async () => {
    customerDeleteMany.mockResolvedValue({ count: 3 });

    const count = await deleteExpiredUnverifiedCustomers({ olderThanHours: 48 });

    expect(count).toBe(3);
    expect(customerDeleteMany).toHaveBeenCalledWith({
      where: {
        emailVerified: false,
        verificationToken: { not: null },
        createdAt: { lt: expect.any(Date) },
      },
    });
  });

  it('falls back to 48 hours when the configured value is invalid', async () => {
    customerDeleteMany.mockResolvedValue({ count: 0 });

    await deleteExpiredUnverifiedCustomers({ olderThanHours: -1 });

    const cutoff = customerDeleteMany.mock.calls[0][0].where.createdAt.lt;
    const ageHours = (Date.now() - cutoff.getTime()) / (60 * 60 * 1000);
    expect(ageHours).toBeGreaterThan(47.9);
    expect(ageHours).toBeLessThan(48.1);
  });
});
