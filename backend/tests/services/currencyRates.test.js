import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    currencyRate: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  })),
}));

const {
  currencyRateAutoUpdateEnabled,
  currencyRateUpdateIntervalMs,
  updateCurrencyRates,
} = await import('../../src/services/currencyRates.js');

function makePrisma(currencies = []) {
  return {
    currencyRate: {
      findMany: jest.fn(async () => currencies),
      update: jest.fn(async (args) => args),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('currency rate updater', () => {
  it('updates active currencies from CAD-based provider rates', async () => {
    const prisma = makePrisma([
      { id: 1, code: 'CAD', rate: 1, isActive: true },
      { id: 2, code: 'USD', rate: 0.74, isActive: true },
      { id: 3, code: 'EUR', rate: 0.68, isActive: true },
    ]);
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        date: '2026-06-24',
        base: 'CAD',
        rates: { USD: 0.731234, EUR: 0.632345 },
      }),
    }));

    const result = await updateCurrencyRates({ prismaClient: prisma, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('base=CAD');
    expect(fetchImpl.mock.calls[0][0]).toContain('symbols=USD%2CEUR');
    expect(prisma.currencyRate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { rate: 1 } });
    expect(prisma.currencyRate.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { rate: 0.731234 } });
    expect(prisma.currencyRate.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { rate: 0.632345 } });
    expect(result).toEqual({
      updated: 3,
      skipped: [],
      provider: 'api.frankfurter.dev',
      date: '2026-06-24',
    });
  });

  it('skips provider responses missing a configured currency', async () => {
    const prisma = makePrisma([
      { id: 1, code: 'CAD', rate: 1, isActive: true },
      { id: 2, code: 'USD', rate: 0.74, isActive: true },
      { id: 3, code: 'XYZ', rate: 1.2, isActive: true },
    ]);
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ rates: { USD: 0.73 } }),
    }));

    const result = await updateCurrencyRates({ prismaClient: prisma, fetchImpl });

    expect(prisma.currencyRate.update).toHaveBeenCalledTimes(2);
    expect(prisma.currencyRate.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3 } }));
    expect(result.skipped).toEqual(['XYZ']);
  });

  it('does not call the provider when only CAD is active', async () => {
    const prisma = makePrisma([{ id: 1, code: 'CAD', rate: 0.99, isActive: true }]);
    const fetchImpl = jest.fn();

    const result = await updateCurrencyRates({ prismaClient: prisma, fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(prisma.currencyRate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { rate: 1 } });
    expect(result.updated).toBe(1);
  });

  it('exposes env helpers for scheduling', () => {
    expect(currencyRateAutoUpdateEnabled()).toBe(true);
    expect(currencyRateAutoUpdateEnabled('false')).toBe(false);
    expect(currencyRateUpdateIntervalMs('2')).toBe(2 * 60 * 60 * 1000);
    expect(currencyRateUpdateIntervalMs('-1')).toBe(24 * 60 * 60 * 1000);
  });
});
