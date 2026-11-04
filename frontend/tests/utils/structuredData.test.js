jest.mock('../../src/config/site.js', () => ({
  siteConfig: {
    siteName: 'Crochet Test',
    siteUrl: 'https://shop.test',
    businessName: 'Crochet Test Shop',
  },
  hasLegalConfigGaps: false,
}));

import { productSchema, breadcrumbSchema } from '../../src/utils/structuredData.js';

describe('productSchema', () => {
  const baseProduct = {
    id: 7,
    name: 'Chapeau',
    description: 'Un beau chapeau',
    price: 49.5,
    stockQuantity: 3,
    images: ['/img/a.jpg'],
    sku: 'SKU-7',
  };

  it('returns null when no product is given', () => {
    expect(productSchema(null)).toBeNull();
  });

  it('sets schema.org context and type', () => {
    const s = productSchema(baseProduct);
    expect(s['@context']).toBe('https://schema.org/');
    expect(s['@type']).toBe('Product');
  });

  it('includes name, description, sku, and brand', () => {
    const s = productSchema(baseProduct);
    expect(s.name).toBe('Chapeau');
    expect(s.description).toBe('Un beau chapeau');
    expect(s.sku).toBe('SKU-7');
    expect(s.brand).toEqual({ '@type': 'Brand', name: 'Crochet Test Shop' });
  });

  it('builds an absolute product URL', () => {
    const s = productSchema(baseProduct);
    expect(s.url).toBe('https://shop.test/products/7');
  });

  it('absolutizes relative image paths', () => {
    const s = productSchema(baseProduct);
    expect(s.image).toEqual(['https://shop.test/img/a.jpg']);
  });

  it('leaves absolute image URLs untouched', () => {
    const s = productSchema({ ...baseProduct, images: ['https://cdn.test/x.jpg'] });
    expect(s.image).toEqual(['https://cdn.test/x.jpg']);
  });

  it('falls back to imageUrl when images is empty', () => {
    const s = productSchema({ ...baseProduct, images: undefined, imageUrl: '/fallback.jpg' });
    expect(s.image).toEqual(['https://shop.test/fallback.jpg']);
  });

  it('uses product.id as sku fallback', () => {
    const s = productSchema({ ...baseProduct, sku: undefined });
    expect(s.sku).toBe('7');
  });

  it('omits description when absent', () => {
    const s = productSchema({ ...baseProduct, description: undefined });
    expect(s.description).toBeUndefined();
  });

  it('accepts a category string', () => {
    const s = productSchema({ ...baseProduct, category: 'Chapeaux' });
    expect(s.category).toBe('Chapeaux');
  });

  it('reads category.name when category is an object', () => {
    const s = productSchema({ ...baseProduct, category: { name: 'Écharpes' } });
    expect(s.category).toBe('Écharpes');
  });

  it('sets offers with InStock when available', () => {
    const s = productSchema(baseProduct);
    expect(s.offers).toMatchObject({
      '@type': 'Offer',
      price: '49.50',
      priceCurrency: 'CAD',
      availability: 'https://schema.org/InStock',
    });
  });

  it('uses OutOfStock when status is SOLD', () => {
    const s = productSchema({ ...baseProduct, status: 'SOLD' });
    expect(s.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('uses OutOfStock when stockQuantity <= 0', () => {
    const s = productSchema({ ...baseProduct, stockQuantity: 0 });
    expect(s.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('uses OutOfStock when isSold is true', () => {
    const s = productSchema({ ...baseProduct, isSold: true });
    expect(s.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('respects the currency option', () => {
    const s = productSchema(baseProduct, { currency: 'EUR' });
    expect(s.offers.priceCurrency).toBe('EUR');
  });

  it('omits offers when price is null', () => {
    const s = productSchema({ ...baseProduct, price: null });
    expect(s.offers).toBeUndefined();
  });
});

describe('breadcrumbSchema', () => {
  it('returns null when no items are provided', () => {
    expect(breadcrumbSchema()).toBeNull();
    expect(breadcrumbSchema([])).toBeNull();
  });

  it('builds a BreadcrumbList with position indexes', () => {
    const s = breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Products', url: '/products' },
    ]);
    expect(s['@type']).toBe('BreadcrumbList');
    expect(s.itemListElement).toHaveLength(2);
    expect(s.itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://shop.test/',
    });
    expect(s.itemListElement[1].position).toBe(2);
  });
});
