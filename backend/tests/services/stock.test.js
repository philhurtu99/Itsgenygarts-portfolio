import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const productFindUnique = jest.fn();
const reservationFindMany = jest.fn();
const reservationDeleteMany = jest.fn();
const reservationCreate = jest.fn();
const productUpdate = jest.fn();
const productUpdateMany = jest.fn();
const cartItemDeleteMany = jest.fn();
const favoriteItemDeleteMany = jest.fn();

const mockTx = {
  product: { findUnique: productFindUnique, update: productUpdate, updateMany: productUpdateMany },
  cartItem: { deleteMany: cartItemDeleteMany },
  favoriteItem: { deleteMany: favoriteItemDeleteMany },
  stockReservation: {
    findMany: reservationFindMany,
    deleteMany: reservationDeleteMany,
    create: reservationCreate,
  },
};

const mockPrisma = {
  product: { findUnique: productFindUnique, update: productUpdate, updateMany: productUpdateMany },
  cartItem: { deleteMany: cartItemDeleteMany },
  favoriteItem: { deleteMany: favoriteItemDeleteMany },
  stockReservation: {
    findMany: reservationFindMany,
    deleteMany: reservationDeleteMany,
    create: reservationCreate,
  },
  $transaction: jest.fn(async (fn) => fn(mockTx)),
};

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const {
  RESERVATION_MINUTES,
  getAvailableStock,
  reserveStockForOrder,
  commitStockForOrder,
  releaseStockForOrder,
} = await import('../../src/services/stock.js');

beforeEach(() => {
  productFindUnique.mockReset();
  reservationFindMany.mockReset();
  reservationDeleteMany.mockReset();
  reservationCreate.mockReset();
  productUpdate.mockReset();
  productUpdateMany.mockReset();
  cartItemDeleteMany.mockReset();
  favoriteItemDeleteMany.mockReset();
  mockPrisma.$transaction.mockClear();
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
});

describe('RESERVATION_MINUTES', () => {
  it('is 30 minutes to match Stripe checkout session expiry', () => {
    expect(RESERVATION_MINUTES).toBe(30);
  });
});

describe('getAvailableStock', () => {
  it('returns 0 when the product is not found', async () => {
    productFindUnique.mockResolvedValue(null);
    expect(await getAvailableStock(1)).toBe(0);
  });

  it('returns 0 when the product is marked deleted', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 5, isDeleted: true });
    expect(await getAvailableStock(1)).toBe(0);
  });

  it('returns 0 when the product is a draft', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 5, isDeleted: false, isDraft: true });
    expect(await getAvailableStock(1)).toBe(0);
  });

  it('returns 0 when the product is already locked as sold out', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 5, isDeleted: false, soldOut: true });
    expect(await getAvailableStock(1)).toBe(0);
  });

  it('returns physical stock when no reservations exist', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 10, isDeleted: false });
    reservationFindMany.mockResolvedValue([]);
    expect(await getAvailableStock(1)).toBe(10);
  });

  it('subtracts active reservations', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 10, isDeleted: false });
    reservationFindMany.mockResolvedValue([{ quantity: 2 }, { quantity: 3 }]);
    expect(await getAvailableStock(1)).toBe(5);
  });

  it('floors at 0 even if reservations exceed stock', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 2, isDeleted: false });
    reservationFindMany.mockResolvedValue([{ quantity: 10 }]);
    expect(await getAvailableStock(1)).toBe(0);
  });

  it('excludes a specific orderId when excludeOrderId is passed', async () => {
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 5, isDeleted: false });
    reservationFindMany.mockResolvedValue([]);
    await getAvailableStock(1, 'order-42');
    const whereArg = reservationFindMany.mock.calls[0][0].where;
    expect(whereArg.orderId).toEqual({ not: 'order-42' });
  });
});

