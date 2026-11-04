import jwt from 'jsonwebtoken';
import path from 'path';

const PRIVATE_MEDIA_AREAS = new Set(['custom-orders', 'quotes']);
const PRIVATE_MEDIA_FILENAME = /^\d+\.(?:gif|jpe?g|png|webp)$/i;

function secret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for private media URLs');
  }
  return process.env.JWT_SECRET;
}

export function privateMediaDescriptor(storagePathOrUrl) {
  if (typeof storagePathOrUrl !== 'string') return null;
  const match = storagePathOrUrl.match(/^\/uploads\/(custom-orders|quotes)\/([^/?#]+)$/);
  if (!match || !PRIVATE_MEDIA_FILENAME.test(match[2])) return null;
  return { area: match[1], filename: match[2] };
}

export function createPrivateMediaUrl(storagePathOrUrl) {
  const descriptor = privateMediaDescriptor(storagePathOrUrl);
  if (!descriptor) return storagePathOrUrl;
  const token = jwt.sign(
    { type: 'private-media', ...descriptor },
    secret(),
    { expiresIn: process.env.PRIVATE_MEDIA_URL_TTL || '15m' },
  );
  return `/api/private-media/${descriptor.area}/${encodeURIComponent(descriptor.filename)}?token=${encodeURIComponent(token)}`;
}

export function verifyPrivateMediaToken(token, expected) {
  const decoded = jwt.verify(token, secret());
  if (
    decoded?.type !== 'private-media'
    || decoded.area !== expected.area
    || decoded.filename !== expected.filename
  ) {
    throw new Error('Invalid private media token');
  }
  return decoded;
}

export function privateMediaFilePath(rootDirectory, area, filename) {
  if (!PRIVATE_MEDIA_AREAS.has(area) || !PRIVATE_MEDIA_FILENAME.test(filename)) return null;
  const areaRoot = path.resolve(rootDirectory, area);
  const resolved = path.resolve(areaRoot, filename);
  return resolved.startsWith(`${areaRoot}${path.sep}`) ? resolved : null;
}

export function protectPrivateMedia(value) {
  if (Array.isArray(value)) return value.map(protectPrivateMedia);
  if (!value || typeof value !== 'object') return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const protectedValue = {};
  for (const [key, nested] of Object.entries(value)) {
    protectedValue[key] = protectPrivateMedia(nested);
  }
  if (privateMediaDescriptor(value.storagePathOrUrl)) {
    protectedValue.storagePathOrUrl = createPrivateMediaUrl(value.storagePathOrUrl);
  }
  return protectedValue;
}
