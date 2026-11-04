import { describe, expect, it } from '@jest/globals';
import {
  createPrivateMediaUrl,
  privateMediaDescriptor,
  privateMediaFilePath,
  protectPrivateMedia,
  verifyPrivateMediaToken,
} from '../../src/utils/privateMedia.js';

function tokenFrom(url) {
  return new URL(url, 'https://example.test').searchParams.get('token');
}

describe('private media URLs', () => {
  it('creates a short-lived URL bound to the requested file', () => {
    const url = createPrivateMediaUrl('/uploads/custom-orders/123.jpg');
    expect(url).toMatch(/^\/api\/private-media\/custom-orders\/123\.jpg\?token=/);

    const decoded = verifyPrivateMediaToken(tokenFrom(url), {
      area: 'custom-orders',
      filename: '123.jpg',
    });
    expect(decoded).toMatchObject({
      type: 'private-media',
      area: 'custom-orders',
      filename: '123.jpg',
    });
    expect(() => verifyPrivateMediaToken(tokenFrom(url), {
      area: 'custom-orders',
      filename: '124.jpg',
    })).toThrow('Invalid private media token');
  });

  it('only recognizes customer reference image paths', () => {
    expect(privateMediaDescriptor('/uploads/quotes/456.webp')).toEqual({
      area: 'quotes',
      filename: '456.webp',
    });
    expect(privateMediaDescriptor('/uploads/products/456.webp')).toBeNull();
    expect(privateMediaDescriptor('https://res.cloudinary.com/demo/image.jpg')).toBeNull();
    expect(privateMediaDescriptor('/uploads/custom-orders/not-numeric.jpg')).toBeNull();
  });

  it('protects nested local references without changing Cloudinary URLs', () => {
    const value = protectPrivateMedia({
      images: [
        { storagePathOrUrl: '/uploads/quotes/789.png' },
        { storagePathOrUrl: 'https://res.cloudinary.com/demo/image/upload/reference.jpg' },
      ],
    });

    expect(value.images[0].storagePathOrUrl).toMatch(
      /^\/api\/private-media\/quotes\/789\.png\?token=/,
    );
    expect(value.images[1].storagePathOrUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/reference.jpg',
    );
  });

  it('rejects unsupported areas, names and traversal attempts', () => {
    const root = '/srv/app/uploads';
    expect(privateMediaFilePath(root, 'custom-orders', '123.jpeg')).toBe(
      '/srv/app/uploads/custom-orders/123.jpeg',
    );
    expect(privateMediaFilePath(root, 'products', '123.jpeg')).toBeNull();
    expect(privateMediaFilePath(root, 'quotes', '../123.jpeg')).toBeNull();
    expect(privateMediaFilePath(root, 'quotes', 'reference.jpeg')).toBeNull();
  });
});
