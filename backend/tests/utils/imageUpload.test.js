import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, it, expect } from '@jest/globals';
import { normalizeUploadedImage, validateUploadedImage } from '../../src/utils/imageUpload.js';

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);
const realPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwUMMAYAj4IP8cvlVgcAAAAASUVORK5CYII=',
  'base64'
);

describe('validateUploadedImage', () => {
  it('accepts files whose declared MIME matches the image bytes', () => {
    expect(() => validateUploadedImage({ mimetype: 'image/png', buffer: pngBuffer })).not.toThrow();
  });

  it('identifies the actual bytes when a phone transfer changes the declared MIME', () => {
    expect(validateUploadedImage({ mimetype: 'image/jpeg', buffer: pngBuffer })).toBe('image/png');
    expect(validateUploadedImage({ mimetype: 'application/octet-stream', buffer: pngBuffer })).toBe('image/png');
  });

  it('rejects non-image bytes even when the declared MIME is allowed', () => {
    expect(() => validateUploadedImage({
      mimetype: 'image/png',
      buffer: Buffer.from('not really a png'),
    })).toThrow('Image invalide.');
  });

  it('decodes and re-encodes images before storage', async () => {
    const image = await normalizeUploadedImage({ mimetype: 'image/png', buffer: realPngBuffer });

    expect(image.mimetype).toBe('image/png');
    expect(image.buffer.length).toBeGreaterThan(0);
    expect(() => validateUploadedImage(image)).not.toThrow();
  });
});

it('converts a real HEIC phone photo to a readable JPEG before storage', async () => {
  const buffer = await readFile(new URL('../fixtures/phone-photo.heic', import.meta.url));
  const image = await normalizeUploadedImage({ mimetype: 'application/octet-stream', buffer }, { allowPhonePhotos: true });
  expect(image.mimetype).toBe('image/jpeg');
  expect(await sharp(image.buffer).metadata()).toMatchObject({ format: 'jpeg', width: 64, height: 64 });
});

it('returns readable 400 errors for truncated HEIC and corrupt PNG data', async () => {
  const buffer = Buffer.from('0000ftypheic00000000000000000000');
  await expect(normalizeUploadedImage({ buffer }, { allowPhonePhotos: true })).rejects.toMatchObject({ statusCode: 400 });
  await expect(normalizeUploadedImage({ buffer: pngBuffer })).rejects.toMatchObject({ statusCode: 400 });
});

it('does not enable HEIC conversion for unauthenticated public forms', async () => {
  const buffer = await readFile(new URL('../fixtures/phone-photo.heic', import.meta.url));
  await expect(normalizeUploadedImage({ buffer, mimetype: 'image/jpeg' })).rejects.toMatchObject({ statusCode: 400 });
});
