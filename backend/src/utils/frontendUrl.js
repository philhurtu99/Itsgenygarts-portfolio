const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEV_STOREFRONT_PORTS = new Set(['3000', '5173']);
const ADMIN_PORTS = new Set(['3002', '5174']);
const PRIVATE_DEV_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredFrontendOrigin() {
  return normalizeOrigin(process.env.FRONTEND_URL) || DEFAULT_FRONTEND_URL;
}

function configuredCorsOrigins() {
  return (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);
}

function requestOrigin(req) {
  const origin = normalizeOrigin(req?.get?.('origin'));
  if (origin) return origin;

  return normalizeOrigin(req?.get?.('referer'));
}

function isStorefrontDevPort(origin) {
  try {
    const { port } = new URL(origin);
    return DEV_STOREFRONT_PORTS.has(port);
  } catch {
    return false;
  }
}

function isAdminOrigin(origin) {
  try {
    const { port } = new URL(origin);
    return ADMIN_PORTS.has(port);
  } catch {
    return false;
  }
}

function isAllowedStorefrontOrigin(origin) {
  if (!origin || isAdminOrigin(origin)) return false;

  if (origin === configuredFrontendOrigin()) return true;
  if (configuredCorsOrigins().includes(origin)) return true;

  const isDev = process.env.NODE_ENV !== 'production';
  return isDev && isStorefrontDevPort(origin) && PRIVATE_DEV_ORIGIN_REGEX.test(origin);
}

export function getConfiguredFrontendUrl() {
  return configuredFrontendOrigin();
}

export function getStorefrontUrl(req) {
  const origin = requestOrigin(req);
  if (isAllowedStorefrontOrigin(origin)) {
    return origin;
  }

  return getConfiguredFrontendUrl();
}
