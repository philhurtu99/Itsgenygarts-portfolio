import { describe, expect, it, jest } from '@jest/globals';
import { normalizeProductVariants, syncProductVariants, VARIANT_LABELS, variantLabel } from '../../src/utils/productVariants.js';

describe('product variants', () => {
  it.each(['AVAILABLE', 'SOLD', 'RESERVED'])('keeps ordinary product photos when its sole stock item is %s', (status) => {
    const product = normalizeProductVariants({
      stockQuantity: status === 'AVAILABLE' ? 1 : 0,
      mainImageUrl: 'photo.jpg',
      variants: [{ id: 10, status, images: [{ imageUrl: 'photo.jpg' }] }],
      images: [{ id: 1, imageUrl: 'photo.jpg', variantId: 10, order: 0 }, { id: 2, imageUrl: 'detail.jpg', variantId: 10, order: 1 }],
    });
    expect(product.mainImageUrl).toBe('photo.jpg');
    expect(product.images.map((image) => [image.imageUrl, image.variantId, image.variantLabel])).toEqual([
      ['photo.jpg', null, null], ['detail.jpg', null, null],
    ]);
    expect(product.soldOut).toBe(status !== 'AVAILABLE');
  });
  it('restores every sold variation only when the admin enables the sold gallery', () => {
    const input = {
      stockQuantity: 0, soldOut: true, showSoldVariants: true, mainImageUrl: 'cover.jpg',
      variants: [
        { id: 10, status: 'SOLD', images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, status: 'SOLD', images: [{ imageUrl: 'b.jpg' }] },
      ],
      images: [
        { id: 1, imageUrl: 'cover.jpg', variantId: null },
        { id: 2, imageUrl: 'a.jpg', variantId: 10 },
        { id: 3, imageUrl: 'b.jpg', variantId: 11 },
      ],
    };
    const visible = normalizeProductVariants(input);
    expect(visible.variants.map((variant) => variant.status)).toEqual(['SOLD', 'SOLD']);
    expect(visible.images.map((image) => image.imageUrl)).toEqual(['cover.jpg', 'a.jpg', 'b.jpg']);
    expect(visible).toMatchObject({ stockQuantity: 0, soldOut: true, showSoldVariants: true });
    const hidden = normalizeProductVariants({ ...input, showSoldVariants: false });
    expect(hidden.variants).toEqual([]);
    expect(hidden.images.map((image) => image.imageUrl)).toEqual(['cover.jpg']);
  });

  it('keeps sold variations hidden while any variation is still available or reserved', () => {
    for (const status of ['AVAILABLE', 'RESERVED']) {
      const result = normalizeProductVariants({
        stockQuantity: 0, showSoldVariants: true,
        variants: [{ id: 10, status, images: [] }, { id: 11, status: 'SOLD', images: [] }],
        images: [{ id: 1, imageUrl: 'b.jpg', variantId: 11 }],
      });
      expect(result.showSoldVariants).toBe(false);
      expect(result.variants.some((variant) => variant.status === 'SOLD')).toBe(false);
      expect(result.images).toEqual([]);
    }
  });
  it.each(['AVAILABLE', 'SOLD'])('preserves presentation photos even when another variation is %s', (status) => {
    const product = normalizeProductVariants({
      stockQuantity: status === 'SOLD' ? 0 : 1,
      mainImageUrl: 'cover.jpg',
      variants: [
        { id: 10, status, images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, status: 'SOLD', images: [{ imageUrl: 'sold.jpg' }] },
      ],
      images: [
        { id: 1, imageUrl: 'cover.jpg', variantId: null, order: 0 },
        { id: 2, imageUrl: 'overview.jpg', variantId: null, order: 1 },
        { id: 3, imageUrl: 'sold.jpg', variantId: 11, order: 2 },
      ],
    });
    expect(product.mainImageUrl).toBe('cover.jpg');
    expect(product.images.map((image) => image.imageUrl)).toEqual(['cover.jpg', 'overview.jpg']);
    expect(product.soldOut).toBe(status === 'SOLD');
  });
  it('removes a sold variation photo even when it was the stored product cover', () => {
    const product = normalizeProductVariants({
      stockQuantity: 0,
      mainImageUrl: 'sold.jpg',
      // The public query already excludes SOLD variants, but returns their image records.
      variants: [],
      images: [{ id: 1, imageUrl: 'sold.jpg', variantId: 11, order: 0 }],
    });
    expect(product.mainImageUrl).toBeNull();
    expect(product.images).toEqual([]);
    expect(product.variants).toEqual([]);
    expect(product.soldOut).toBe(true);
  });

  it('keeps the product available with only the photos of its remaining variation', () => {
    const product = normalizeProductVariants({
      stockQuantity: 1,
      mainImageUrl: 'sold.jpg',
      variants: [{ id: 10, status: 'AVAILABLE', images: [{ imageUrl: 'available.jpg' }] }],
      images: [
        { id: 1, imageUrl: 'sold.jpg', variantId: 11, order: 0 },
        { id: 2, imageUrl: 'available.jpg', variantId: 10, order: 1 },
      ],
    });
    expect(product.mainImageUrl).toBe('available.jpg');
    expect(product.images.map((image) => image.imageUrl)).toEqual(['available.jpg']);
    expect(product.soldOut).toBe(false);
  });
  it('uses the first presentation photo before variation photos without assigning it a variation', () => {
    const product = normalizeProductVariants({
      stockQuantity: 2,
      mainImageUrl: 'a.jpg',
      images: [
        { id: 1, imageUrl: 'a.jpg', variantId: 10, order: 0 },
        { id: 2, imageUrl: 'cover.jpg', variantId: null, order: 1 },
        { id: 3, imageUrl: 'overview.jpg', variantId: null, order: 2 },
      ],
      variants: [{ id: 10, status: 'AVAILABLE', images: [{ imageUrl: 'a.jpg' }] }, { id: 11, status: 'SOLD', images: [] }],
    });
    expect(product.mainImageUrl).toBe('cover.jpg');
    expect(product.images.map((image) => [image.imageUrl, image.variantLabel])).toEqual([
      ['cover.jpg', null], ['overview.jpg', null], ['a.jpg', 'A'],
    ]);
  });
  it.each(['AVAILABLE', 'SOLD'])('respects a simple product photo order across legacy associations when %s', status => {
    const result = normalizeProductVariants({ stockQuantity: status === 'AVAILABLE' ? 1 : 0,
      mainImageUrl: 'old.jpg', variants: [{ id: 10, status, images: [{ id: 1, imageUrl: 'photo.jpg', order: 0 }] }],
      images: [{ id: 2, imageUrl: 'old.jpg', variantId: null, order: 1 }, { id: 1, imageUrl: 'photo.jpg', variantId: 10, order: 0 }],
    });
    expect(result.mainImageUrl).toBe('photo.jpg');
    expect(result.images.map(image => [image.id, image.variantId])).toEqual([[1, null], [2, null]]);
  });
  it('supports variation labels from A through Z', () => {
    expect(VARIANT_LABELS).toHaveLength(26);
    expect(variantLabel(0)).toBe('A');
    expect(variantLabel(25)).toBe('Z');
    expect(variantLabel(26)).toBe('');
  });

  it('rejects stock above the A-Z variation limit', async () => {
    await expect(syncProductVariants({}, 1, 27)).rejects.toThrow('Maximum 26 variations');
  });

  it('removes sold variation images and relabels remaining images dynamically', () => {
    const product = normalizeProductVariants({
      id: 1,
      stockQuantity: 3,
      soldOut: false,
      reservations: [],
      variants: [
        { id: 10, status: 'AVAILABLE', sortOrder: 0, images: [] },
        { id: 11, status: 'SOLD', sortOrder: 1, images: [] },
        { id: 12, status: 'AVAILABLE', sortOrder: 2, images: [] },
      ],
      images: [
        { id: 1, variantId: 10, imageUrl: 'a.jpg', order: 0 },
        { id: 2, variantId: 11, imageUrl: 'b-sold.jpg', order: 1 },
        { id: 3, variantId: 12, imageUrl: 'c-now-b.jpg', order: 2 },
      ],
    });

    expect(product.variants.map((variant) => [variant.id, variant.label])).toEqual([[10, 'A'], [12, 'B']]);
    expect(product.images.map((image) => [image.imageUrl, image.variantLabel])).toEqual([
      ['a.jpg', 'A'],
      ['c-now-b.jpg', 'B'],
    ]);
  });

  it('restores sold variants before creating new blank variants', async () => {
    const tx = {
      productVariant: {
        findMany: jest.fn()
          .mockResolvedValueOnce([
            { id: 10, productId: 1, status: 'SOLD', sortOrder: 0 },
          ])
          .mockResolvedValueOnce([
            { id: 10, productId: 1, status: 'AVAILABLE', sortOrder: 0 },
          ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
    };

    const variants = await syncProductVariants(tx, 1, 1);

    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10] } },
      data: { status: 'AVAILABLE' },
    });
    expect(tx.productVariant.create).not.toHaveBeenCalled();
    expect(variants).toEqual([
      { id: 10, productId: 1, status: 'AVAILABLE', sortOrder: 0 },
    ]);
  });
});
