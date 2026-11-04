import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const orderFindMany = jest.fn();
const orderUpdateMany = jest.fn();
const orderDeleteMany = jest.fn();
const releaseStockForOrderInTransaction = jest.fn();

const mockTx = {
  order: {
    updateMany: orderUpdateMany,
    deleteMany: orderDeleteMany,
  },
};

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    order: {
      findMany: orderFindMany,
      updateMany: orderUpdateMany,
      deleteMany: orderDeleteMany,
    },
    $transaction: jest.fn((fn) => fn(mockTx)),
  })),
}));

jest.unstable_mockModule('../../src/services/stock.js', () => ({
  RESERVATION_MINUTES: 30,
  releaseStockForOrderInTransaction,
}));

const { discardPendingOrder, expireStalePendingOrders } = await import('../../src/services/pendingOrders.js');

beforeEach(() => {
  orderFindMany.mockReset();
  orderUpdateMany.mockReset();
  orderDeleteMany.mockReset();
  releaseStockForOrderInTransaction.mockReset();
});

describe('discardPendingOrder', () => {
  it('releases stock and deletes the abandoned pending order', async () => {
    orderUpdateMany.mockResolvedValue({ count: 1 });
    orderDeleteMany.mockResolvedValue({ count: 1 });

    await expect(discardPendingOrder(10)).resolves.toBe(true);

    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'PENDING' },
      data: { status: 'ABANDONED' },
    });
    expect(releaseStockForOrderInTransaction).toHaveBeenCalledWith(mockTx, 10);
    expect(orderDeleteMany).toHaveBeenCalledWith({ where: { id: 10, status: 'ABANDONED' } });
  });

  it('does not release stock when another process already updated the order', async () => {
    orderUpdateMany.mockResolvedValue({ count: 0 });

    await expect(discardPendingOrder(10)).resolves.toBe(false);

    expect(releaseStockForOrderInTransaction).not.toHaveBeenCalled();
    expect(orderDeleteMany).not.toHaveBeenCalled();
  });
});

describe('expireStalePendingOrders', () => {
  it('discards stale pending orders and releases their reservations', async () => {
    orderFindMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    orderUpdateMany.mockResolvedValue({ count: 1 });
    orderDeleteMany.mockResolvedValue({ count: 1 });

    const count = await expireStalePendingOrders({ olderThanMinutes: 30 });

    expect(count).toBe(2);
    expect(orderFindMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        createdAt: { lt: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'PENDING' },
      data: { status: 'ABANDONED' },
    });
    expect(releaseStockForOrderInTransaction).toHaveBeenCalledWith(mockTx, 10);
    expect(releaseStockForOrderInTransaction).toHaveBeenCalledWith(mockTx, 11);
    expect(orderDeleteMany).toHaveBeenCalledWith({ where: { id: 10, status: 'ABANDONED' } });
  });

  it('does not release stock when another process already updated the order', async () => {
    orderFindMany.mockResolvedValue([{ id: 10 }]);
    orderUpdateMany.mockResolvedValue({ count: 0 });

    const count = await expireStalePendingOrders();

    expect(count).toBe(0);
    expect(releaseStockForOrderInTransaction).not.toHaveBeenCalled();
  });
});
