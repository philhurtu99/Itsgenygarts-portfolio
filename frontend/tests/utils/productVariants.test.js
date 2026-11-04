import { getAvailableVariants, getDisplayVariants, getDisplayImages, hasSelectableVariants } from '../../src/utils/productVariants.js';

describe('product variant display helpers', () => {
  it('allows viewing sold variations without making them available to purchase', () => {
    const product = {
      soldOut: true, stockQuantity: 0, showSoldVariants: true,
      variants: [
        { id: 10, status: 'SOLD', images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, status: 'SOLD', images: [{ imageUrl: 'b.jpg' }] },
      ],
    };
    expect(getAvailableVariants(product)).toEqual([]);
    expect(getDisplayVariants(product)).toHaveLength(2);
    expect(getDisplayImages(product).map((image) => image.imageUrl)).toEqual(['a.jpg', 'b.jpg']);
    expect(getDisplayImages({ ...product, showSoldVariants: false })).toEqual([]);
    expect(getDisplayVariants({ ...product, stockQuantity: 1 })).toEqual([]);
  });
  it.each(['AVAILABLE', 'SOLD'])('keeps presentation photos when another variation is %s', (status) => {
    const product = {
      mainImageUrl: 'cover.jpg',
      images: [
        { imageUrl: 'cover.jpg', variantId: null },
        { imageUrl: 'overview.jpg', variantId: null },
        { imageUrl: 'sold.jpg', variantId: 11 },
      ],
      variants: [
        { id: 10, status, images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, status: 'SOLD', images: [{ imageUrl: 'sold.jpg' }] },
      ],
    };
    const images = getDisplayImages(product);
    expect(images.slice(0, 2).map((image) => [image.imageUrl, image.variantLabel])).toEqual([
      ['cover.jpg', null], ['overview.jpg', null],
    ]);
    expect(images.some((image) => image.imageUrl === 'sold.jpg')).toBe(false);
    expect(images).toHaveLength(status === 'SOLD' ? 2 : 3);
  });
  it('excludes sold variations and their photos even when included in the response', () => {
    const product = {
      variants: [
        { id: 10, status: 'AVAILABLE', images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, status: 'SOLD', images: [{ imageUrl: 'sold.jpg' }] },
      ],
      images: [{ imageUrl: 'sold.jpg', variantId: 11 }],
    };
    expect(getAvailableVariants(product).map((variant) => variant.id)).toEqual([10]);
    expect(getDisplayImages(product).map((image) => image.imageUrl)).toEqual(['a.jpg']);
  });

  it('never falls back to a sold variation photo after every variation is gone', () => {
    expect(getDisplayImages({
      mainImageUrl: 'sold.jpg',
      variants: [],
      images: [{ imageUrl: 'sold.jpg', variantId: 11 }],
    })).toEqual([]);
  });
  it('puts all presentation photos first and retains a variation sharing the same source image', () => {
    const images = getDisplayImages({
      images: [{ imageUrl: 'cover.jpg', variantId: null }, { imageUrl: 'overview.jpg', variantId: null }],
      variants: [{ id: 10, label: 'A', images: [{ imageUrl: 'cover.jpg' }] }, { id: 11, label: 'B', images: [{ imageUrl: 'b.jpg' }] }],
    });
    expect(images.map((image) => [image.imageUrl, image.variantLabel])).toEqual([
      ['cover.jpg', null], ['overview.jpg', null], ['cover.jpg', 'A'], ['b.jpg', 'B'],
    ]);
  });
  it('does not duplicate a simple product photo also returned under its internal stock variant', () => {
    const image = { id: 97, imageUrl: 'lemon.jpg' };
    const images = getDisplayImages({
      images: [{ ...image, variantId: null }],
      variants: [{ id: 23, status: 'AVAILABLE', images: [{ ...image, variantId: 23 }] }],
    });
    expect(images).toEqual([expect.objectContaining({ id: 97, imageUrl: 'lemon.jpg', variantId: null })]);
  });
  it('keeps distinct presentation and variation photos even when their URLs match', () => {
    const images = getDisplayImages({
      images: [{ id: 1, imageUrl: 'cover.jpg', variantId: null }],
      variants: [
        { id: 10, images: [{ id: 2, imageUrl: 'cover.jpg' }] },
        { id: 11, images: [{ id: 3, imageUrl: 'b.jpg' }] },
      ],
    });
    expect(images.map(image => image.id)).toEqual([1, 2, 3]);
  });
  it('keeps a sole variant image without exposing a variation label', () => {
    const product = {
      variants: [{ id: 10, label: 'A', images: [{ imageUrl: 'a.jpg' }] }],
      images: [{ id: 1, imageUrl: 'a.jpg', variantId: 10, variantLabel: 'A' }],
    };

    expect(hasSelectableVariants(product)).toBe(false);
    expect(getDisplayImages(product)).toEqual([
      expect.objectContaining({
        imageUrl: 'a.jpg',
        variantId: 10,
        variantLabel: null,
      }),
    ]);
  });

  it('keeps variation labels when multiple variants are selectable', () => {
    const product = {
      variants: [
        { id: 10, label: 'A', images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, label: 'B', images: [{ imageUrl: 'b.jpg' }] },
      ],
      images: [],
    };

    expect(hasSelectableVariants(product)).toBe(true);
    expect(getDisplayImages(product).map((image) => image.variantLabel)).toEqual(['A', 'B']);
  });

  it('generates letter labels when variants arrive without labels', () => {
    const product = {
      variants: [
        { id: 10, images: [{ imageUrl: 'a.jpg' }] },
        { id: 11, images: [{ imageUrl: 'b.jpg' }] },
      ],
      images: [
        { id: 1, imageUrl: 'a.jpg', variantId: 10 },
        { id: 2, imageUrl: 'b.jpg', variantId: 11 },
      ],
    };

    expect(getDisplayImages(product).map((image) => image.variantLabel)).toEqual(['A', 'B']);
  });
});
