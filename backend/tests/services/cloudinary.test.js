import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { localImageStorageEnabled, localImagesDirectory } from '../../src/services/localImages.js';

const uploadStreamMock = jest.fn();
const destroyMock = jest.fn();
const resourcesMock = jest.fn();
const configMock = jest.fn();

jest.unstable_mockModule('cloudinary', () => ({
  v2: {
    config: configMock,
    uploader: {
      upload_stream: uploadStreamMock,
      destroy: destroyMock,
    },
    api: {
      resources: resourcesMock,
    },
  },
}));

const { uploadImage, deleteImage, listAllImages } = await import(
  '../../src/services/cloudinary.js'
);

beforeEach(() => {
  uploadStreamMock.mockReset();
  destroyMock.mockReset();
  resourcesMock.mockReset();
});

describe('uploadImage', () => {
  it('resolves with the cloudinary result on success', async () => {
    const fakeStream = { end: jest.fn() };
    uploadStreamMock.mockImplementation((opts, cb) => {
      setTimeout(() => cb(null, { public_id: 'abc', secure_url: 'u' }), 0);
      return fakeStream;
    });
    const buf = Buffer.from('x');
    const result = await uploadImage(buf, 'mine');
    expect(result).toEqual({ public_id: 'abc', secure_url: 'u' });
    expect(uploadStreamMock).toHaveBeenCalledWith(
      { folder: 'mine', resource_type: 'image' },
      expect.any(Function),
    );
    expect(fakeStream.end).toHaveBeenCalledWith(buf);
  });

  it('defaults folder to "crochet"', async () => {
    const fakeStream = { end: jest.fn() };
    uploadStreamMock.mockImplementation((opts, cb) => {
      setTimeout(() => cb(null, {}), 0);
      return fakeStream;
    });
    await uploadImage(Buffer.from('x'));
    expect(uploadStreamMock.mock.calls[0][0].folder).toBe('crochet');
  });

  it('rejects when cloudinary yields an error', async () => {
    const fakeStream = { end: jest.fn() };
    uploadStreamMock.mockImplementation((opts, cb) => {
      setTimeout(() => cb(new Error('boom')), 0);
      return fakeStream;
    });
    await expect(uploadImage(Buffer.from('x'))).rejects.toThrow('boom');
  });
});

describe('deleteImage', () => {
  it('delegates to cloudinary.uploader.destroy with the public id', async () => {
    destroyMock.mockResolvedValueOnce({ result: 'ok' });
    const out = await deleteImage('my/id');
    expect(destroyMock).toHaveBeenCalledWith('my/id');
    expect(out).toEqual({ result: 'ok' });
  });

  it('skips Cloudinary when public id is missing', async () => {
    const out = await deleteImage('');
    expect(destroyMock).not.toHaveBeenCalled();
    expect(out).toBeNull();
  });
});

describe('listAllImages', () => {
  it('returns the single page when no next_cursor is returned', async () => {
    resourcesMock.mockResolvedValueOnce({
      resources: [{ public_id: 'a' }, { public_id: 'b' }],
      next_cursor: undefined,
    });
    const out = await listAllImages();
    expect(out).toHaveLength(2);
    expect(resourcesMock).toHaveBeenCalledTimes(1);
  });

  it('follows next_cursor and aggregates pages up to maxResults', async () => {
    resourcesMock
      .mockResolvedValueOnce({
        resources: [{ public_id: 'a' }, { public_id: 'b' }],
        next_cursor: 'tok',
      })
      .mockResolvedValueOnce({
        resources: [{ public_id: 'c' }],
        next_cursor: undefined,
      });
    const out = await listAllImages();
    expect(out).toHaveLength(3);
    expect(resourcesMock).toHaveBeenCalledTimes(2);
    expect(resourcesMock.mock.calls[1][0].next_cursor).toBe('tok');
  });

  it('stops paginating once maxResults is reached', async () => {
    resourcesMock
      .mockResolvedValueOnce({
        resources: [{ public_id: 'a' }, { public_id: 'b' }],
        next_cursor: 'tok',
      });
    const out = await listAllImages(2);
    expect(out).toHaveLength(2);
    expect(resourcesMock).toHaveBeenCalledTimes(1);
  });

  it('caps the requested page size to the remaining budget', async () => {
    resourcesMock.mockResolvedValueOnce({
      resources: [{ public_id: 'a' }],
      next_cursor: undefined,
    });
    await listAllImages(10);
    expect(resourcesMock.mock.calls[0][0].max_results).toBe(10);
  });

  it('tolerates a missing resources array', async () => {
    resourcesMock.mockResolvedValueOnce({});
    const out = await listAllImages();
    expect(out).toEqual([]);
  });
});

describe('local Dev image storage', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStorage = process.env.IMAGE_STORAGE;
  let uploadedIds;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.IMAGE_STORAGE = 'local';
    uploadedIds = [];
  });

  afterEach(async () => {
    for (const id of uploadedIds) await deleteImage(id);
    process.env.NODE_ENV = originalNodeEnv;
    if (originalStorage === undefined) delete process.env.IMAGE_STORAGE;
    else process.env.IMAGE_STORAGE = originalStorage;
  });

  it('stores, lists and deletes a real image without contacting Cloudinary', async () => {
    const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ed9eb5' } }).png().toBuffer();
    const image = await uploadImage(buffer);
    uploadedIds.push(image.public_id);
    expect(image.secure_url).toMatch(/^\/api\/local-images\/[a-f0-9-]+\.png$/);
    const filename = image.public_id.split('/')[1];
    expect(await readFile(path.join(localImagesDirectory, filename))).toEqual(buffer);
    expect(await listAllImages()).toContainEqual(image);
    expect(await deleteImage(image.public_id)).toEqual({ result: 'ok' });
    expect(await listAllImages()).not.toContainEqual(image);
    expect(uploadStreamMock).not.toHaveBeenCalled();
    expect(resourcesMock).not.toHaveBeenCalled();
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it('preserves production assets and rejects path traversal during local deletion', async () => {
    expect(await deleteImage('crochet/production-photo')).toEqual({ result: 'not found' });
    expect(await deleteImage('local-dev/../../.env')).toEqual({ result: 'not found' });
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it('rejects non-image data before writing a file', async () => {
    await expect(uploadImage(Buffer.from('<script>bad</script>'))).rejects.toThrow();
    expect(uploadStreamMock).not.toHaveBeenCalled();
  });

  it('never enables local storage in production', () => {
    process.env.NODE_ENV = 'production';
    expect(localImageStorageEnabled()).toBe(false);
  });
});