describe('reserveStockForOrder', () => {
  it('creates a reservation without removing the item from customer carts before payment', async () => {
    productFindUnique.mockResolvedValue({ id: 1, name: 'X', stockQuantity: 3, soldOut: false, isDeleted: false });
    productUpdateMany.mockResolvedValue({ count: 1 });

    await reserveStockForOrder('order-1', [{ productId: 1 }]);

    expect(productUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        isDeleted: false,
        isDraft: false,
        soldOut: false,
        stockQuantity: { gte: 1 },
      },
      data: { soldOut: true },
    });
    expect(reservationCreate).toHaveBeenCalledTimes(1);
    const data = reservationCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ orderId: 'order-1', productId: 1, quantity: 1 });
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect(cartItemDeleteMany).not.toHaveBeenCalled();
    expect(favoriteItemDeleteMany).not.toHaveBeenCalled();
  });

  it('throws when the product is not found', async () => {
    productFindUnique.mockResolvedValue(null);
    await expect(reserveStockForOrder('o', [{ productId: 99 }])).rejects.toThrow(/introuvable/);
  });

  it('throws when the product is soft-deleted', async () => {
    productFindUnique.mockResolvedValue({ id: 1, isDeleted: true, stockQuantity: 10 });
    await expect(reserveStockForOrder('o', [{ productId: 1 }])).rejects.toThrow(/introuvable/);
  });

  it('throws when the product is a draft', async () => {
    productFindUnique.mockResolvedValue({ id: 1, isDeleted: false, isDraft: true, stockQuantity: 10 });
    await expect(reserveStockForOrder('o', [{ productId: 1 }])).rejects.toThrow(/introuvable/);
  });

  it('allows an admin market sale to reserve a draft product', async () => {
    productFindUnique.mockResolvedValue({
      id: 1,
      name: 'Brouillon marché',
      isDeleted: false,
      isDraft: true,
      stockQuantity: 1,
      soldOut: false,
      variants: [],
    });
    productUpdateMany.mockResolvedValue({ count: 1 });

    await reserveStockForOrder('market-order', [{ productId: 1 }], { allowDraft: true });

    expect(productUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        isDeleted: false,
        soldOut: false,
        stockQuantity: { gte: 1 },
      },
      data: { soldOut: true },
    });
    expect(reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'market-order', productId: 1, quantity: 1 }),
    });
  });

  it('throws when the product cannot be locked', async () => {
    productFindUnique.mockResolvedValue({ id: 1, name: 'Chapeau', stockQuantity: 1, soldOut: false, isDeleted: false });
    productUpdateMany.mockResolvedValue({ count: 0 });
    await expect(reserveStockForOrder('o', [{ productId: 1 }])).rejects.toThrow(/Stock insuffisant/);
  });

  it('throws when the product is marked soldOut', async () => {
    productFindUnique.mockResolvedValue({ id: 1, name: 'X', stockQuantity: 5, soldOut: true, isDeleted: false });
    productUpdateMany.mockResolvedValue({ count: 0 });
    await expect(reserveStockForOrder('o', [{ productId: 1 }])).rejects.toThrow(/Stock insuffisant/);
  });
});

describe('commitStockForOrder', () => {
  it('decrements stock and deletes the reservations for the order', async () => {
    reservationFindMany.mockResolvedValue([{ productId: 1, quantity: 2 }]);
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 5 });

    await commitStockForOrder('order-1');

    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stockQuantity: 3, soldOut: false },
    });
    expect(reservationDeleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
  });

  it('marks soldOut=true when resulting stock is zero', async () => {
    reservationFindMany.mockResolvedValue([{ productId: 1, quantity: 5 }]);
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 5 });

    await commitStockForOrder('order-1');

    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stockQuantity: 0, soldOut: true },
    });
    expect(cartItemDeleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
    expect(favoriteItemDeleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
  });

  it('does nothing for a reservation whose product has disappeared', async () => {
    reservationFindMany.mockResolvedValue([{ productId: 42, quantity: 1 }]);
    productFindUnique.mockResolvedValue(null);

    await commitStockForOrder('order-1');

    expect(productUpdate).not.toHaveBeenCalled();
    expect(reservationDeleteMany).toHaveBeenCalled();
  });
});

describe('releaseStockForOrder', () => {
  it('deletes all reservations for the order', async () => {
    reservationFindMany.mockResolvedValueOnce([]);
    await releaseStockForOrder('order-9');
    expect(reservationDeleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-9' } });
  });

  it('unlocks a reserved product when the payment expires before sale', async () => {
    reservationFindMany
      .mockResolvedValueOnce([{ productId: 1, quantity: 1 }])
      .mockResolvedValueOnce([]);
    productFindUnique.mockResolvedValue({ id: 1, stockQuantity: 1, isDeleted: false });

    await releaseStockForOrder('order-9');

    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { soldOut: false },
    });
  });
});
