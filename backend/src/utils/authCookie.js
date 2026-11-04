const COOKIE_NAMES = {
  customer: 'auth_customer',
  admin: 'auth_admin',
};

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isFalsyEnv(value) {
  return ['0', 'false', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
}

function configuredOrigins() {
  return [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.CORS_ORIGIN,
  ]
    .flatMap((value) => String(value || '').split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalHttpOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (
      url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || /^10\./.test(url.hostname)
      || /^192\.168\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
    );
  } catch {
    return false;
  }
}

function shouldUseSecureCookie() {
  const explicit = process.env.AUTH_COOKIE_SECURE ?? process.env.COOKIE_SECURE;
  if (isTruthyEnv(explicit)) return true;
  if (isFalsyEnv(explicit)) return false;

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return false;

  const origins = configuredOrigins().filter((origin) => origin !== '*');
  if (origins.length && origins.every(isLocalHttpOrigin)) return false;

  return true;
}

function baseOptions() {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: process.env.AUTH_COOKIE_SAMESITE || process.env.COOKIE_SAMESITE || 'lax',
    path: '/',
  };
}

export function setAuthCookie(res, type, token, { maxAgeMs } = {}) {
  const name = COOKIE_NAMES[type];
  if (!name) throw new Error(`Unknown auth cookie type: ${type}`);
  res.cookie(name, token, {
    ...baseOptions(),
    maxAge: maxAgeMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

export function clearAuthCookie(res, type) {
  const name = COOKIE_NAMES[type];
  if (!name) throw new Error(`Unknown auth cookie type: ${type}`);
  res.clearCookie(name, { ...baseOptions(), maxAge: undefined });
}

export function readAuthCookie(req, type) {
  const name = COOKIE_NAMES[type];
  return req.cookies?.[name] || null;
}

export { COOKIE_NAMES };
