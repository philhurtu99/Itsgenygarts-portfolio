import { describe, it, expect, afterEach } from '@jest/globals';
import { createUploadToken, verifyUploadToken } from '../../src/utils/uploadToken.js';

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = originalJwtSecret;
});

describe('upload tokens', () => {
  it('fails closed when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => createUploadToken({ type: 'custom-order', id: 1, email: 'a@test.com' }))
      .toThrow('JWT_SECRET is required for upload tokens');
  });

  it('creates and verifies a scoped upload token', () => {
    process.env.JWT_SECRET = 'upload-test-secret';

    const token = createUploadToken({ type: 'custom-order', id: 12, email: 'a@test.com' });
    const decoded = verifyUploadToken(token, { type: 'custom-order', id: 12 });

    expect(decoded).toMatchObject({ type: 'custom-order', id: 12, email: 'a@test.com' });
  });
});
