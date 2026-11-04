import {
  isProductUnavailable,
  canAddUniqueProductToCart,
  sortProductsByAvailability,
} from '../../src/utils/productAvailability.js';

describe('sortProductsByAvailability', () => {
  const products = [
    { id: 1, stockQuantity: 1, soldOut: true, price: 1 },
    { id: 2, stockQuantity: 2, price: 30 },
    { id: 3, stockQuantity: 0, price: 2 },
    { id: 4, stockQuantity: '1', price: 20 },
  ];

  it('places available items before sold or out-of-stock items, preserving each group order and the source list', () => {
    const source = [...products];
    expect(sortProductsByAvailability(source).map((p) => p.id)).toEqual([2, 4, 1, 3]);
    expect(source).toEqual(products);
  });

  it('keeps availability first even when the selected price order would put sold items ahead', () => {
    expect(sortProductsByAvailability(products, (a, b) => a.price - b.price).map((p) => p.id)).toEqual([4, 2, 1, 3]);
    expect(sortProductsByAvailability(products, (a, b) => b.price - a.price).map((p) => p.id)).toEqual([2, 4, 3, 1]);
  });
});

describe('isProductUnavailable', () => {
  it('is true for null/undefined', () => {
    expect(isProductUnavailable(null)).toBe(true);
    expect(isProductUnavailable(undefined)).toBe(true);
  });

  it('is true when soldOut flag is set', () => {
    expect(isProductUnavailable({ soldOut: true, stockQuantity: 5 })).toBe(true);
  });

  it('is true when stockQuantity is 0', () => {
    expect(isProductUnavailable({ stockQuantity: 0 })).toBe(true);
  });

  it('is true when stock (legacy field) is 0', () => {
    expect(isProductUnavailable({ stock: 0 })).toBe(true);
  });

  it('is true when stockQuantity is missing entirely (defaults to 0)', () => {
    expect(isProductUnavailable({})).toBe(true);
  });

  it('is false when there is stock and not soldOut', () => {
    expect(isProductUnavailable({ stockQuantity: 3, soldOut: false })).toBe(false);
  });

  it('prefers stockQuantity over stock when both present', () => {
    expect(isProductUnavailable({ stockQuantity: 5, stock: 0 })).toBe(false);
  });

  it('coerces string stockQuantity', () => {
    expect(isProductUnavailable({ stockQuantity: '2' })).toBe(false);
    expect(isProductUnavailable({ stockQuantity: '0' })).toBe(true);
  });
});

describe('canAddUniqueProductToCart', () => {
  it('is false for unavailable product', () => {
    expect(canAddUniqueProductToCart({ id: 1, soldOut: true }, [])).toBe(false);
  });

  it('is true when product is available and cart is empty', () => {
    expect(canAddUniqueProductToCart({ id: 1, stockQuantity: 2 }, [])).toBe(true);
  });

  it('is false when the same id is already in the cart', () => {
    expect(canAddUniqueProductToCart({ id: 1, stockQuantity: 2 }, [{ id: 1 }])).toBe(false);
  });

  it('is true when other ids are in the cart but not this one', () => {
    expect(canAddUniqueProductToCart({ id: 1, stockQuantity: 2 }, [{ id: 2 }, { id: 3 }])).toBe(true);
  });

  it('uses _id as fallback', () => {
    expect(canAddUniqueProductToCart({ _id: 42, stockQuantity: 1 }, [{ id: 42 }])).toBe(false);
  });
});
